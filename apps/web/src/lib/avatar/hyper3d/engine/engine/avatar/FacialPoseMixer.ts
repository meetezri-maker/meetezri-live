import type { ChannelPose, MixedPoseResult } from "../../types/facialAnimation";
import {
  blendshapeRegions,
  clampAvatarMorph,
  deadlineConvergenceSpeed,
  regionMergeStrategy,
  smoothingSpeedByRegion,
  isLipShapeChannel,
  isMouthSettleChannel,
  type MouthDeadlineProfile,
  type MouthSettleProfile,
  type MouthTransitionProfile
} from "../../mappings/avatarBlendshapeConfig";
import { clamp } from "../../utils/clamp";
import { exponentialSmoothingAlpha, lerp } from "../../utils/lerp";

const clearRecord = (record: Record<string, unknown>) => { for (const key in record) delete record[key]; };

/**
 * What the deadline layer did on the last frame, for the DEV comparison panel.
 *
 * Reported rather than inferred: the panel must be able to say "deadline
 * acceleration active YES/NO" about the frame that is on screen, and no
 * re-derivation outside the smoother could be trusted to agree with it.
 */
export interface DeadlineFollowerFrame {
  /** True when a cap was supplied at all, i.e. the mode is not CURRENT. */
  armed: boolean;
  /** How many channels were accelerated above their baseline speed this frame. */
  acceleratedChannels: number;
  /** The highest speed the layer demanded this frame, or 0 when it demanded none. */
  peakSpeed: number;
  /** Seconds left in the CURRENT label, as the smoother was told. */
  secondsRemaining: number;
}

const idleDeadlineFrame: DeadlineFollowerFrame = Object.freeze({
  armed: false,
  acceleratedChannels: 0,
  peakSpeed: 0,
  secondsRemaining: 0
});

export class FacialPoseMixer {
  private current: Record<string, number> = {};
  private combinedPose: Record<string, number> = {};
  private smoothedPose: Record<string, number> = {};
  private channelContributions: MixedPoseResult["channelContributions"] = {};
  /** Mutated in place once per frame; never handed out, only read through `deadlineFrame`. */
  private deadline: DeadlineFollowerFrame = { ...idleDeadlineFrame };

  reset() {
    clearRecord(this.current);
    clearRecord(this.combinedPose);
    clearRecord(this.smoothedPose);
    clearRecord(this.channelContributions);
    this.deadline = { ...idleDeadlineFrame };
  }

  /** What the deadline layer did on the frame just smoothed. DEV instrumentation. */
  deadlineFrame(): DeadlineFollowerFrame {
    return { ...this.deadline };
  }

  combine(channels: ChannelPose[]): MixedPoseResult {
    clearRecord(this.combinedPose);
    clearRecord(this.channelContributions);
    for (const channel of channels) {
      const pose = channel.pose;
      const weight = channel.weight ?? 1;
      for (const name in pose) {
        const value = clampAvatarMorph(name, pose[name] * weight);
        const region = blendshapeRegions[name] ?? "mouth";
        const strategy = regionMergeStrategy[region];
        const previous = this.combinedPose[name] ?? 0;
        if (strategy === "replace") this.combinedPose[name] = value;
        else if (strategy === "add" || strategy === "boundedAdd") this.combinedPose[name] = clampAvatarMorph(name, previous + value);
        else if (strategy === "max") this.combinedPose[name] = Math.max(previous, value);
        else if (strategy === "multiply") this.combinedPose[name] = previous * value;
        else this.combinedPose[name] = previous === 0 ? value : (previous + value) / 2;
        const contribution = this.channelContributions[name] ?? {};
        contribution[channel.channel] = value;
        this.channelContributions[name] = contribution;
      }
    }
    if ((this.combinedPose.mouthClose ?? 0) > .65) {
      this.combinedPose.mouthSmileLeft = Math.min(this.combinedPose.mouthSmileLeft ?? 0, .12);
      this.combinedPose.mouthSmileRight = Math.min(this.combinedPose.mouthSmileRight ?? 0, .12);
      this.combinedPose.jawOpen = Math.min(this.combinedPose.jawOpen ?? 0, .08);
    }
    return { pose: this.combinedPose, channelContributions: this.channelContributions };
  }

