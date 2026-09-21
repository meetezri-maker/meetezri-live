/**
 * IDLE ENGAGEMENT — the eyes keep the viewer while the head moves freely.
 *
 * THE DIAGNOSIS. Idle already has plenty of motion; what it lacks is a viewer
 * anchor. Two mechanisms combine to point the avatar away:
 *
 *   1. `GazeBehaviorController` chooses eye direction on its own schedule, with
 *      no knowledge of where the head is pointing. Nothing in the idle path ever
 *      subtracts head orientation from the eye solve — that compensation exists
 *      only on the speaking TalkingHead branch.
 *   2. §P8/§P16 `gazeFollow` then turns the HEAD toward wherever the eyes have
 *      committed (`headFollowTarget = committed * gazeFollowRatio`).
 *
 * So an eye excursion is followed by a head excursion in the SAME direction, and
 * because the eyes are children of the head the two ADD in world space. That is
 * precisely the brief's "bad" pattern: head turns away, eyes turn away, gaze
 * stays away.
 *
 * THE FIX. One final idle gaze authority that takes whatever the existing
 * wandering proposed and re-expresses it around the viewer:
 *
 *     finalEye = viewerAnchor - headOrientation * compensation
 *                + microOffset (a fraction of the original wander)
 *                + gazeBreak (occasional, brief, deliberate)
 *
 * Everything upstream keeps running — the glance scheduler, the drift, the
 * micro-saccades, the blink. What changes is that their output becomes a small
 * offset around the viewer rather than an absolute direction, and the head's own
 * orientation is subtracted so that moving the head does not move the gaze.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It does not lock the eyes to the camera.
 * Compensation is partial (75-90 %), the micro-offset survives, and real gaze
 * breaks still happen — they are just short and they end by coming back.
 */

export interface IdleEngagementConfig {
  id: string;
  label: string;
  /**
   * Fraction of head orientation the eyes give back. 1 would be a perfect
   * camera lock, which reads as robotic; the brief asks for 0.75-0.9.
   */
  compensation: number;
  /** Seconds of first-order lag on the eyes, so they settle after the head. */
  lagSeconds: number;
  /**
   * How much of the existing wander survives as natural deviation, 0-1.
   *
   * Not zero: the glance scheduler, drift and micro-saccades are what stop the
   * engaged gaze looking painted on. They are scaled down, not removed.
   */
  microOffsetScale: number;
  /** Half-angle of the engagement cone the micro-offset is clamped into. */
  coneDegrees: number;
  /** Mean seconds between deliberate gaze breaks. */
  breakIntervalSeconds: number;
  /** How long a break lasts. Short enough to read as a glance, not a departure. */
  breakSeconds: number;
  /** How far a break travels, in RENDERED eye degrees. */
  breakYawDegrees: number;
  breakPitchDegrees: number;
  /**
   * Multiplier on §P8/§P16's head-follow-eyes.
   *
   * SHIPS AT 1 — head-follow is left completely alone, and that is a measured
   * decision rather than an omission. Head-follow was the second half of the
   * diagnosis, so reducing it was the obvious move; at 0.35 it cost 17 % of head
   * travel (0.529 to 0.438 deg/s) and shrank the yaw range from 18.8 to 15.3 deg
   * while buying only 0.2 points of cone occupancy. Compensation already cancels
   * whatever the head does, so the head chasing the eyes no longer moves the
   * gaze off the viewer and there is nothing left to fix. The lever stays
   * exposed in case hardware disagrees.
   */
  headFollowScale: number;
  /**
   * `eyeGeometry.gazeScale`: how many degrees the eyeball turns per degree of
   * the gaze value this module returns. 4.01 on the female asset.
   *
   * Every degree figure in this config is a RENDERED eye degree — what the
   * eyeball actually does — because that is the only frame of reference in which
   * "compensate for 8 deg of head yaw" means anything. The output is divided by
   * this so the caller still receives the gaze units it expects. Getting this
   * backwards would ask the eye for 26 deg of rotation to cancel 8 deg of head,
   * which is past the 22 deg mechanical limit and four times too much.
   */
  eyeRenderScale: number;
}

export const idleEngagementConfigs = {
  /**
   * The proposal. Compensation at the middle of the requested band, breaks
   * roughly every 11 s lasting 0.7 s.
   */
  engaged: {
    id: "engaged", label: "Engaged",
    compensation: 0.82, lagSeconds: 0.1,
    microOffsetScale: 0.35, coneDegrees: 6,
    breakIntervalSeconds: 11, breakSeconds: 0.7,
    breakYawDegrees: 4.5, breakPitchDegrees: 3.5,
    headFollowScale: 1, eyeRenderScale: 4.01
  },
  /**
   * MAX. The same architecture pushed far enough that a reviewer can tell
   * whether the DIRECTION is right, not a candidate for shipping: near-full
   * compensation, a tighter cone, less wander and rarer breaks.
   */
  engagedMax: {
    id: "engagedMax", label: "Engaged MAX",
    compensation: 0.95, lagSeconds: 0.07,
    microOffsetScale: 0.18, coneDegrees: 3.5,
    breakIntervalSeconds: 18, breakSeconds: 0.5,
    breakYawDegrees: 1.4, breakPitchDegrees: 0.9,
    headFollowScale: 1, eyeRenderScale: 4.01
  }
} satisfies Record<string, IdleEngagementConfig>;

export type IdleEngagementId = keyof typeof idleEngagementConfigs;

