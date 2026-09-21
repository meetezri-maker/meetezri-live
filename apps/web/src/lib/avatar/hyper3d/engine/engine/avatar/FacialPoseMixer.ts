import type { ChannelPose, MixedPoseResult } from "../../types/facialAnimation";
import { blendshapeRegions, clampAvatarMorph, regionMergeStrategy, smoothingSpeedByRegion } from "../../mappings/avatarBlendshapeConfig";
import { clamp } from "../../utils/clamp";
import { exponentialSmoothingAlpha, lerp } from "../../utils/lerp";

const clearRecord = (record: Record<string, unknown>) => { for (const key in record) delete record[key]; };

export class FacialPoseMixer {
  private current: Record<string, number> = {};
  private combinedPose: Record<string, number> = {};
  private smoothedPose: Record<string, number> = {};
  private channelContributions: MixedPoseResult["channelContributions"] = {};

  reset() {
    clearRecord(this.current);
    clearRecord(this.combinedPose);
    clearRecord(this.smoothedPose);
    clearRecord(this.channelContributions);
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
   */
  smooth(target: Record<string, number>, delta: number, ownedElsewhere?: ReadonlySet<string>) {
    clearRecord(this.smoothedPose);
    for (const key in this.current) this.writeSmoothedValue(key, target, delta, ownedElsewhere);
    for (const key in target) if (this.current[key] === undefined) this.writeSmoothedValue(key, target, delta, ownedElsewhere);
    const previous = this.current;
    this.current = this.smoothedPose;
    this.smoothedPose = previous;
    return this.current;
  }

  private writeSmoothedValue(key: string, target: Record<string, number>, delta: number, ownedElsewhere?: ReadonlySet<string>) {
    if (ownedElsewhere?.has(key)) {
      const passed = clamp(target[key] ?? 0);
      this.current[key] = passed;
      if (passed > 0.0001) this.smoothedPose[key] = passed;
      return;
    }
    const region = blendshapeRegions[key] ?? "mouth";
    const alpha = exponentialSmoothingAlpha(smoothingSpeedByRegion[region], delta);
    const value = clamp(lerp(this.current[key] ?? 0, target[key] ?? 0, alpha));
    if (value > 0.0001) this.smoothedPose[key] = value;
  }
}
