import { forwardRef } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanionAvatar } from "../components/CompanionAvatar";
import type { ConversationCompanion } from "../types";

interface QuickChatLauncherProps {
  /** Compact-mode bottom nav is shorter, so the mobile offset follows it. */
  compactNav: boolean;
  selectorOpen: boolean;
  onStartNew: () => void;
  /** Present while a quick-chat thread is minimized. */
  resume?: { companion: ConversationCompanion; typing: boolean; onResume: () => void; onClose: () => void };
}

/**
 * Floating "+" (and, while a quick chat is minimized, its resume chip).
 *
 * Desktop: bottom-right. Mobile: right side, above the bottom navigation — offset from
 * `--solace-mobile-nav-h` when the shell defines it, otherwise from the bar's measured standard /
 * compact heights (87.5px / 75.5px plus the bottom safe area).
 */
export const QuickChatLauncher = forwardRef<HTMLButtonElement, QuickChatLauncherProps>(function QuickChatLauncher(
  { compactNav, selectorOpen, onStartNew, resume },
  ref
) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed right-4 z-40 flex flex-col items-end gap-3 lg:bottom-6 lg:right-6",
        compactNav
          ? "bottom-[calc(var(--solace-mobile-nav-h,calc(75.5px+env(safe-area-inset-bottom,0px)))+0.75rem)]"
          : "bottom-[calc(var(--solace-mobile-nav-h,calc(87.5px+env(safe-area-inset-bottom,0px)))+0.75rem)]"
      )}
      data-testid="quick-chat-launcher"
    >
      {resume ? (
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-violet-200/40 bg-[rgba(30,16,62,0.92)] py-1 pl-1 pr-1 shadow-[0_0_26px_-6px_rgba(192,132,252,0.65)] backdrop-blur-xl [html[data-ezri-theme=light]_&]:border-violet-200 [html[data-ezri-theme=light]_&]:bg-white/95">
          <button
            type="button"
            onClick={resume.onResume}
            aria-label={`Resume chat with ${resume.companion.displayName}`}
            className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300"
          >
            <span className="relative">
              <CompanionAvatar companion={resume.companion} sizeClassName="h-8 w-8" />
              {resume.typing ? (
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-fuchsia-300 ring-2 ring-[#1e103e] motion-safe:animate-pulse" aria-hidden />
              ) : null}
            </span>
            <span className="leading-tight">
              <span className="block text-xs font-semibold text-white [html[data-ezri-theme=light]_&]:text-violet-950">
                {resume.companion.displayName}
              </span>
              <span className="block text-[11px] text-violet-100/80 [html[data-ezri-theme=light]_&]:text-violet-700">
                Resume chat
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={resume.onClose}
            aria-label={`Close chat with ${resume.companion.displayName}`}
            className="rounded-full p-1.5 text-violet-100/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 [html[data-ezri-theme=light]_&]:text-violet-700 [html[data-ezri-theme=light]_&]:hover:bg-violet-50"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      <button
        ref={ref}
        type="button"
        onClick={onStartNew}
        aria-label={resume ? "Start a new conversation" : "Start a conversation"}
        aria-haspopup="dialog"
        aria-expanded={selectorOpen}
        className={cn(
          "pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full text-white",
          "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-violet-600 ring-2 ring-white/40",
          "shadow-[0_0_0_6px_rgba(167,139,250,0.16),0_0_32px_rgba(192,132,252,0.6)]",
          "transition-transform duration-200 motion-safe:hover:scale-105",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-200"
        )}
      >
        <Plus className="h-7 w-7" aria-hidden />
      </button>
    </div>
  );
});
