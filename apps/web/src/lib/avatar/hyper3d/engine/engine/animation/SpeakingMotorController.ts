import type { MotorDrive } from "./SpeechPerformanceConductor";

/**
 * FINAL MOTOR SPEECH — the head has momentum, and speech shapes it.
 *
 * Every speaking pass up to and including FINAL CONVERGENCE generated motion the
 * same way: pick a target angle for an anchor, ease toward it, ease back, pick
 * the next one. Easing makes the POSITION smooth. It does not make the INTENTION
 * smooth — the destination still changes discontinuously — and that is what the
 * hardware review kept reading as an animation clip: a gesture starts, a gesture
 * ends, the head waits, another gesture starts.
 *
 * There are no targets here. There is a persistent motor state that never
 * restarts, and speech applies FORCES to it:
 *
 *     drive -> desired acceleration -> jerk limit -> acceleration
 *           -> velocity -> orientation
 *
 * Three consequences follow structurally rather than by tuning:
 *
 *   NO NOD EVENTS. A nod is what it looks like when pitch acceleration goes
 *   negative, the head commits, and momentum dissipates. Nothing schedules
 *   NOD_START. The drive is the TIME DERIVATIVE of the emphasis envelope, which
 *   is naturally bipolar — accelerate into the commitment, decelerate out of it.
 *
 *   NO RETURN TO NEUTRAL. The spring pulls toward `rest`, and `rest` is not
 *   centre. It is a slow low-pass of where the head has actually been, drawn
 *   toward a per-clause bias, so recovery dissipates momentum INTO the evolving
 *   phrase posture. Clause B starts from wherever clause A finished.
 *
 *   NO FROZEN SECTIONS. Between anchors the state still has residual velocity
 *   and a rest orientation that is still moving, so the head is never
 *   mathematically stationary without any filler being injected.
 *
 * Deliberately NOT a spring-to-target with extra steps: the spring is the weak
 * term. Its job is to stop the integrator drifting, not to place the head.
 */

export interface MotorAxisState {
  orientation: number;
  velocity: number;
  acceleration: number;
  rest: number;
}

export interface MotorState {
  pitch: MotorAxisState;
  yaw: MotorAxisState;
  roll: MotorAxisState;
}

export interface MotorTuning {
  id: string;
  label: string;
  /** Pull toward the evolving rest, in rad/s^2 per rad. Weak by design. */
  stiffness: number;
  /** Velocity damping, 1/s. Sets how long momentum survives. */
  damping: number;
  /** Jerk ceiling at the motor stage, deg/s^3. The bone stage limits again. */
  maxJerkDegrees: number;
  /** Hard bounds on the integrator, in degrees. */
  limitPitchDegrees: number;
  limitYawDegrees: number;
  limitRollDegrees: number;
  /** Drive gain per axis, deg/s^2 at unit drive. */
  pitchDrive: number;
  yawDrive: number;
  rollDrive: number;
  /**
   * How fast `rest` follows where the head has been, 1/s.
   *
   * Raised from 0.38 after measurement: at the original rates the rest was still
   * near centre four seconds into the utterance, so the head genuinely came to
   * a stop at zero between the first three anchor pairs — a return to neutral,
   * just a slow one. These give time constants of roughly 1.6-2 s, which is slow
   * enough to stay postural and fast enough that a posture exists by the second
   * clause.
   */
  restCapture: number;
  /** How fast `rest` is drawn toward the clause bias, 1/s. */
  restBias: number;
  /** Bound on the evolving rest, in degrees. */
  restLimitDegrees: number;
  /** Extra damping applied while settling in a pause. */
  settleDamping: number;
  /** Share of the low-frequency component the neck carries. */
  neckShare: number;
  /** Neck low-pass corner, 1/s. Lower means the neck carries slower motion. */
  neckFollow: number;
}

export const motorTunings = {
  natural: {
    id: "natural", label: "Motor",
    stiffness: 5.5, damping: 3.1, maxJerkDegrees: 900,
    limitPitchDegrees: 3.4, limitYawDegrees: 2.8, limitRollDegrees: 1.8,
    pitchDrive: 30, yawDrive: 13, rollDrive: 14,
    restCapture: 0.62, restBias: 0.5, restLimitDegrees: 1.5,
    settleDamping: 2.2, neckShare: 0.42, neckFollow: 1.5
  },
  strong: {
    id: "strong", label: "Motor strong",
    stiffness: 5.2, damping: 2.9, maxJerkDegrees: 1300,
    limitPitchDegrees: 4.6, limitYawDegrees: 3.6, limitRollDegrees: 2.4,
    pitchDrive: 44, yawDrive: 19, rollDrive: 20,
    restCapture: 0.68, restBias: 0.55, restLimitDegrees: 2,
    settleDamping: 2, neckShare: 0.45, neckFollow: 1.6
  }
} satisfies Record<string, MotorTuning>;

