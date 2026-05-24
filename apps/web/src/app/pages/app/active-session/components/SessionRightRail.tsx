import { memo } from "react";
import {
  Activity,
  Gauge,
  Loader2,
  Maximize,
  Minimize,
  Smile,
  Wifi,
  WifiOff,
} from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/app/components/ui/button";
import type { EzriWsStatus } from "@/lib/ezri/realtimeClient";
import { glassControlBtn, glassPanel } from "../constants";
import { moodEmojiForLabel } from "../utils/moodEmoji";
import { formatSessionTime } from "../utils/sessionFormat";

export interface MoodPreviewRow {
  mood: string;
  created_at: string;
  intensity?: number;
}

export interface SessionRightRailProps {
  stageSidePanelInsetR: string;
  stageRailWidthRightClass: string;
  sessionStatsOpen: boolean;
  onToggleSessionStats: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  profileAvatarUrl: string | null | undefined;
  viewerFirstName: string;
  ezriWsStatus: EzriWsStatus;
  companionName: string;
  sessionTime: number;
  remainingSeconds: number | null;
  remainingWholeMinutes: number | null;
  connectionQuality: "excellent" | "good" | "poor";
  connectionQualityColor: string;
  sortedMoodPreview: MoodPreviewRow[];
  latestMoodEmoji: string;
}

