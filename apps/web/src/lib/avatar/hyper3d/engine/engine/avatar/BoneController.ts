import type { Bone, Object3D } from "three";
import { Euler, Quaternion } from "three";
import { BoneJerkLimiter, defaultJerkLimiter } from "./BoneJerkLimiter";
import { avatarBoneConfig } from "../../mappings/avatarBlendshapeConfig";
import { IDENTITY_BONE_AXIS_SIGN, type BoneAxisSign } from "./hyper3dRigAdapter";
import type { AvatarModelConfig } from "../../mappings/avatarModelConfig";
import type {
  BoneTransformDebugState,
  BoneTransformSnapshot,
  BoneWriterDebugState,
  HeadMotionPose,
  HeadRotationTarget
} from "../../types/facialAnimation";
import { exponentialSmoothingAlpha } from "../../utils/lerp";

interface CachedBone {
  bone: Bone;
  originalQuaternion: Quaternion;
  current: HeadRotationTarget;
  name: "Head" | "Neck";
}

const zeroRotation = (): HeadRotationTarget => ({ pitch: 0, yaw: 0, roll: 0 });
const toArray4 = (q: Quaternion): [number, number, number, number] => [q.x, q.y, q.z, q.w];
const toArray3 = (values: [number, number, number]): [number, number, number] => values;
const cloneRotation = (rotation?: HeadRotationTarget): HeadRotationTarget => ({
  pitch: rotation?.pitch ?? 0,
  yaw: rotation?.yaw ?? 0,
  roll: rotation?.roll ?? 0
});
const findBone = (root: Object3D, names: readonly string[]) => {
  let found: Bone | undefined;
  root.traverse((object) => {
    if (!found && object.type === "Bone" && names.includes(object.name)) found = object as Bone;
  });
  return found;
};

const snapshotBone = (cached: CachedBone | undefined): BoneTransformSnapshot => {
  if (!cached) {
    return {
      localPosition: [0, 0, 0],
      localEuler: [0, 0, 0],
      localQuaternion: [0, 0, 0, 1],
      worldQuaternion: [0, 0, 0, 1]
    };
  }
  cached.bone.updateMatrixWorld(true);
  const euler = new Euler().setFromQuaternion(cached.bone.quaternion, "XYZ");
  return {
    localPosition: toArray3([cached.bone.position.x, cached.bone.position.y, cached.bone.position.z]),
    localEuler: toArray3([euler.x, euler.y, euler.z]),
    localQuaternion: toArray4(cached.bone.quaternion),
    worldQuaternion: toArray4(cached.bone.getWorldQuaternion(new Quaternion()))
  };
};

/**
 * What the bone actually carries, re-expressed in SEMANTIC degrees.
 *
 * The `sign` undoes the rig convention `applyBone` wrote with (it is its own
 * inverse, being +/-1 per axis), so a rig whose bone frames are turned 180
 * degrees about Y reports the same pitch, yaw and roll as one whose are not.
 * Without it every telemetry readout, head-freeze assertion and golden
 * comparison would flip sign purely because the asset changed.
 */
const deltaFromBase = (cached: CachedBone | undefined, sign: BoneAxisSign = IDENTITY_BONE_AXIS_SIGN): HeadRotationTarget => {
  if (!cached) return zeroRotation();
  const delta = cached.originalQuaternion.clone().invert().multiply(cached.bone.quaternion);
  const euler = new Euler().setFromQuaternion(delta, "XYZ");
  return { pitch: euler.x * sign.pitch, yaw: euler.y * sign.yaw, roll: euler.z * sign.roll };
};

const cloneWriter = (writer?: BoneWriterDebugState): BoneWriterDebugState | undefined =>
  writer
    ? {
        ...writer,
        beforeQuaternion: [...writer.beforeQuaternion],
        afterQuaternion: [...writer.afterQuaternion]
      }
    : undefined;