  /**
   * @param ownedElsewhere channels already damped by an upstream controller. They
   * are copied through untouched so no channel is smoothed twice. Without this the
   * coordinated speech layer's phase-aware attack/release would be flattened by the
   * mixer's single per-region speed, which is the exact defect it exists to fix.
   * @param jaw the model's asymmetric jaw profile, or omitted for the symmetric
   * `smoothingSpeedByRegion.jaw` every model used before it existed.
   */
  smooth(
    target: Record<string, number>,
    delta: number,
    ownedElsewhere?: ReadonlySet<string>,
    mouth?: MouthTransitionProfile,
    /**
     * True while the avatar is inside a real SENTENCE pause. Resolved by the
     * controller from the boundary timeline it already queries, so the mixer
     * owns no detection and no threshold of its own.
     */
    settling = false,
    /**
     * Seconds until the CURRENT phoneme ends, or `null` when no phoneme is
     * active. THE DEADLINE, and the only per-frame input the convergence layer
     * takes. It is read from the same `activePhoneme` lookup and the same audio
     * clock the rest of the frame uses, so it cannot describe a different
     * timeline — and nothing here writes it back, so the timeline is read-only
     * to this layer by construction.
     */
    secondsRemainingInLabel: number | null = null
  ) {
    clearRecord(this.smoothedPose);
    /**
     * Resolved ONCE per frame, not per channel: a bilabial is a property of the
     * frame, and every jaw channel must agree about whether one is being made.
     */
    const sealing = mouth ? (target.mouthClose ?? 0) >= mouth.sealClosureThreshold : false;
    const settle = settling ? mouth?.settle : undefined;
    /**
     * THE DEADLINE GATE, resolved once per frame alongside the seal.
     *
     * `settle` disqualifies the whole frame: a sentence pause has no active
     * phoneme, so there is no deadline to be aware of, and the 11-speed settle is
     * accepted behaviour this layer is not allowed to touch. `null` remaining
     * disqualifies it for the same reason — silence owns no label.
     */
    const deadline =
      !settle && mouth?.deadline && secondsRemainingInLabel !== null ? mouth.deadline : undefined;
    this.deadline.armed = Boolean(mouth?.deadline);
    this.deadline.acceleratedChannels = 0;
    this.deadline.peakSpeed = 0;
    this.deadline.secondsRemaining = secondsRemainingInLabel ?? 0;
    const remaining = secondsRemainingInLabel ?? 0;
    for (const key in this.current) this.writeSmoothedValue(key, target, delta, ownedElsewhere, mouth, sealing, settle, deadline, remaining);
    for (const key in target) if (this.current[key] === undefined) this.writeSmoothedValue(key, target, delta, ownedElsewhere, mouth, sealing, settle, deadline, remaining);
    /**
     * A settle target may name a channel the articulation pose does not, so the
     * settle has to be able to introduce one. Without this the mouth would decay
     * to zero and never acquire the resting posture it is settling ONTO.
     */
    if (settle) {
      for (const key in settle.target) {
        if (this.current[key] === undefined && target[key] === undefined) {
          this.writeSmoothedValue(key, target, delta, ownedElsewhere, mouth, sealing, settle, undefined, remaining);
        }
      }
    }
    const previous = this.current;
    this.current = this.smoothedPose;
    this.smoothedPose = previous;
    return this.current;
  }

  private writeSmoothedValue(
    key: string,
    target: Record<string, number>,
    delta: number,
    ownedElsewhere?: ReadonlySet<string>,
    mouth?: MouthTransitionProfile,
    sealing = false,
    settle?: MouthSettleProfile,
    /** The frame's resolved deadline policy, or `undefined` for the accepted follower. */
    deadline?: MouthDeadlineProfile,
    secondsRemaining = 0
  ) {
    if (ownedElsewhere?.has(key)) {
      const passed = clamp(target[key] ?? 0);
      this.current[key] = passed;
      if (passed > 0.0001) this.smoothedPose[key] = passed;
      return;
    }
    const region = blendshapeRegions[key] ?? "mouth";
    const from = this.current[key] ?? 0;
    /**
     * THE SENTENCE SETTLE. Inside a real sentence pause the articulation
     * channels aim at the accepted resting presence posture instead of at zero,
     * and travel there at the settle speed. Articulation channels only — brows,
     * cheeks, gaze, blink and the head never enter this branch, so the face goes
     * on being present while the mouth stops talking.
     */
    const settling = Boolean(settle) && isMouthSettleChannel(key);
    const to = settling ? settle!.target[key] ?? 0 : target[key] ?? 0;
    /**
     * THE ASYMMETRY, and the whole of it. A jaw that is RETURNING with no
     * closure demanded travels at `closeSpeed`; opening, and any real closure,
     * keep the accepted speed. A model without a profile takes the
     * byte-identical previous path.
     */
    const baselineSpeed = settling
      ? settle!.speed
      : mouth && region === "jaw"
        ? to < from && !sealing
          ? mouth.closeSpeed
          : mouth.openSpeed
        : mouth?.lipShapeSpeed !== undefined && isLipShapeChannel(key)
          ? mouth.lipShapeSpeed
          : smoothingSpeedByRegion[region];
    /**
     * THE DEADLINE FLOOR, and the whole of it. `baselineSpeed` above is
     * untouched; this can only raise it, and only for an eligible channel whose
     * demand is rising by more than the visibility floor inside a label too short
     * for the baseline to finish. `undefined` is `baselineSpeed` by identity, so
     * CURRENT mode runs the arithmetic above and nothing else.
     *
     * A SEAL FRAME IS EXEMPT. When `mouthClose` clears `sealClosureThreshold` the
     * jaw has a contact event to make and Fix G hands it back to `openSpeed`;
     * adding convergence urgency on top of that frame would be this layer
     * reaching into the closure it is forbidden to touch.
     */
    const speed =
      deadline && !settling && !sealing
        ? deadlineConvergenceSpeed(key, from, to, baselineSpeed, secondsRemaining, deadline)
        : baselineSpeed;
    if (speed !== baselineSpeed) {
      this.deadline.acceleratedChannels += 1;
      if (speed > this.deadline.peakSpeed) this.deadline.peakSpeed = speed;
    }
    const alpha = exponentialSmoothingAlpha(speed, delta);
    const value = clamp(lerp(from, to, alpha));
    if (value > 0.0001) this.smoothedPose[key] = value;
  }
}