function SessionRightRailComponent({
  stageSidePanelInsetR,
  stageRailWidthRightClass,
  sessionStatsOpen,
  onToggleSessionStats,
  isFullscreen,
  onToggleFullscreen,
  profileAvatarUrl,
  viewerFirstName,
  ezriWsStatus,
  companionName,
  sessionTime,
  remainingSeconds,
  remainingWholeMinutes,
  connectionQuality,
  connectionQualityColor,
  sortedMoodPreview,
  latestMoodEmoji,
}: SessionRightRailProps) {
  return (
    <aside
      aria-label="Talking controls and stats"
      className={`pointer-events-none absolute ${stageSidePanelInsetR} z-[48] ${stageRailWidthRightClass} flex max-h-[calc(100%-6.5rem)] flex-col gap-3 overflow-x-hidden overflow-y-auto overscroll-contain pb-28 [scrollbar-width:thin] [scrollbar-color:rgba(78,205,196,0.45)_rgba(255,255,255,0.06)]`}
    >
      <div className="pointer-events-auto flex shrink-0 items-center justify-end gap-2 md:gap-3">
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onToggleSessionStats}
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${glassControlBtn} transition-transform ${sessionStatsOpen ? "ring-2 ring-white/35" : ""
            }`}
          aria-expanded={sessionStatsOpen}
          aria-controls="session-widgets-panel"
          aria-label={
            sessionStatsOpen ? "Hide session stats" : "Show session stats"
          }
        >
          <Gauge className="size-5" aria-hidden />
        </motion.button>
        <Button
          variant="ghost"
          size="sm"
          className={`rounded-full ${glassControlBtn} size-10 px-0 text-white hover:text-white`}
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
        >
          {isFullscreen ? (
            <Minimize className="size-4" />
          ) : (
            <Maximize className="size-4" />
          )}
        </Button>
        {typeof profileAvatarUrl === "string" && profileAvatarUrl ? (
          <img
            src={profileAvatarUrl}
            alt=""
            className="size-10 shrink-0 rounded-full border border-white/30 object-cover shadow-md"
          />
        ) : (
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/[0.18] bg-white/[0.03] text-sm font-semibold text-white/90 shadow-md backdrop-blur-xl"
            aria-hidden
          >
            {viewerFirstName.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <div
        id="session-widgets-panel"
        className={`pointer-events-auto flex flex-col gap-3 ${sessionStatsOpen ? "" : "hidden"}`}
        aria-hidden={!sessionStatsOpen}
      >
        <div className={`${glassPanel} shrink-0 flex items-center gap-3 px-3 py-2.5`}>
          {ezriWsStatus === "connected" ? (
            <Wifi className="size-8 shrink-0 text-emerald-300" aria-hidden />
          ) : ezriWsStatus === "connecting" ||
            ezriWsStatus === "reconnecting" ? (
            <Loader2
              className="size-8 shrink-0 animate-spin text-amber-300"
              aria-hidden
            />
          ) : (
            <WifiOff className="size-8 shrink-0 text-white/45" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-medium text-white/60">
              <Activity className="size-3.5 text-emerald-400" aria-hidden />
              Talk It Out
            </p>
            <p className="truncate text-sm font-semibold text-white">
              {ezriWsStatus === "connected"
                ? "Connected"
                : ezriWsStatus === "connecting"
                  ? "Connecting…"
                  : ezriWsStatus === "reconnecting"
                    ? "Reconnecting…"
                    : "Offline"}
            </p>
            <p className="text-xs text-white/45">Live with {companionName}</p>
          </div>
        </div>

        <div className={`${glassPanel} shrink-0 p-3`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white">Talking snapshot</span>
            <span className="flex items-center gap-1 text-xs text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              Live
            </span>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between gap-2 border-b border-white/[0.032] py-2 first:pt-0">
              <span className="text-white/70">Talk time</span>
              <span className="font-mono font-semibold text-white">
                {formatSessionTime(sessionTime)}
              </span>
            </li>
            <li className="flex justify-between gap-2 border-b border-white/[0.032] py-2">
              <span className="text-white/70">Minutes left</span>
              <span
                className={`font-mono font-semibold ${remainingWholeMinutes !== null && remainingWholeMinutes <= 10
                  ? "text-red-300"
                  : "text-emerald-300"
                  }`}
              >
                {remainingSeconds !== null ? formatSessionTime(remainingSeconds) : "—"}
              </span>
            </li>
            <li className="flex justify-between gap-2 py-2">
              <span className="text-white/70">Quality</span>
              <span className={`font-medium capitalize ${connectionQualityColor}`}>
                {connectionQuality}
              </span>
            </li>
          </ul>
        </div>

        <div className={`${glassPanel} shrink-0 p-4`}>
          <div className="mb-3 flex items-center gap-2">
            <Smile className="size-4 shrink-0 text-amber-200" aria-hidden />
            <span className="text-sm font-semibold text-white">Feelings</span>
          </div>
          {sortedMoodPreview.length === 0 ? (
            <p className="text-xs leading-relaxed text-white/55">
              No recent mood check-ins. Log one from{" "}
              <span className="text-white/80">Mood Check-In</span> to see your
              latest mood here.
            </p>
          ) : (
            <>
              <div className="mb-4 min-h-[7.5rem] rounded-2xl border border-violet-400/[0.09] bg-gradient-to-br from-violet-500/[0.035] to-sky-600/[0.025] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.018)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
                      Latest check-in
                    </p>
                    <p className="mt-2 text-2xl font-bold capitalize leading-tight tracking-tight text-white md:text-[1.65rem]">
                      {String(sortedMoodPreview[0]?.mood ?? "")
                        .replace(/-/g, " ")
                        .trim() || "—"}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/65">
                      <time dateTime={sortedMoodPreview[0].created_at}>
                        {new Date(sortedMoodPreview[0].created_at).toLocaleString(
                          undefined,
                          {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          },
                        )}
                      </time>
                      {typeof sortedMoodPreview[0].intensity === "number" ? (
                        <span className="rounded-md border border-white/[0.032] bg-black/[0.05] px-2 py-0.5 tabular-nums text-white/80">
                          Intensity {sortedMoodPreview[0].intensity}/10
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className="shrink-0 select-none text-[2rem] leading-none [font-family:ui-sans-serif,system-ui,'Segoe_UI_Emoji','Apple_Color_Emoji','Noto_Color_Emoji',sans-serif]"
                    role="img"
                    aria-label={`Mood: ${String(sortedMoodPreview[0]?.mood ?? "").replace(/-/g, " ")}`}
                  >
                    {latestMoodEmoji}
                  </span>
                </div>
              </div>
              {sortedMoodPreview.length > 1 ? (
                <>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
                    Recent
                  </p>
                  <ul className="max-h-44 space-y-2 overflow-y-auto text-sm">
                    {sortedMoodPreview.slice(1, 3).map((m, idx) => (
                      <li
                        key={`${m.created_at}-${idx}`}
                        className="flex items-center gap-2 rounded-lg border border-white/[0.028] bg-black/[0.035] px-2.5 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium capitalize text-white">
                          {String(m.mood || "").replace(/-/g, " ") || "—"}
                        </span>
                        <span
                          className="shrink-0 text-xl leading-none [font-family:ui-sans-serif,system-ui,'Segoe_UI_Emoji','Apple_Color_Emoji','Noto_Color_Emoji',sans-serif]"
                          aria-hidden
                        >
                          {moodEmojiForLabel(String(m.mood ?? ""))}
                        </span>
                        <span className="shrink-0 text-[10px] tabular-nums text-white/45">
                          {new Date(m.created_at).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

export const SessionRightRail = memo(SessionRightRailComponent);