export interface IdleEngagementResult {
  yawDegrees: number;
  pitchDegrees: number;
  engaged: boolean;
  breakActive: boolean;
  /** How many degrees of head orientation the eyes gave back this frame. */
  compensationDegrees: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * A deterministic pseudo-random stream, so break timing is reproducible and a
 * test can assert it. Idle behaviour elsewhere in this layer is seeded the same
 * way, and unseeded breaks would make every gate here a coin flip.
 */
const makeRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hashSeed = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/**
 * The single idle gaze authority.
 *
 * Stateful only in the lag filter and the break scheduler; the anchor itself is
 * a pure function of the head orientation handed in, so it cannot drift.
 */
export class IdleGazeEngagement {
  private random: () => number;
  private time = 0;
  private lagged = { yaw: 0, pitch: 0 };
  private nextBreakAt: number;
  private breakUntil = -1;
  private breakTarget = { yaw: 0, pitch: 0 };
  private breakEnvelope = 0;

  constructor(seed: string | number = "idle-engagement", private config: IdleEngagementConfig = idleEngagementConfigs.engaged) {
    this.random = makeRandom(typeof seed === "number" ? seed : hashSeed(seed));
    this.nextBreakAt = this.drawBreakInterval();
  }

  private drawBreakInterval() {
    // 0.6x to 1.4x the mean, so breaks are irregular without being clustered.
    return this.config.breakIntervalSeconds * (0.6 + 0.8 * this.random());
  }

  reset(seed: string | number = "idle-engagement") {
    this.random = makeRandom(typeof seed === "number" ? seed : hashSeed(seed));
    this.time = 0;
    this.lagged = { yaw: 0, pitch: 0 };
    this.breakUntil = -1;
    this.breakEnvelope = 0;
    this.breakTarget = { yaw: 0, pitch: 0 };
    this.nextBreakAt = this.drawBreakInterval();
  }

  configure(config: IdleEngagementConfig) {
    this.config = config;
  }

  /**
   * @param headYawDegrees  live head orientation, which the eyes compensate for
   * @param wanderYawDegrees what the existing gaze scheduler proposed
   */
  update(
    deltaSeconds: number,
    headYawDegrees: number,
    headPitchDegrees: number,
    wanderYawDegrees: number,
    wanderPitchDegrees: number
  ): IdleEngagementResult {
    const c = this.config;
    const scale = Math.max(0.01, c.eyeRenderScale);
    this.time += deltaSeconds;

    /* --- gaze breaks ------------------------------------------------------ */
    if (this.breakUntil < 0 && this.time >= this.nextBreakAt) {
      /**
       * A believable break is downward or slightly to one side — the direction
       * people actually look when they think — never a long turn away. The
       * envelope below makes it ease out and back rather than cutting.
       */
      const side = this.random() < 0.5 ? -1 : 1;
      this.breakTarget = {
        yaw: side * c.breakYawDegrees * (0.5 + 0.5 * this.random()),
        // Biased downward: looking up reads as distracted, down as thinking.
        pitch: c.breakPitchDegrees * (0.35 + 0.65 * this.random())
      };
      this.breakUntil = this.time + c.breakSeconds;
    }
    const breakActive = this.breakUntil > 0 && this.time < this.breakUntil;
    if (this.breakUntil > 0 && this.time >= this.breakUntil) {
      this.breakUntil = -1;
      this.nextBreakAt = this.time + this.drawBreakInterval();
    }
    // Raised-cosine envelope: no step in or out of a break.
    const targetEnvelope = breakActive ? 1 : 0;
    const envelopeRate = deltaSeconds / Math.max(0.05, c.breakSeconds * 0.35);
    this.breakEnvelope = targetEnvelope > this.breakEnvelope
      ? Math.min(1, this.breakEnvelope + envelopeRate)
      : Math.max(0, this.breakEnvelope - envelopeRate);
    const shaped = 0.5 - 0.5 * Math.cos(Math.PI * this.breakEnvelope);

    /* --- the anchored solve ------------------------------------------------ */
    /**
     * The head term is SUBTRACTED. That single sign is the whole fix: an eye
     * offset is measured relative to the head, so giving back a fraction of the
     * head's own rotation keeps the composed world gaze near the viewer while
     * the head moves freely.
     */
    const compensationYaw = -headYawDegrees * c.compensation;
    const compensationPitch = -headPitchDegrees * c.compensation;

    /**
     * The existing wander survives, scaled down and confined to the cone. It
     * arrives in GAZE degrees, so it is converted into rendered degrees to sit
     * in the same frame as everything else here.
     */
    const microYaw = clamp(wanderYawDegrees * scale * c.microOffsetScale, -c.coneDegrees, c.coneDegrees);
    const microPitch = clamp(wanderPitchDegrees * scale * c.microOffsetScale, -c.coneDegrees, c.coneDegrees);

    const wantYaw = compensationYaw + microYaw + this.breakTarget.yaw * shaped;
    const wantPitch = compensationPitch + microPitch + this.breakTarget.pitch * shaped;

    // Lag, so the eyes settle after the head rather than moving with it.
    const alpha = c.lagSeconds > 0 ? 1 - Math.exp(-deltaSeconds / c.lagSeconds) : 1;
    this.lagged.yaw += (wantYaw - this.lagged.yaw) * alpha;
    this.lagged.pitch += (wantPitch - this.lagged.pitch) * alpha;

    // Back into the gaze units the caller works in.
    return {
      yawDegrees: this.lagged.yaw / scale,
      pitchDegrees: this.lagged.pitch / scale,
      engaged: !breakActive,
      breakActive,
      compensationDegrees: Math.hypot(compensationYaw, compensationPitch)
    };
  }

  /** Multiplier the head-follow should apply while engagement is active. */
  headFollowScale() {
    return this.config.headFollowScale;
  }
}
