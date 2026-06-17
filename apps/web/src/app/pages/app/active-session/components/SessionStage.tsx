import { lazy, memo, Suspense, type MutableRefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2 } from "lucide-react";
import type { AvatarPhonemeTimeline } from "@/lib/avatar/avatarMorphTypes";
import type { CompanionViewTuning } from "@/lib/avatar/companionViewTuning";
import type {
  SessionBackdropLayers,
  SessionBackdropPreference,
  SessionBackdropPresetKey,
} from "@/lib/sessionBackdropPresets";
import type { FixedAvatarViewportConfig } from "./ThreeAvatar";
import { StaticSessionPortrait } from "./StaticSessionPortrait";
import { SessionBackdrop } from "./SessionBackdrop";

const ThreeAvatar = lazy(() =>
  import("./ThreeAvatar").then((m) => ({ default: m.ThreeAvatar })),
);

export interface SessionStageProps {
  stageRoundClass: string;
  sessionBackdropLayers: SessionBackdropLayers;
  sessionBackdropPreference: SessionBackdropPreference;
  latestMoodSlug: string | null;
  sessionRoomThemeKey: SessionBackdropPresetKey;
  isEzriSpeaking: boolean;
  sessionUsesCompanion3d: boolean;
  companionAvatarLabel: string | undefined;
  companionCanonicalId: string | null;
  resolvedAvatarKey: string | null;
  companionModelUrl: string;
  companionViewTuning: CompanionViewTuning;
  companionFixedViewportConfig: FixedAvatarViewportConfig | null | undefined;
  sessionUsesRfv2Morphs: boolean;
  saraLiveRfv2PreviewEnabled: boolean;
  onSaraLiveRfv2Fallback: (reason: string) => void;
  isListening: boolean;
  isEzriThinking: boolean;
  mouthAudioLevelRef: MutableRefObject<number>;
  avatarPhonemeTimelineRef: MutableRefObject<AvatarPhonemeTimeline | null>;
  avatarAudioCurrentTimeRef: MutableRefObject<number>;
  speechTextRef: MutableRefObject<string>;
  speechCharIndexRef: MutableRefObject<number>;
  speechPulseRef: MutableRefObject<number>;
  latestUserTextRef: MutableRefObject<string>;
  latestJordanTextRef: MutableRefObject<string>;
  userSpeechStartedAtMsRef: MutableRefObject<number>;
  userLastSpeechAtMsRef: MutableRefObject<number>;
  jordanSpeechStartedAtMsRef: MutableRefObject<number>;
  jordanLastSpeechAtMsRef: MutableRefObject<number>;
  sentimentCompoundRef: MutableRefObject<number | undefined>;
  companionPortraitUrl: string;
}

export const SessionStage = memo(function SessionStage({
  stageRoundClass,
  sessionBackdropLayers,
  sessionBackdropPreference,
  latestMoodSlug,
  sessionRoomThemeKey,
  isEzriSpeaking,
  sessionUsesCompanion3d,
  companionAvatarLabel,
  companionCanonicalId,
  resolvedAvatarKey,
  companionModelUrl,
  companionViewTuning,
  companionFixedViewportConfig,
  sessionUsesRfv2Morphs,
  saraLiveRfv2PreviewEnabled,
  onSaraLiveRfv2Fallback,
  isListening,
  isEzriThinking,
  mouthAudioLevelRef,
  avatarPhonemeTimelineRef,
  avatarAudioCurrentTimeRef,
  speechTextRef,
  speechCharIndexRef,
  speechPulseRef,
  latestUserTextRef,
  latestJordanTextRef,
  userSpeechStartedAtMsRef,
  userLastSpeechAtMsRef,
  jordanSpeechStartedAtMsRef,
  jordanLastSpeechAtMsRef,
  sentimentCompoundRef,
  companionPortraitUrl,
}: SessionStageProps) {
  return (
    <div className={`absolute inset-0 overflow-hidden ${stageRoundClass}`}>
      <SessionBackdrop
        sessionBackdropLayers={sessionBackdropLayers}
        sessionBackdropPreference={sessionBackdropPreference}
        latestMoodSlug={latestMoodSlug}
      />
      <div className="relative z-[1] h-full min-h-0 w-full">
        <AnimatePresence>
          {isEzriSpeaking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-[1]"
              style={{ background: sessionBackdropLayers.speakingWash }}
            />
          )}
        </AnimatePresence>
        <div
          className="relative z-[2] h-full w-full [-webkit-mask-image:radial-gradient(ellipse_118%_96%_at_50%_32%,#fff_0%,#fff_45%,rgba(255,255,255,0.55)_68%,transparent_84%)] [mask-image:radial-gradient(ellipse_118%_96%_at_50%_32%,#fff_0%,#fff_45%,rgba(255,255,255,0.55)_68%,transparent_84%)] [mask-repeat:no-repeat] [mask-size:100%_100%] [mask-position:center]"
        >
          {sessionUsesCompanion3d ? (
            <Suspense
              fallback={
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-purple-300" aria-hidden />
                  <p className="text-sm text-white/70">Loading avatar…</p>
                </div>
              }
            >
              <ThreeAvatar
                sessionRoomThemeKey={sessionRoomThemeKey}
                rawAvatarLabel={companionAvatarLabel}
                activeAvatarId={resolvedAvatarKey ?? companionFixedViewportConfig?.avatarId ?? companionCanonicalId}
                modelUrl={companionModelUrl}
                viewTuning={companionViewTuning}
                fixedViewportConfig={companionFixedViewportConfig}
                useRfv2Morphs={sessionUsesRfv2Morphs}
                useSaraRfv2Preview={saraLiveRfv2PreviewEnabled}
                onSaraRfv2Fallback={onSaraLiveRfv2Fallback}
                isSpeaking={isEzriSpeaking}
                isListening={isListening}
                isThinking={isEzriThinking}
                mouthAudioLevelRef={mouthAudioLevelRef}
                avatarPhonemeTimelineRef={avatarPhonemeTimelineRef}
                avatarAudioCurrentTimeRef={avatarAudioCurrentTimeRef}
                speechTextRef={speechTextRef}
                speechCharIndexRef={speechCharIndexRef}
                speechPulseRef={speechPulseRef}
                latestUserTextRef={latestUserTextRef}
                latestJordanTextRef={latestJordanTextRef}
                userSpeechStartedAtMsRef={userSpeechStartedAtMsRef}
                userLastSpeechAtMsRef={userLastSpeechAtMsRef}
                jordanSpeechStartedAtMsRef={jordanSpeechStartedAtMsRef}
                jordanLastSpeechAtMsRef={jordanLastSpeechAtMsRef}
                sentimentCompoundRef={sentimentCompoundRef}
              />
            </Suspense>
          ) : (
            <StaticSessionPortrait
              imageUrl={companionPortraitUrl}
              isSpeaking={isEzriSpeaking}
            />
          )}
        </div>
        {isEzriSpeaking && (
          <motion.div
            className="pointer-events-none absolute bottom-[6.25rem] left-1/2 z-[3] flex -translate-x-1/2 items-end gap-1.5 sm:bottom-[6.75rem] md:bottom-[7.25rem] md:gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="w-0.5 rounded-full opacity-[0.92] md:w-1"
                style={{
                  backgroundColor: sessionBackdropLayers.voiceBar,
                }}
                animate={{ height: [10, 30, 15, 25, 10] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: "easeInOut",
                }}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
});
