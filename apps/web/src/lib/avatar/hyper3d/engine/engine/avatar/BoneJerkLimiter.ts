/**
 * FINAL MOTOR SPEECH — the last thing before the bone.
 *
 * Every earlier pass smoothed inside a controller and then trusted the result.
 * That is not sufficient, and P18.1 already proved why once: a layer can be
 * perfectly smooth on its own and still produce a visible snap after it is
 * composed with the idle layer, the neck compensation and the speaking/idle
 * handover. The hardware sees the FINAL BONE, so the final bone is where the
 * bound has to be enforced.
 *
 * What `BoneController` did before was `exponentialSmoothingAlpha`, a
 * FIRST-ORDER follower. It bounds nothing above position: a step in the target
 * produces an instantaneous velocity jump, which is unbounded acceleration and
 * therefore unbounded jerk. It looks smooth plotted as an angle and is a snap on
 * screen.
 *
 * This is third order. Acceleration is rate-limited, so:
 *
 *     jerk    bounded by construction (the rate limit IS the jerk bound)
 *     accel   continuous
 *     vel     C1
 *     pos     C2
 *
 * A mode switch, a controller handover or a target step can therefore no longer
 * produce a discontinuity downstream of this point — the worst it can do is ask
 * for an acceleration the limiter takes several frames to reach.
 */

export interface JerkLimitedAxis {
  position: number;
  velocity: number;
  acceleration: number;
}

export interface JerkLimiterConfig {
  /** Tracking stiffness, 1/s^2. Sets how hard the follower chases the target. */
  stiffness: number;
  /** Maximum change in acceleration, rad/s^3. This is the jerk bound. */
  maxJerk: number;
}

/**
 * Tuned against the first-order behaviour it replaces.
 *
 * `avatarBoneConfig.smoothingSpeed` is 10, a 0.1 s time constant. A critically
 * damped second-order system with omega = 10 settles in comparable time, so
 * stiffness is omega^2 = 100 and the damping term below is 2*omega. Tracking
 * fidelity is therefore preserved; only the derivative bounds are added.
 *
 * The jerk ceiling is deliberately generous. It is a SAFETY BOUND against
 * discontinuity, not a smoothing knob — clamping it low would drag the head and
 * reintroduce the sluggishness P13 and P17 spent two passes removing. Measured
 * p95 jerk on the motor path sits well under it; it exists to catch the spikes.
 */
export const defaultJerkLimiter: JerkLimiterConfig = {
  stiffness: 100,
  /**
   * 60 rad/s^3, about 3440 deg/s^3.
   *
   * Set from measurement, not taste. On the composed bone the motor path's p95
   * jerk is ~1050 deg/s^3 and its median ~50, so this leaves better than 3x
   * headroom over normal motion while sitting BELOW the 4000 deg/s^3 threshold
   * at which a change of acceleration reads as a snap. A first value of 220
   * rad/s^3 (~12,600 deg/s^3) was too loose to catch anything: it let 6 spikes
   * through, peaking at 5349.
   *
   * It is a safety bound against discontinuity, not a smoothing knob. Dropping
   * it far lower would drag the head and undo the response work of P13 and P17.
   */
  maxJerk: 60
};

const zeroAxis = (): JerkLimitedAxis => ({ position: 0, velocity: 0, acceleration: 0 });

export interface JerkLimiterMetrics {
  /** Degrees per second, per axis and combined. */
  velocityDegrees: number;
  accelerationDegrees: number;
  jerkDegrees: number;
}

const DEG = 180 / Math.PI;

/**
 * A three-axis jerk-limited follower.
 *
 * Stateful, and must be: bounding a third derivative requires remembering the
 * second. `seed()` exists so the state can be adopted rather than restarted when
 * ownership of the bone changes hands.
 */
export class BoneJerkLimiter {
  private axes = { pitch: zeroAxis(), yaw: zeroAxis(), roll: zeroAxis() };
  private lastJerk = { pitch: 0, yaw: 0, roll: 0 };

  /** Adopt a pose without implying it was arrived at with any velocity. */
  seed(pose: { pitch: number; yaw: number; roll: number }) {
    for (const axis of ["pitch", "yaw", "roll"] as const) {
      this.axes[axis] = { position: pose[axis], velocity: 0, acceleration: 0 };
    }
  }

