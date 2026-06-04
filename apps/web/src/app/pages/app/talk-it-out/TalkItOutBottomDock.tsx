import { Link } from "react-router-dom";
import { Phone, Shield, Video, BookMarked } from "lucide-react";
import { SolacePanel } from "@/app/solace/SolacePanel";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TALK_IT_OUT_IMAGES } from "@/lib/solace/talkItOutImages";

interface TalkItOutBottomDockProps {
  getSupportSlot: ReactNode;
  /** Tighter vertical rhythm for immersive pages (e.g. Mood Check-In) where default feels bottom-heavy. */
  density?: "default" | "compact";
}

/**
 * Shared cinematic bottom dock (Talk It Out · Mood · Habit Tracker, and other masters).
 */
export function TalkItOutBottomDock({
  getSupportSlot,
  density = "default",
}: TalkItOutBottomDockProps) {
  const compact = density === "compact";
  const links = [
    { to: "/app/emergency-resources", label: "Emergency Resources", icon: Phone, danger: true },
    { to: "/app/session-lobby", label: "Talk It Out", icon: Video },
    { to: "/app/settings/wellness-plan", label: "Safety Plan", icon: Shield },
    { to: "/app/settings/resources", label: "Reading Library", icon: BookMarked },
  ];

  return (
    <SolacePanel
      glow="violet"
      soft
      className={cn(
        "talk-it-out-support-dock overflow-hidden rounded-[1.55rem] border-white/[0.065]",
        compact
          ? "shadow-[0_28px_72px_-40px_rgba(0,0,0,0.72)]"
          : "shadow-[0_42px_100px_-48px_rgba(0,0,0,0.78)]"
      )}
    >
      <div
        className={cn(
          "px-6 sm:px-8",
          compact ? "space-y-4 py-5 sm:py-6" : "space-y-7 py-8 sm:py-9"
        )}
      >
        <div
          className={cn(
            "flex flex-col lg:flex-row lg:items-start lg:justify-between",
            compact ? "gap-5 lg:gap-10" : "gap-8 lg:gap-16"
          )}
        >
          <div className={cn("min-w-0 flex-1", compact ? "space-y-4" : "space-y-6")}>
            <div className={cn("flex gap-4", compact ? "items-start" : "items-center")}>
              <img
                src={TALK_IT_OUT_IMAGES.lotusDecor}
                alt=""
                className={cn(
                  "shrink-0 rounded-xl object-cover ring-1 ring-white/10",
                  compact ? "h-14 w-14" : "h-16 w-16"
                )}
                loading="lazy"
                decoding="async"
              />
              <div className={compact ? "space-y-2" : "space-y-3"}>
              <p
                className={cn(
                  "talk-it-out-support-eyebrow font-medium uppercase tracking-[0.22em] text-zinc-500",
                  compact ? "text-[10px]" : "text-[11px]"
                )}
              >
                When you need a hand
              </p>
              <p
                className={cn(
                  "talk-it-out-support-title font-serif font-normal tracking-tight text-zinc-50",
                  compact ? "text-[1.05rem] sm:text-[1.15rem]" : "text-[1.125rem] sm:text-[1.25rem]"
                )}
              >
                Need support right now?
              </p>
              <p
                className={cn(
                  "talk-it-out-support-lead leading-[1.65] text-[var(--solace-muted)] max-w-xl",
                  compact ? "text-[13px]" : "text-[14px] leading-[1.7]"
                )}
              >
                You are not alone. Talk to someone or explore resources that can help.
              </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">{getSupportSlot}</div>
            <div className={cn("grid grid-cols-2 sm:grid-cols-4", compact ? "gap-3 sm:gap-3" : "gap-4 sm:gap-4")}>
              {links.map(({ to, label, icon: Icon, danger }) => (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "talk-it-out-support-link flex flex-col items-center justify-center gap-1.5 rounded-[1.05rem] border border-white/[0.065] px-3 text-center font-medium leading-snug text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-[border-color,background-color,box-shadow] duration-500 hover:border-violet-400/24 hover:bg-white/[0.035] hover:shadow-[0_12px_40px_-26px_rgba(76,29,149,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35",
                    compact
                      ? "min-h-[44px] py-2.5 text-[10.5px] sm:min-h-[46px] sm:text-[11.5px]"
                      : "min-h-[52px] gap-2 py-3.5 text-[11px] sm:min-h-[56px] sm:py-4 sm:text-[12px]",
                    danger && "talk-it-out-support-link--danger border-rose-500/22 hover:border-rose-400/28"
                  )}
                >
                  <Icon className="h-[18px] w-[18px] text-zinc-500 sm:h-[19px] sm:w-[19px]" aria-hidden strokeWidth={1.65} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SolacePanel>
  );
}