export class BoneController {
  private head?: CachedBone;
  private neck?: CachedBone;
  /**
   * RIG CONVENTION, NOT AMPLITUDE. See `hyper3dRigAdapter`.
   *
   * Some rigs author the head and neck bone frames turned 180 degrees about Y
   * relative to world — `female_229.glb` does, the Hyper3D FBX does not — so the
   * SAME requested degrees have to be written as negated pitch and roll to
   * produce the same world motion. This is read ONLY where the quaternion is
   * finally composed, below `cached.current`, so every number the engine
   * computes, smooths, hands to `appliedDegrees()` or pins in a test is
   * identical whichever rig is loaded.
   */
  private axisSign: BoneAxisSign = IDENTITY_BONE_AXIS_SIGN;
  private frame = 0;
  private headWriter?: BoneWriterDebugState;
  private neckWriter?: BoneWriterDebugState;
  private lastTransformDebug?: BoneTransformDebugState;
  /**
   * FINAL MOTOR SPEECH. Third-order followers on the FINAL composed pose.
   *
   * Enabled per frame by `HeadMotionPose.jerkLimited`, so the legacy target-driven
   * baseline keeps its exact first-order behaviour and the A/B compares motion
   * generation rather than two different output filters.
   */
  private headLimiter = new BoneJerkLimiter();
  private neckLimiter = new BoneJerkLimiter();
  private limiterEngaged = false;
  limitations: string[] = [];

  discover(root: Object3D, config?: AvatarModelConfig) {
    this.limitations = [];
    this.axisSign = config?.boneAxisSign ?? IDENTITY_BONE_AXIS_SIGN;
    const headNames = config?.boneNames.head.length ? config.boneNames.head : avatarBoneConfig.headBoneNames;
    const neckNames = config?.boneNames.neck.length ? config.boneNames.neck : avatarBoneConfig.neckBoneNames;
    const headBone = findBone(root, headNames);
    const neckBone = findBone(root, neckNames);
    this.head = headBone ? { bone: headBone, originalQuaternion: headBone.quaternion.clone(), current: zeroRotation(), name: "Head" } : undefined;
    this.neck = neckBone ? { bone: neckBone, originalQuaternion: neckBone.quaternion.clone(), current: zeroRotation(), name: "Neck" } : undefined;
    this.headWriter = undefined;
    this.neckWriter = undefined;
    this.lastTransformDebug = undefined;
    if (!this.head) this.limitations.push("Head bone was not found; head rotation is disabled.");
    if (!this.neck) this.limitations.push("Neck bone was not found; neck rotation is disabled.");
  }

  /** The resolved head bone, for the §P15 head-mesh attachment. */
  getHeadBone() {
    return this.head?.bone;
  }

  isSupported() {
    return Boolean(this.head && this.neck);
  }

  getSupport() {
    return {
      headBone: this.head?.bone.name,
      neckBone: this.neck?.bone.name,
      headSupported: Boolean(this.head),
      neckSupported: Boolean(this.neck),
      headMotionSupport: this.head && this.neck ? "Supported" : this.head ? "Partial" : "Missing",
      limitations: [...this.limitations]
    };
  }

  apply(target: HeadMotionPose, deltaSeconds: number) {
    this.frame += 1;
    const baseHead = snapshotBone(this.head);
    const baseNeck = snapshotBone(this.neck);
    const speakingHead = target.diagnosticActive ? zeroRotation() : cloneRotation(target.speaking?.head ?? target.head);
    const speakingNeck = target.diagnosticActive ? zeroRotation() : cloneRotation(target.speaking?.neck ?? target.neck);
    const diagnosticHead = cloneRotation(target.diagnostic?.requestedHead);
    const diagnosticNeck = cloneRotation(target.diagnostic?.requestedNeck);

    if (!this.isSupported() || !target.active) {
      this.applyBone(this.head, zeroRotation(), deltaSeconds, false, "BoneController.apply:inactive");
      this.applyBone(this.neck, zeroRotation(), deltaSeconds, false, "BoneController.apply:inactive");
      this.updateTransformDebug(target, baseHead, baseNeck, speakingHead, speakingNeck, diagnosticHead, diagnosticNeck);
      return false;
    }
    const direct = Boolean(target.diagnosticActive);
    /**
     * Engaging the limiter seeds it from wherever the bone already is, so
     * switching filters cannot itself be the discontinuity it exists to prevent.
     */
    const limited = Boolean(target.jerkLimited) && !direct;
    if (limited && !this.limiterEngaged) {
      this.headLimiter.seed(this.head?.current ?? zeroRotation());
      this.neckLimiter.seed(this.neck?.current ?? zeroRotation());
      this.limiterEngaged = true;
    } else if (!limited && this.limiterEngaged) {
      // Handing back: the first-order path resumes from the limiter's pose.
      this.limiterEngaged = false;
    }
    const writer = direct ? "HeadNeckTransformDiagnostic->BoneController.apply" : "HeadMotionController->BoneController.apply";
    this.applyBone(this.head, target.head, deltaSeconds, direct, writer, limited ? this.headLimiter : undefined, target.owner, target.headVelocity, target.headAcceleration);
    this.applyBone(this.neck, target.neck, deltaSeconds, direct, writer, limited ? this.neckLimiter : undefined, target.owner, target.neckVelocity, target.neckAcceleration);
    this.updateTransformDebug(target, baseHead, baseNeck, speakingHead, speakingNeck, diagnosticHead, diagnosticNeck);
    return true;
  }