export type MotorTuningId = keyof typeof motorTunings;

export interface MotorOutput {
  /** Head orientation in RADIANS, ready to compose. */
  head: { pitch: number; yaw: number; roll: number };
  neck: { pitch: number; yaw: number; roll: number };
  /** Live state, for the review panel and the diagnostics. */
  state: MotorState;
  /** Degrees per second, magnitude across the three axes. */
  speedDegrees: number;
  /** The drive that produced this frame, for the readout. */
  drive: MotorDrive;
}

const DEG = Math.PI / 180;
const clampTo = (v: number, limit: number) => (v < -limit ? -limit : v > limit ? limit : v);

const zeroAxis = (): MotorAxisState => ({ orientation: 0, velocity: 0, acceleration: 0, rest: 0 });

export class SpeakingMotorController {
  private state: MotorState = { pitch: zeroAxis(), yaw: zeroAxis(), roll: zeroAxis() };
  private neck = { pitch: 0, yaw: 0, roll: 0 };
  private lastDrive: MotorDrive = {
    pitch: 0, yaw: 0, roll: 0, biasPitch: 0, biasYaw: 0, biasRoll: 0,
    emphasisImpulse: 0, continuation: 0, settle: 0, urgency: 0.5
  };

  /**
   * Seeds the motor from whatever the head was already doing.
   *
   * Speech onset must not be the start of an animation. The idle layer hands
   * over its current orientation and velocity and the integrator continues from
   * there, so there is nothing to snap: no zeroed velocity, no jump to a
   * speaking rest pose. `rest` is seeded to the current orientation for the same
   * reason — a fresh rest of 0 would apply a spring force on the first frame.
   */
  adopt(orientation: { pitch: number; yaw: number; roll: number }, velocity: { pitch: number; yaw: number; roll: number }) {
    for (const axis of ["pitch", "yaw", "roll"] as const) {
      this.state[axis] = {
        orientation: orientation[axis],
        velocity: velocity[axis],
        acceleration: 0,
        rest: orientation[axis]
      };
    }
    this.neck = { ...orientation };
  }

  /**
   * Integrates with no drive while speech is over but motion is not.
   *
   * Full settling damping, and `rest` is drawn toward neutral so the motor
   * arrives at zero rather than being switched off at whatever pose it held.
   * The idle layer fades in over the same interval, so ownership changes hands
   * while both sides are near zero and there is nothing to snap.
   */
  release(deltaSeconds: number, tuning: MotorTuning): MotorOutput {
    const dt = Math.max(1e-4, Math.min(0.1, deltaSeconds));
    const decay = 1 - Math.exp(-3 * dt);
    for (const axis of ["pitch", "yaw", "roll"] as const) this.state[axis].rest *= 1 - decay;
    /**
     * Release runs a stiffer, still critically damped system than speech does.
     *
     * The speaking spring is deliberately weak — its job is to stop the
     * integrator drifting, not to place the head — and at that stiffness the
     * motor was still 0.48 deg from neutral after the 2.5 s release window, so
     * handing back to the idle layer produced a residual step. Raising stiffness
     * 2.5x shortens the settling time constant to about 0.27 s; damping is
     * raised with it (2*sqrt(k)) so the extra stiffness cannot introduce an
     * overshoot, which would be a new wobble in place of the old step.
     */
    const releaseTuning: MotorTuning = {
      ...tuning,
      stiffness: tuning.stiffness * 2.5,
      damping: 2 * Math.sqrt(tuning.stiffness * 2.5),
      settleDamping: 0
    };
    return this.update(dt, {
      pitch: 0, yaw: 0, roll: 0,
      biasPitch: 0, biasYaw: 0, biasRoll: 0,
      emphasisImpulse: 0, continuation: 0, settle: 1, urgency: 0.35
    }, releaseTuning);
  }

  /** Everything the idle layer needs to continue this motion after speech. */
  handoff() {
    return {
      orientation: { pitch: this.state.pitch.orientation, yaw: this.state.yaw.orientation, roll: this.state.roll.orientation },
      velocity: { pitch: this.state.pitch.velocity, yaw: this.state.yaw.velocity, roll: this.state.roll.velocity }
    };
  }

  reset() {
    this.state = { pitch: zeroAxis(), yaw: zeroAxis(), roll: zeroAxis() };
    this.neck = { pitch: 0, yaw: 0, roll: 0 };
  }

  current() {
    return this.state;
  }