  reset() {
    this.axes = { pitch: zeroAxis(), yaw: zeroAxis(), roll: zeroAxis() };
    this.lastJerk = { pitch: 0, yaw: 0, roll: 0 };
  }

  current() {
    return {
      pitch: this.axes.pitch.position,
      yaw: this.axes.yaw.position,
      roll: this.axes.roll.position
    };
  }

  velocity() {
    return {
      pitch: this.axes.pitch.velocity,
      yaw: this.axes.yaw.velocity,
      roll: this.axes.roll.velocity
    };
  }

  /**
   * STAGE 2.3 — MODEL-FOLLOWING FEED-FORWARD.
   *
   * `targetVelocity` (rad/s) and `targetAcceleration` (rad/s^2) are what the
   * TARGET is itself doing this frame. With both supplied the commanded
   * acceleration becomes
   *
   *     a = a_target + k*(x_target - x) - c*(v - v_target)
   *
   * so the error dynamics are `e'' + c e' + k e = 0`: unforced, critically
   * damped, decaying to zero. The follower reproduces the trajectory instead of
   * chasing it, which means no steady-state lag on a ramp AND no transient
   * overshoot at a turn. Velocity alone removes the lag but leaves the target's
   * acceleration as an unmodelled disturbance, which measured as a 6% overshoot
   * at the gesture apex — a new bounce in place of the old one.
   *
   * Why this was needed. This follower is critically damped at omega = 10, so
   * tracking anything that moves costs about 2/omega of lag. Measured on
   * test-005 through the real `BoneController`, the Hyper3D head lagged its own
   * planned trajectory by 167 ms and the forced 2.40 deg gesture reached the
   * bone at 1.03 deg at its apex, peaking at 1.39 deg 150 ms LATE and then
   * decaying for another half second. The planner's crisp nod arrived as a slow
   * smear — "the gesture is not clearly visible" and "it does not settle
   * cleanly", from an output filter rather than from an amplitude.
   *
   * The jerk ceiling is untouched and still binds, so this removes the lag
   * without weakening the safety bound: a STEP in the target still has no
   * velocity to feed forward and is still rate-limited exactly as before.
   *
   * Omitting both arguments reproduces the previous behaviour bit for bit, which
   * is why the female and legacy paths pass nothing: their targets are composed
   * per frame and have no closed-form derivatives to offer.
   */
  step(
    target: { pitch: number; yaw: number; roll: number },
    deltaSeconds: number,
    config: JerkLimiterConfig = defaultJerkLimiter,
    targetVelocity?: { pitch: number; yaw: number; roll: number },
    targetAcceleration?: { pitch: number; yaw: number; roll: number }
  ) {
    const dt = Math.max(1e-4, Math.min(0.1, deltaSeconds));
    const damping = 2 * Math.sqrt(config.stiffness);
    const maxStep = config.maxJerk * dt;
    for (const axis of ["pitch", "yaw", "roll"] as const) {
      const a = this.axes[axis];
      const velocityFF = targetVelocity?.[axis] ?? 0;
      const accelerationFF = targetAcceleration?.[axis] ?? 0;
      const desired =
        accelerationFF + config.stiffness * (target[axis] - a.position) - damping * (a.velocity - velocityFF);
      const delta = desired - a.acceleration;
      const applied = delta < -maxStep ? -maxStep : delta > maxStep ? maxStep : delta;
      this.lastJerk[axis] = applied / dt;
      a.acceleration += applied;
      a.velocity += a.acceleration * dt;
      a.position += a.velocity * dt;
    }
    return this.current();
  }

  /** Live derivatives in degrees, magnitude across the three axes. */
  metrics(): JerkLimiterMetrics {
    const { pitch, yaw, roll } = this.axes;
    return {
      velocityDegrees: Math.hypot(pitch.velocity, yaw.velocity, roll.velocity) * DEG,
      accelerationDegrees: Math.hypot(pitch.acceleration, yaw.acceleration, roll.acceleration) * DEG,
      jerkDegrees: Math.hypot(this.lastJerk.pitch, this.lastJerk.yaw, this.lastJerk.roll) * DEG
    };
  }
}
