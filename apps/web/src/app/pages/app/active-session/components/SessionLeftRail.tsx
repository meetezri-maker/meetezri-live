import { memo } from "react";
import type { RefObject } from "react";
import type { EzriWsStatus } from "@/lib/ezri/realtimeClient";
import { glassPanel } from "../constants";
import type { TranscriptLine } from "../utils/transcript";

export interface SessionLeftRailProps {
  stageSidePanelInsetL: string;
  stageRailWidthLeftClass: string;
  leftSessionChromeRef: RefObject<HTMLDivElement>;
  sessionGreeting: string;
  viewerFirstName: string;
  transcriptListRef: RefObject<HTMLDivElement>;
  transcript: TranscriptLine[];
  liveUserSpeech: string;
  isMuted: boolean;
  companionName: string;
  sttProvider: string | undefined;
  ezriWsStatus: EzriWsStatus;
  permissionsGranted: boolean;
}

function SessionLeftRailComponent({
  stageSidePanelInsetL,
  stageRailWidthLeftClass,
  leftSessionChromeRef,
  sessionGreeting,
  viewerFirstName,
  transcriptListRef,
  transcript,
  liveUserSpeech,
  isMuted,
  companionName,
  sttProvider,
  ezriWsStatus,
  permissionsGranted,
}: SessionLeftRailProps) {
  return (
    <aside
      aria-label="Talking greeting and transcript"
      className={`pointer-events-none absolute ${stageSidePanelInsetL} z-30 flex max-h-[min(100dvh-5rem,100%)] ${stageRailWidthLeftClass} flex-col gap-0 overflow-x-hidden overflow-y-auto overscroll-contain pb-2`}
    >
      <div
        ref={leftSessionChromeRef}
        className={`pointer-events-auto ${glassPanel} flex min-h-0 max-h-[min(100dvh-8rem,42rem)] shrink-0 flex-col space-y-3 overflow-hidden p-4 sm:p-5`}
      >
        <div className="shrink-0">
          <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl md:text-2xl">
            {sessionGreeting}, {viewerFirstName}!
          </h2>
          <p className="mt-2 border-l-2 border-sky-400/45 pl-3 text-xs leading-relaxed text-white/80 md:text-sm">
            This time is for you—take it at your own pace, and share only what
            feels right in this moment.
          </p>
        </div>
        <div className="flex min-h-0 shrink-0 flex-col">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
            Transcript
          </p>
          <div
            lang="en"
            ref={transcriptListRef}
            className="flex h-[16.5rem] shrink-0 flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm sm:h-[17.5rem] [scrollbar-width:thin] [scrollbar-color:rgba(78,205,196,0.65)_rgba(255,255,255,0.06)] [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/[0.06] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[#4ECDC4]/55 [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb:hover]:bg-[#4ECDC4]/80"
          >
            {transcript.length === 0 && !liveUserSpeech.trim() ? (
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
                    Listening via server audio — speak after {companionName}{" "}
                    finishes talking.
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
                    className={`rounded-lg px-2.5 py-2 ${isUser ? "bg-white/[0.02]" : "bg-violet-500/[0.03]"
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
            {liveUserSpeech.trim() ? (
              <div className="rounded-lg border border-[#4ECDC4]/30 bg-[#4ECDC4]/[0.07] px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#4ECDC4]/90">
                  You · speaking
                </p>
                <p className="mt-0.5 leading-snug text-white/90">{liveUserSpeech}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

export const SessionLeftRail = memo(SessionLeftRailComponent);