  /**
   * One integration step.
   *
   * @param drive continuous motor influence from the conductor and prosody.
   *   NOT an angle, and never treated as one.
   */
  update(deltaSeconds: number, drive: MotorDrive, tuning: MotorTuning): MotorOutput {
    const dt = Math.max(1e-4, Math.min(0.1, deltaSeconds));
    this.lastDrive = drive;
    const limits = {
      pitch: tuning.limitPitchDegrees * DEG,
      yaw: tuning.limitYawDegrees * DEG,
      roll: tuning.limitRollDegrees * DEG
    };
    const gains = { pitch: tuning.pitchDrive * DEG, yaw: tuning.yawDrive * DEG, roll: tuning.rollDrive * DEG };
    const bias = { pitch: drive.biasPitch * DEG, yaw: drive.biasYaw * DEG, roll: drive.biasRoll * DEG };
    const driveByAxis = { pitch: drive.pitch, yaw: drive.yaw, roll: drive.roll };
    const restLimit = tuning.restLimitDegrees * DEG;

    /**
     * Urgency scales the jerk ceiling, not the amplitude.
     *
     * A rapid, emphatic delivery is allowed to change its acceleration faster
     * than a slow one — that is what "how quickly it is physically delivered"
     * means mechanically. It cannot make the head go further, because the
     * integrator limits are fixed.
     */
    const maxJerk = tuning.maxJerkDegrees * DEG * (0.65 + 0.7 * drive.urgency);
    const maxJerkStep = maxJerk * dt;
    // Settling raises damping instead of pulling harder toward rest: momentum
    // dissipates rather than being cancelled.
    const damping = tuning.damping + tuning.settleDamping * drive.settle;

    for (const axis of ["pitch", "yaw", "roll"] as const) {
      const s = this.state[axis];

      /**
       * The rest orientation evolves.
       *
       * Two slow terms, both bounded and both deterministic — no oscillator, no
       * noise. `restCapture` lets the posture the head has actually adopted
       * become the place it settles, which is what makes recovery read as
       * "coming to rest here" instead of "returning to centre". `restBias`
       * draws it toward the clause's own orientation bias, so a new thought
       * moves the whole posture rather than adding a gesture on top of it.
       */
      const restTarget = bias[axis];
      s.rest += ((s.orientation - s.rest) * tuning.restCapture + (restTarget - s.rest) * tuning.restBias) * dt;
      s.rest = clampTo(s.rest, restLimit);

      /**
       * Desired acceleration. The drive term is the whole point; the spring is
       * weak and exists only to keep the integrator from wandering off.
       */
      const spring = tuning.stiffness * (s.rest - s.orientation);
      const desired = spring - damping * s.velocity + driveByAxis[axis] * gains[axis];

      // Jerk limit: acceleration may not step, so the third derivative is bounded
      // by construction rather than by choosing a nice-looking curve.
      const delta = desired - s.acceleration;
      s.acceleration += delta < -maxJerkStep ? -maxJerkStep : delta > maxJerkStep ? maxJerkStep : delta;

      s.velocity += s.acceleration * dt;
      s.orientation += s.velocity * dt;

      /**
       * Hitting the bound bleeds velocity off rather than clamping position and
       * leaving the integrator wound up — a clamped position with a live inward
       * velocity is exactly how a system produces a visible stick-then-jump.
       */
      if (s.orientation > limits[axis]) {
        s.orientation = limits[axis];
        if (s.velocity > 0) { s.velocity *= 0.2; s.acceleration = Math.min(s.acceleration, 0); }
      } else if (s.orientation < -limits[axis]) {
        s.orientation = -limits[axis];
        if (s.velocity < 0) { s.velocity *= 0.2; s.acceleration = Math.max(s.acceleration, 0); }
      }
    }

    /**
     * The neck is not a second gesture generator.
     *
     * It is a low-pass of the SAME motor state, so the head naturally carries
     * the fast, small movement and the neck carries the slow, large orientation
     * evolution — which is the physical chain the brief asks for, obtained
     * without a second scheduler or a second set of amplitudes.
     */
    const a = 1 - Math.exp(-tuning.neckFollow * dt);
    this.neck.pitch += (this.state.pitch.orientation - this.neck.pitch) * a;
    this.neck.yaw += (this.state.yaw.orientation - this.neck.yaw) * a;
    this.neck.roll += (this.state.roll.orientation - this.neck.roll) * a;

    const speed = Math.hypot(this.state.pitch.velocity, this.state.yaw.velocity, this.state.roll.velocity) / DEG;
    return {
      head: {
        pitch: this.state.pitch.orientation,
        yaw: this.state.yaw.orientation,
        roll: this.state.roll.orientation
      },
      neck: {
        pitch: this.neck.pitch * tuning.neckShare,
        yaw: this.neck.yaw * tuning.neckShare,
        roll: this.neck.roll * tuning.neckShare * 0.6
      },
      state: this.state,
      speedDegrees: speed,
      drive: this.lastDrive
    };
  }
}
