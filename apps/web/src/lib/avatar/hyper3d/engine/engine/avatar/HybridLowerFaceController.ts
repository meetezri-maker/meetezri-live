import type { Bone, Object3D } from "three";
import { Quaternion, Vector3 } from "three";
import {
  femaleUpperLipProfile,
  resolveUpperLipDrive,
  type FemaleUpperLipProfile,
  type LowerFaceMode,
  type UpperLipDrive
} from "../../mappings/femaleLowerFaceProfile";
import {
  femaleHybridJawProfile,
  type FemaleHybridJawProfile,
  type HybridJawMode
} from "../../mappings/femaleHybridJawProfile";
import { HybridJawController, type HybridJawFrame, type HybridJawSupport } from "./HybridJawController";
import { exponentialSmoothingAlpha } from "../../utils/lerp";

export interface LowerFaceSupport {
  jaw: HybridJawSupport;
  upperLip: { bone: string; found: boolean };
  /** True when the jaw pair resolved. The upper lip can be supported alone. */
  jawSupported: boolean;
  upperLipSupported: boolean;
  limitations: string[];
}

export interface LowerFaceFrame {
  mode: LowerFaceMode;
  jaw: HybridJawFrame;
  upperLip: UpperLipDrive & { active: boolean; boneName: string };
  /** The `jawOpen` influence that should be written after the split. */
  correctiveJawOpen: number;
  /** True when any bone was moved this frame. */
  active: boolean;
}

const axisVector = (axis: "x" | "y" | "z") =>
  new Vector3(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0);

const findBone = (root: Object3D, name: string) => {
  let found: Bone | undefined;
  root.traverse((object) => {
    if (!found && object.type === "Bone" && object.name === name) found = object as Bone;
  });
  return found;
};

/**
 * The one owner of every lower-face bone. PROTOTYPE, `morph-only` by default.
 *
 * Two mechanisms live here rather than in two controllers, because the §6
 * multiple-writer problem was expensive to solve once and putting the jaw and
 * the upper lip behind separate owners is how it would come back. Nothing else
 * in the codebase may write `FACIAL_C_Jaw`, `FACIAL_C_LowerLipRotation` or
 * `FACIAL_C_MouthUpper`: not the behaviour layer, not the emotion blender, not
 * the cue channel.
 *
 * Both mechanisms are pure functions of their per-frame demand, so neither can
 * lag the morphs or each other. The controller does hold one piece of state —
 * the rest quaternions captured at discovery — and it poses every bone it owns
 * on every frame, including back to rest. That reset contract is the one thing
 * bones need that morph channels do not: an unwritten morph channel falls to
 * zero by itself, while an unwritten bone stays where it was left.
 *
 * Degradation is per-mechanism. A missing upper-lip bone disables the upper lip
 * and leaves the jaw working; a missing half of the jaw pair disables the whole
 * jaw rather than rendering half of one.
 */
export class HybridLowerFaceController {
  private readonly jaw = new HybridJawController();
  private upperLipBone?: { bone: Bone; restQuaternion: Quaternion };
  private upperLipProfile: FemaleUpperLipProfile = femaleUpperLipProfile;
  private support: LowerFaceSupport = {
    jaw: {
      bones: [],
      supported: false,
      pivotSeparation: 0,
      pivotOrientationDegrees: 0,
      limitations: ["Not discovered yet."]
    },
    upperLip: { bone: femaleUpperLipProfile.boneName, found: false },
    jawSupported: false,
    upperLipSupported: false,
    limitations: ["Not discovered yet."]
  };
  private lastFrame?: LowerFaceFrame;
  /**
   * The only state this controller holds beyond the rest quaternions: the damped
   * upper-lip demand. The jaw split stays pure because its demand arrives already
   * smoothed through the pose pipeline; the bilabial gate does not, because it is
   * a ratio of coarticulation contributions rather than a damped channel.
   */
  private dampedUpperLipDemand = 0;

