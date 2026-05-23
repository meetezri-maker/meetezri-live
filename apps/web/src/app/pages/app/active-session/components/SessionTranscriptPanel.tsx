import { memo, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import type { EzriWsStatus } from "@/lib/ezri/realtimeClient";
import type { LiveUserSpeechStore } from "../hooks/useLiveUserSpeechStore";
import type { TranscriptLine } from "../utils/transcript";

export interface SessionTranscriptPanelProps {
  transcriptListRef: RefObject<HTMLDivElement>;
  transcript: TranscriptLine[];
  liveUserSpeech: LiveUserSpeechStore;
  isMuted: boolean;
  companionName: string;
  sttProvider: string | undefined;
  ezriWsStatus: EzriWsStatus;
  permissionsGranted: boolean;
}

function SessionTranscriptPanelComponent({
  transcriptListRef,
  transcript,
  liveUserSpeech,
  isMuted,
  companionName,
  sttProvider,
  ezriWsStatus,
  permissionsGranted,
}: SessionTranscriptPanelProps) {
  const interimSpeech = useSyncExternalStore(
    liveUserSpeech.subscribe,
    liveUserSpeech.getSnapshot,
    liveUserSpeech.getSnapshot,
  );

  return (
    <div className="flex min-h-0 shrink-0 flex-col">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
        Transcript
      </p>
      <div
        lang="en"
        ref={transcriptListRef}
        className="flex h-[16.5rem] shrink-0 flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm sm:h-[17.5rem] [scrollbar-width:thin] [scrollbar-color:rgba(78,205,196,0.65)_rgba(255,255,255,0.06)] [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/[0.06] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[#4ECDC4]/55 [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb:hover]:bg-[#4ECDC4]/80"
      >
        {transcript.length === 0 && !interimSpeech.trim() ? (
          <div className="space-y-2">
            <p className="text-xs text-white/50">
              Nothing yet — your conversation will appear here.
            </p>
            {isMuted ? (
              <p className="rounded-lg border border-red-400/40 bg-red-500/15 px-2 py-1.5 text-xs text-red-200">
                Microphone is muted — tap the mic button below to unmute so
                {companionName} can hear you.
              </p>
            ) : null}
            {!isMuted &&
            sttProvider !== "browser" &&
            ezriWsStatus === "connected" &&
            permissionsGranted ? (
              <p className="text-xs text-white/45">
                Listening via server audio — speak after {companionName} finishes
                talking.
              </p>
            ) : null}
          </div>
        ) : null}
        {transcript.length > 0
          ? transcript.slice(-80).map((line, i) => {
              const isUser = line.role === "user";
              return (
                <div
                  key={`${line.timestamp}-${i}`}
                  className={`rounded-lg px-2.5 py-2 ${
                    isUser ? "bg-white/[0.02]" : "bg-violet-500/[0.03]"
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">
                    {isUser ? "You" : companionName}
                  </p>
                  <p className="mt-0.5 leading-snug text-white/90">{line.content}</p>
                </div>
              );
            })
          : null}
        {interimSpeech.trim() ? (
          <div className="rounded-lg border border-[#4ECDC4]/30 bg-[#4ECDC4]/[0.07] px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#4ECDC4]/90">
              You · speaking
            </p>
            <p className="mt-0.5 leading-snug text-white/90">{interimSpeech}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const SessionTranscriptPanel = memo(SessionTranscriptPanelComponent);