  reset() {
    this.frame += 1;
    this.headLimiter.reset();
    this.neckLimiter.reset();
    this.limiterEngaged = false;
    this.resetBone(this.head);
    this.resetBone(this.neck);
    this.lastTransformDebug = undefined;
  }

  captureBeforeSceneRender() {
    if (!this.lastTransformDebug) return undefined;
    this.lastTransformDebug.head.afterAllAvatarControllers = snapshotBone(this.head);
    this.lastTransformDebug.neck.afterAllAvatarControllers = snapshotBone(this.neck);
    this.lastTransformDebug.head.beforeSceneRender = snapshotBone(this.head);
    this.lastTransformDebug.neck.beforeSceneRender = snapshotBone(this.neck);
    this.lastTransformDebug.head.deltaFromBase = deltaFromBase(this.head, this.axisSign);
    this.lastTransformDebug.neck.deltaFromBase = deltaFromBase(this.neck, this.axisSign);
    return this.lastTransformDebug;
  }

  getLastTransformDebug() {
    return this.lastTransformDebug;
  }

  /**
   * Live derivatives of the FINAL composed bone, in degrees.
   *
   * Measured here rather than inside a motion controller because this is the
   * transform the hardware actually renders — every earlier pass that measured
   * an internal layer reported a smooth number for a visibly rough result.
   */
  motionMetrics() {
    if (!this.limiterEngaged) return null;
    return { head: this.headLimiter.metrics(), neck: this.neckLimiter.metrics() };
  }

  /**
   * STAGE 2.3 — what the bones ACTUALLY carry, in degrees.
   *
   * Measured off each bone's own quaternion as a delta from the rest pose it was
   * discovered with, so it reports the rendered rotation rather than the request
   * that produced it. Everything upstream — the planner pose, the rig shares,
   * the follower target — can agree with each other and still disagree with the
   * bone; this is the only number that cannot.
   */
  appliedDegrees() {
    const RAD = 180 / Math.PI;
    const toDegrees = (r: HeadRotationTarget) => ({ yaw: r.yaw * RAD, pitch: r.pitch * RAD, roll: r.roll * RAD });
    return { head: toDegrees(deltaFromBase(this.head, this.axisSign)), neck: toDegrees(deltaFromBase(this.neck, this.axisSign)) };
  }

  /** Final head orientation and angular velocity, for the idle/speaking handover. */
  headMotionState() {
    return this.limiterEngaged
      ? { orientation: this.headLimiter.current(), velocity: this.headLimiter.velocity() }
      : { orientation: this.head?.current ?? zeroRotation(), velocity: zeroRotation() };
  }

