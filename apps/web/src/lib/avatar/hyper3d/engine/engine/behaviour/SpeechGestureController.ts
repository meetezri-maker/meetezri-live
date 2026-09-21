import type { BlendshapePose, SpeechEnvelopeState } from "../../types/facialAnimation";
export class SpeechGestureController {
  evaluate(enabledBrow: boolean, enabledCheek: boolean, browIntensity: number, cheekIntensity: number, envelope: SpeechEnvelopeState, emotionBoost = 1): BlendshapePose {
    const pose: BlendshapePose = {}; const pulse = envelope.speechActivity > .45 ? Math.min(.16, envelope.jawEnergy * .25) : 0;
    if (enabledBrow && pulse > 0) pose.browInnerUp = pulse * browIntensity * emotionBoost;
    if (enabledCheek && pulse > .04) { pose.cheekSquintLeft = pulse * cheekIntensity * .8 * emotionBoost; pose.cheekSquintRight = pose.cheekSquintLeft; }
    return pose;
  }
}
