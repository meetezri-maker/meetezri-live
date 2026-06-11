import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { writeSaraV3Diagnostics } from "./saraV3Diagnostics";
import type { SaraV3PresenceState, SaraV3RuntimeMode } from "./saraV3Types";

export function createSaraV3PresenceState(): SaraV3PresenceState {
  return {
    currentMode: SARA_V3_AVATAR_DEFINITION.saraV3.presenceConfig.defaultMode,
  };
}

export function updateSaraV3PresenceRuntime(args: {
  state: SaraV3PresenceState;
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
}) {
  const mode: SaraV3RuntimeMode = args.isSpeaking
    ? "speaking"
    : args.isThinking
      ? "thinking"
      : args.isListening
        ? "listening"
        : "idle";
  args.state.currentMode = mode;
  writeSaraV3Diagnostics({
    presenceState: mode,
  });
}