  private applyBone(
    cached: CachedBone | undefined,
    target: HeadRotationTarget,
    deltaSeconds: number,
    direct: boolean,
    writer: string,
    limiter?: BoneJerkLimiter,
    owner?: string,
    /** Rate the target is itself moving at, rad/s. Fed forward; see `BoneJerkLimiter.step`. */
    targetVelocity?: HeadRotationTarget,
    /** Rate the target's velocity is itself changing at, rad/s^2. Fed forward. */
    targetAcceleration?: HeadRotationTarget
  ) {
    if (!cached) return;
    const before = cached.bone.quaternion.clone();
    if (direct) {
      cached.current = cloneRotation(target);
    } else if (limiter) {
      /**
       * Third-order in place of the first-order follower below.
       *
       * The exponential smoothing this replaces bounds POSITION only: a step in
       * the composed target becomes an instantaneous velocity change, i.e.
       * unbounded acceleration and jerk. It plots as a smooth angle and renders
       * as a snap. Here acceleration is rate-limited, so jerk is bounded by
       * construction and no upstream discontinuity — a mode switch, a controller
       * handover, a target step — can reach the bone as one.
       */
      cached.current = { ...limiter.step(target, deltaSeconds, defaultJerkLimiter, targetVelocity, targetAcceleration) };
    } else {
      const alpha = exponentialSmoothingAlpha(avatarBoneConfig.smoothingSpeed, deltaSeconds);
      cached.current = {
        pitch: cached.current.pitch + (target.pitch - cached.current.pitch) * alpha,
        yaw: cached.current.yaw + (target.yaw - cached.current.yaw) * alpha,
        roll: cached.current.roll + (target.roll - cached.current.roll) * alpha
      };
    }
    // The ONLY place the rig's axis convention is applied. `cached.current` above
    // stays in semantic degrees on every asset.
    const sign = this.axisSign;
    const additive = new Quaternion().setFromEuler(
      new Euler(cached.current.pitch * sign.pitch, cached.current.yaw * sign.yaw, cached.current.roll * sign.roll, "XYZ")
    );
    cached.bone.quaternion.copy(cached.originalQuaternion).multiply(additive).normalize();
    const record: BoneWriterDebugState = {
      boneName: cached.name,
      writer,
      owner,
      timestamp: performance.now(),
      frame: this.frame,
      beforeQuaternion: toArray4(before),
      afterQuaternion: toArray4(cached.bone.quaternion)
    };
    if (cached.name === "Head") this.headWriter = record;
    else this.neckWriter = record;
  }

  private resetBone(cached: CachedBone | undefined) {
    if (!cached) return;
    const before = cached.bone.quaternion.clone();
    cached.current = zeroRotation();
    cached.bone.quaternion.copy(cached.originalQuaternion);
    const record: BoneWriterDebugState = {
      boneName: cached.name,
      writer: "BoneController.reset",
      timestamp: performance.now(),
      frame: this.frame,
      beforeQuaternion: toArray4(before),
      afterQuaternion: toArray4(cached.bone.quaternion)
    };
    if (cached.name === "Head") this.headWriter = record;
    else this.neckWriter = record;
  }

  private updateTransformDebug(
    target: HeadMotionPose,
    baseHead: BoneTransformSnapshot,
    baseNeck: BoneTransformSnapshot,
    speakingHead: HeadRotationTarget,
    speakingNeck: HeadRotationTarget,
    diagnosticHead: HeadRotationTarget,
    diagnosticNeck: HeadRotationTarget
  ) {
    const headAfter = snapshotBone(this.head);
    const neckAfter = snapshotBone(this.neck);
    this.lastTransformDebug = {
      eulerOrder: "XYZ",
      requestedHead: cloneRotation(target.head),
      requestedNeck: cloneRotation(target.neck),
      speakingHead,
      speakingNeck,
      diagnosticHead,
      diagnosticNeck,
      head: {
        base: baseHead,
        afterAuthoredAnimation: baseHead,
        afterIdleContribution: baseHead,
        afterSpeakingContribution: target.diagnosticActive ? baseHead : headAfter,
        afterDiagnosticContribution: target.diagnosticActive ? headAfter : baseHead,
        afterBoneControllerComposition: headAfter,
        afterAllAvatarControllers: headAfter,
        beforeSceneRender: headAfter,
        deltaFromBase: deltaFromBase(this.head, this.axisSign),
        finalWriter: cloneWriter(this.headWriter)
      },
      neck: {
        base: baseNeck,
        afterAuthoredAnimation: baseNeck,
        afterIdleContribution: baseNeck,
        afterSpeakingContribution: target.diagnosticActive ? baseNeck : neckAfter,
        afterDiagnosticContribution: target.diagnosticActive ? neckAfter : baseNeck,
        afterBoneControllerComposition: neckAfter,
        afterAllAvatarControllers: neckAfter,
        beforeSceneRender: neckAfter,
        deltaFromBase: deltaFromBase(this.neck, this.axisSign),
        finalWriter: cloneWriter(this.neckWriter)
      }
    };
  }
}
