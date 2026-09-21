import type { BlendshapePose } from "../../types/facialAnimation";
import type { TimedEmotion } from "../../types/avatarPayload";
import { emotionToBlendshape, resolveEmotionPose } from "../../mappings/emotionToBlendshape";
import type { AvatarModelId } from "../../mappings/avatarModelConfig";
import { easeInOutCubic } from "../../utils/easing";
import { clamp } from "../../utils/clamp";

export class EmotionBlender {
  weight(event: TimedEmotion, time: number) {
    if (time < event.start_time || time > event.end_time) return 0;
    const inDur = Math.max(.001, event.transition_in);
    const outDur = Math.max(.001, event.transition_out);
    const fadeIn = clamp((time - event.start_time) / inDur);
    const fadeOut = clamp((event.end_time - time) / outDur);
    return event.intensity * easeInOutCubic(Math.min(fadeIn, fadeOut));
  }
  /**
   * `modelId` selects the per-model pose, so an emotion built on a channel that is
   * dead on one asset can be expressed through live channels there without changing
   * what any other model renders. It defaults to the male avatar, whose poses are
   * the canonical ones.
   *
   * `speech` is how `EmotionPoseDefinition.mouthStrategy` becomes real. Every
   * emotion in the table is marked `protectLipsync`, and nothing read that field:
   * this method summed every channel of every active pose unconditionally, so
   * `surprised` (jawOpen .08) could push the jaw open inside a bilabial closure and
   * `happy` (mouthSmile .24, cheekSquint .18) could widen the mouth against the
   * articulated shape. Now a `protectLipsync` emotion contributes nothing to any
   * protected channel while speech is active.
   *
   * Protection is a full zero, not an attenuation. The protected set is exactly the
   * channels the coordinated speech layer owns, and that layer already carries its
   * own emphasis mechanism (speechEnergy-scaled cheek compression, corner support
   * gated on live spreading intent). A partial bleed-through would put a smaller
   * version of the same tug-of-war back, with the added cost that the residual is
   * unowned by either controller. Brow, eye and every other channel are untouched,
   * so an emotion still reads on the upper face throughout speech — the goal is to
   * stop emotions fighting articulation, not to blank the face while it talks.
   */
  blend(
    events: TimedEmotion[],
    time: number,
    modelId: AvatarModelId = "miniface-male",
    speech: { protectedChannels?: ReadonlySet<string>; isSpeaking?: boolean } = {}
  ): { pose: BlendshapePose; active: Array<{ emotion: string; weight: number }> } {
    const pose: BlendshapePose = {}; const active: Array<{ emotion: string; weight: number }> = [];
    const protectedChannels = speech.isSpeaking ? speech.protectedChannels : undefined;
    for (const event of events) {
      const w = this.weight(event, time); if (w <= 0) continue;
      active.push({ emotion: event.emotion, weight: w });
      const def = emotionToBlendshape[event.emotion];
      const eventPose = resolveEmotionPose(event.emotion, modelId);
      const protect = def.mouthStrategy === "protectLipsync" ? protectedChannels : undefined;
      for (const [name, value] of Object.entries(eventPose)) {
        if (protect?.has(name)) continue;
        pose[name] = clamp((pose[name] ?? 0) + value * w * def.defaultIntensity);
      }
    }
    for (const key of Object.keys(pose)) pose[key] = Math.min(.75, pose[key]);
    return { pose, active };
  }
}
