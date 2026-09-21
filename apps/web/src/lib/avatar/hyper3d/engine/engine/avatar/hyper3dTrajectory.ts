/**
 * HYPER3D FINAL SPEAKING PERFORMANCE — the one trajectory solver.
 *
 * There is exactly one interpolation in the speaking-head architecture, and it
 * is this one. MOVE, gesture downstroke, gesture return and SETTLE are all the
 * same quintic point-to-point solve with different endpoints and durations. No
 * second easing function exists in the head path, so no two motions can have
 * different character by accident.
 *
 *   s(u)  = 10u^3 - 15u^4 + 6u^5
 *   P(t)  = P0 + (P1 - P0) * s(u)
 *   u     = clamp((t - t0) / duration, 0, 1)
 *
 * Why quintic and not the cubic smoothstep the earlier passes used: at both
 * endpoints s'(0) = s'(1) = 0 AND s''(0) = s''(1) = 0. Velocity and
 * acceleration are therefore zero at every segment boundary, so concatenated
 * segments join with continuous acceleration and bounded jerk by construction.
 * A cubic smoothstep leaves s''(0) = 6 and s''(1) = -6, which is an acceleration
 * step at every join — that is the discontinuity the hardware reads as a snap.
 *
 * Velocity and acceleration are returned ANALYTICALLY from s'(u) and s''(u)
 * rather than finite-differenced, so the instrumentation reports the trajectory's
 * own derivatives and not a sampling artefact.
 */

export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
}

export const POSE_AXES = ["yaw", "pitch", "roll"] as const;
export type PoseAxis = (typeof POSE_AXES)[number];

export const neutralPose = (): HeadPose => ({ yaw: 0, pitch: 0, roll: 0 });
export const clonePose = (pose: HeadPose): HeadPose => ({ yaw: pose.yaw, pitch: pose.pitch, roll: pose.roll });

/** P0 + (P1 - P0) * f, per axis. */
export const lerpPose = (from: HeadPose, to: HeadPose, f: number): HeadPose => ({
  yaw: from.yaw + (to.yaw - from.yaw) * f,
  pitch: from.pitch + (to.pitch - from.pitch) * f,
  roll: from.roll + (to.roll - from.roll) * f
});

export const poseDelta = (from: HeadPose, to: HeadPose): HeadPose => ({
  yaw: to.yaw - from.yaw,
  pitch: to.pitch - from.pitch,
  roll: to.roll - from.roll
});

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** s(u) = 10u^3 - 15u^4 + 6u^5. */
export const quinticS = (u: number) => {
  const k = clamp01(u);
  return k * k * k * (10 - 15 * k + 6 * k * k);
};

/** ds/du = 30u^2 - 60u^3 + 30u^4. Zero at u = 0 and u = 1. */
export const quinticVelocity = (u: number) => {
  if (u <= 0 || u >= 1) return 0;
  return 30 * u * u * (1 - 2 * u + u * u);
};

/** d2s/du2 = 60u - 180u^2 + 120u^3. Zero at u = 0 and u = 1. */
export const quinticAcceleration = (u: number) => {
  if (u <= 0 || u >= 1) return 0;
  return 60 * u - 180 * u * u + 120 * u * u * u;
};

export const trajectoryProgress = (t: number, t0: number, duration: number) =>
  duration <= 0 ? 1 : clamp01((t - t0) / duration);

export interface Trajectory {
  t0: number;
  duration: number;
  from: HeadPose;
  to: HeadPose;
}

export interface TrajectorySample {
  pose: HeadPose;
  /** Degrees per second, per axis. */
  velocity: HeadPose;
  /** Degrees per second squared, per axis. */
  acceleration: HeadPose;
  progress: number;
}

/**
 * Samples one trajectory at an absolute clock.
 *
 * Outside [t0, t0 + duration] the pose is held at the nearer endpoint with zero
 * derivatives, which is what makes HOLD exactly still rather than approximately
 * still.
 */
export const sampleTrajectory = (trajectory: Trajectory, t: number): TrajectorySample => {
  const { t0, duration, from, to } = trajectory;
  const u = trajectoryProgress(t, t0, duration);
  const s = quinticS(u);
  const delta = poseDelta(from, to);
  const dv = duration > 0 ? quinticVelocity(u) / duration : 0;
  const da = duration > 0 ? quinticAcceleration(u) / (duration * duration) : 0;
  return {
    pose: lerpPose(from, to, s),
    velocity: { yaw: delta.yaw * dv, pitch: delta.pitch * dv, roll: delta.roll * dv },
    acceleration: { yaw: delta.yaw * da, pitch: delta.pitch * da, roll: delta.roll * da },
    progress: u
  };
};

/** The pose a trajectory ends on. Used to seed the next one from the real pose. */
export const trajectoryEndPose = (trajectory: Trajectory): HeadPose => clonePose(trajectory.to);