  discover(
    root: Object3D,
    enabled: boolean,
    jawProfile: FemaleHybridJawProfile = femaleHybridJawProfile,
    upperLipProfile: FemaleUpperLipProfile = femaleUpperLipProfile
  ) {
    this.upperLipProfile = upperLipProfile;
    this.upperLipBone = undefined;
    this.lastFrame = undefined;
    this.dampedUpperLipDemand = 0;
    const jawSupport = this.jaw.discover(root, enabled, jawProfile);
    const limitations = [...jawSupport.limitations];
    let found = false;
    if (enabled) {
      const bone = findBone(root, upperLipProfile.boneName);
      if (bone) {
        this.upperLipBone = { bone, restQuaternion: bone.quaternion.clone() };
        found = true;
      } else {
        limitations.push(`Upper-lip bone ${upperLipProfile.boneName} was not found; that mechanism is disabled.`);
      }
    }
    this.support = {
      jaw: jawSupport,
      upperLip: { bone: upperLipProfile.boneName, found },
      jawSupported: jawSupport.supported,
      upperLipSupported: found,
      limitations
    };
    return this.support;
  }

  getSupport(): LowerFaceSupport {
    return {
      ...this.support,
      jaw: { ...this.support.jaw, bones: this.support.jaw.bones.map((b) => ({ ...b })), limitations: [...this.support.jaw.limitations] },
      upperLip: { ...this.support.upperLip },
      limitations: [...this.support.limitations]
    };
  }

  getLastFrame() {
    return this.lastFrame;
  }

  /**
   * Poses every lower-face bone for one frame.
   *
   * @param jawDemand The `jawOpen` influence this frame would otherwise write.
   * @param bilabialClosure Bilabial closure demand, 0..1, from `lowerFaceIntent`.
   * @param deltaSeconds Frame time, for the demand damping only.
   * @returns What to write to `jawOpen` instead.
   */
  apply(
    jawDemand: number,
    bilabialClosure: number,
    mode: LowerFaceMode,
    deltaSeconds: number,
    jawProfile?: FemaleHybridJawProfile,
    upperLipProfile?: FemaleUpperLipProfile
  ): LowerFaceFrame {
    const jawMode: HybridJawMode = mode === "morph-only" ? "morph-only" : "hybrid";
    const jawFrame = this.jaw.apply(jawDemand, jawMode, jawProfile);

    const profile = upperLipProfile ?? this.upperLipProfile;
    const upperLipActive = mode === "hybrid-lower-face" && Boolean(this.upperLipBone);
    const raw = upperLipActive ? Math.min(1, Math.max(0, bilabialClosure)) : 0;
    // Attack and release are damped at different speeds, exactly as the closure
    // morph channels are, so the bone leads and lags with them rather than
    // arriving a frame early and leaving a frame late.
    const speed = raw > this.dampedUpperLipDemand ? profile.attackSpeed : profile.releaseSpeed;
    this.dampedUpperLipDemand +=
      (raw - this.dampedUpperLipDemand) * exponentialSmoothingAlpha(speed, Math.max(0, deltaSeconds));
    const drive = resolveUpperLipDrive(this.dampedUpperLipDemand, raw, upperLipActive, profile);
    if (this.upperLipBone) {
      // Always reset first, so switching mode or dropping demand returns the bone
      // to rest without anything else having to remember to.
      this.upperLipBone.bone.quaternion.copy(this.upperLipBone.restQuaternion);
      if (drive.degrees !== 0) {
        this.upperLipBone.bone.quaternion
          .multiply(new Quaternion().setFromAxisAngle(axisVector(profile.axis), (drive.degrees * Math.PI) / 180))
          .normalize();
      }
    }

    this.lastFrame = {
      mode,
      jaw: jawFrame,
      upperLip: { ...drive, active: upperLipActive, boneName: profile.boneName },
      correctiveJawOpen: jawFrame.active ? jawFrame.correctiveJawOpen : jawDemand,
      active: jawFrame.active || drive.degrees !== 0
    };
    return this.lastFrame;
  }

  reset() {
    this.jaw.reset();
    this.dampedUpperLipDemand = 0;
    if (this.upperLipBone) this.upperLipBone.bone.quaternion.copy(this.upperLipBone.restQuaternion);
    this.lastFrame = undefined;
  }
}
