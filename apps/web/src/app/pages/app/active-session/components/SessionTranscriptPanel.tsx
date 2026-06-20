import { memo, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import type { EzriWsStatus } from "@/lib/ezri/realtimeClient";
import type { LiveUserSpeechStore } from "../hooks/useLiveUserSpeechStore";
import { usesBrowserStt } from "../utils/sttMode";
import type { TranscriptLine } from "../utils/transcript";

export interface SessionTranscriptPanelProps {
  transcriptListRef: RefObject<HTMLDivElement>;
  transcript: TranscriptLine[];
  liveUserSpeech: LiveUserSpeechStore;
  isMuted: boolean;
  isSessionPaused: boolean;
  isSoundOff: boolean;
  isEzriSpeaking: boolean;
  isEzriThinking: boolean;
  companionName: string;
  sttProvider: string | undefined;
  ezriWsStatus: EzriWsStatus;
  ezriWarmupStatus: "idle" | "warming" | "ready";
  permissionsGranted: boolean;
}

function SessionListeningHint({
  isMuted,
  isSessionPaused,
  isSoundOff,
  isEzriSpeaking,
  isEzriThinking,
  companionName,
  sttProvider,
  ezriWsStatus,
  ezriWarmupStatus,
  permissionsGranted,
}: Omit<SessionTranscriptPanelProps, "transcriptListRef" | "transcript" | "liveUserSpeech">) {
  if (!permissionsGranted) {
    return (
      <p className="text-xs text-white/45">
        Allow microphone access to start talking with {companionName}.
      </p>
    );
  }

  if (isSessionPaused) {
    return (
      <p className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-2 py-1.5 text-xs text-amber-100">
        Session is paused — tap play below to resume listening and speaking.
      </p>
    );
  }

  if (isMuted) {
    return (
      <p className="rounded-lg border border-red-400/40 bg-red-500/15 px-2 py-1.5 text-xs text-red-200">
        Microphone is muted — tap the mic button below (unmute) so {companionName}{" "}
        can hear you.
      </p>
    );
  }

  if (isSoundOff) {
    return (
      <p className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-100">
        Speaker is off — you can still talk, but tap the speaker button below to
        hear {companionName}.
      </p>
    );
  }

  if (ezriWarmupStatus === "warming" || ezriWsStatus === "connecting" || ezriWsStatus === "reconnecting") {
    return (
      <p className="text-xs text-white/45">
        Connecting and warming up the voice pipeline…
      </p>
    );
  }

  if (ezriWsStatus !== "connected") {
    return (
      <p className="text-xs text-amber-200/90">
        Not connected to the voice server — check your network or refresh the page.
      </p>
    );
  }

  if (isEzriSpeaking || isEzriThinking) {
    return (
      <p className="text-xs text-white/45">
        {companionName} is speaking — you can interrupt by talking, or wait until
        they finish.
      </p>
    );
  }

  if (usesBrowserStt(sttProvider)) {
    return (
      <p className="text-xs text-white/45">
        Your browser is listening — speak naturally when you are ready.
      </p>
    );
  }

  return (
    <p className="text-xs text-[#4ECDC4]/80">
      Listening via your microphone — speak naturally; {companionName} will respond
      when you pause.
    </p>
  );
}

function SessionTranscriptPanelComponent({
  transcriptListRef,
  transcript,
  liveUserSpeech,
  isMuted,
  isSessionPaused,
  isSoundOff,
  isEzriSpeaking,
  isEzriThinking,
  companionName,
  sttProvider,
  ezriWsStatus,
  ezriWarmupStatus,
  permissionsGranted,
}: SessionTranscriptPanelProps) {
  const interimSpeech = useSyncExternalStore(
    liveUserSpeech.subscribe,
    liveUserSpeech.getSnapshot,
    liveUserSpeech.getSnapshot,
  );

  return (
    <div className="hidden md:block flex min-h-0 shrink-0 flex-col shaz">
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
            <SessionListeningHint
              isMuted={isMuted}
              isSessionPaused={isSessionPaused}
              isSoundOff={isSoundOff}
              isEzriSpeaking={isEzriSpeaking}
              isEzriThinking={isEzriThinking}
              companionName={companionName}
              sttProvider={sttProvider}
              ezriWsStatus={ezriWsStatus}
              ezriWarmupStatus={ezriWarmupStatus}
              permissionsGranted={permissionsGranted}
            />
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
