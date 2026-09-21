import type { BlendshapePose, SpeechEnvelopeState } from "../../types/facialAnimation";

export class SpeechEnvelope {
  evaluate(pose: BlendshapePose, phonemeActive: boolean, pauseActive: boolean): SpeechEnvelopeState {
    const jawEnergy = pose.jawOpen ?? 0;
    const lipEnergy = Math.max(pose.mouthClose ?? 0, pose.mouthFunnel ?? 0, pose.mouthPucker ?? 0, pose.mouthStretchLeft ?? 0, pose.mouthPressLeft ?? 0);
    const speechActivity = phonemeActive ? Math.max(.15, Math.min(1, jawEnergy + lipEnergy * .7)) : 0;
    return { phonemeActivation: phonemeActive ? 1 : 0, jawEnergy, lipEnergy, speechActivity, pauseActivity: pauseActive ? 1 : 0 };
  }
}
