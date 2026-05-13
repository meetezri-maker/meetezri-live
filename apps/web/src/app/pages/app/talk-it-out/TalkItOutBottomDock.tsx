import { Link } from "react-router-dom";
import { Pause, Phone, Play, Shield, SkipBack, SkipForward, Video, BookMarked } from "lucide-react";
import { SolacePanel } from "@/app/solace/SolacePanel";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TalkItOutBottomDockProps {
  getSupportSlot: ReactNode;
  /** Tighter vertical rhythm for immersive pages (e.g. Mood Check-In) where default feels bottom-heavy. */
  density?: "default" | "compact";
}

/**
 * Shared cinematic bottom dock (Talk It Out · Mood · Habit Tracker, and other masters).
 */
export function TalkItOutBottomDock({ getSupportSlot, density = "default" }: TalkItOutBottomDockProps) {
  const compact = density === "compact";
  const links = [
    { to: "/app/emergency-resources", label: "Crisis Helpline", icon: Phone, danger: true },
    { to: "/app/session-lobby", label: "Talk to Solace", icon: Video },
    { to: "/app/settings/wellness-plan", label: "Safety Plan", icon: Shield },
    { to: "/app/settings/resources", label: "Resources", icon: BookMarked },
  ];

  return (
    <SolacePanel
      glow="violet"
      soft
      className={cn(
        "overflow-hidden rounded-[1.55rem] border-white/[0.065]",
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
            <div className={compact ? "space-y-2" : "space-y-3"}>
              <p
                className={cn(
                  "font-medium uppercase tracking-[0.22em] text-zinc-500",
                  compact ? "text-[10px]" : "text-[11px]"
                )}
              >
                When you need a hand
              </p>
              <p
                className={cn(
                  "font-serif font-normal tracking-tight text-zinc-50",
                  compact ? "text-[1.05rem] sm:text-[1.15rem]" : "text-[1.125rem] sm:text-[1.25rem]"
                )}
              >
                Need support right now?
              </p>
              <p
                className={cn(
                  "leading-[1.65] text-[var(--solace-muted)] max-w-xl",
                  compact ? "text-[13px]" : "text-[14px] leading-[1.7]"
                )}
              >
                You are not alone. Talk to someone or explore resources that can help.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">{getSupportSlot}</div>
            <div className={cn("grid grid-cols-2 sm:grid-cols-4", compact ? "gap-3 sm:gap-3" : "gap-4 sm:gap-4")}>
              {links.map(({ to, label, icon: Icon, danger }) => (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 rounded-[1.05rem] border border-white/[0.065] px-3 text-center font-medium leading-snug text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-[border-color,background-color,box-shadow] duration-500 hover:border-violet-400/24 hover:bg-white/[0.035] hover:shadow-[0_12px_40px_-26px_rgba(76,29,149,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35",
                    compact
                      ? "min-h-[44px] py-2.5 text-[10.5px] sm:min-h-[46px] sm:text-[11.5px]"
                      : "min-h-[52px] gap-2 py-3.5 text-[11px] sm:min-h-[56px] sm:py-4 sm:text-[12px]",
                    danger &&
                      "border-rose-500/22 text-rose-100/95 hover:border-rose-400/28 hover:bg-rose-950/22"
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

      <div
        className={cn(
          "relative overflow-hidden border-t border-white/[0.07] bg-[color-mix(in_oklab,var(--solace-bg-elevated)_58%,transparent)] backdrop-blur-md",
          compact ? "px-4 py-4 sm:px-6 sm:py-5" : "px-5 py-5 sm:px-8 sm:py-7"
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute -left-24 bottom-0 rounded-full bg-violet-500/[0.08] blur-[48px]",
            compact ? "h-28 w-40" : "h-36 w-48"
          )}
          aria-hidden
        />
        <div
          className={cn(
            "pointer-events-none absolute -right-10 top-0 rounded-full bg-cyan-500/[0.05] blur-[40px]",
            compact ? "h-24 w-32" : "h-28 w-40"
          )}
          aria-hidden
        />
        <div
          className={cn(
            "relative flex flex-col lg:flex-row lg:items-center lg:justify-between",
            compact ? "gap-4 lg:gap-6" : "gap-5 lg:gap-10"
          )}
        >
          <div className={cn("flex min-w-0 flex-1 flex-wrap items-center", compact ? "min-h-[44px] gap-4" : "min-h-[48px] gap-5")}>
            <button
              type="button"
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full border border-white/[0.11] bg-white/[0.07] text-zinc-100 shadow-[0_14px_40px_-20px_rgba(6,182,212,0.35)] transition-[background-color,transform] hover:scale-[1.02] hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--solace-cyan)]/42",
                compact ? "h-11 min-h-[44px] min-w-[44px]" : "h-12 min-h-[48px] min-w-[48px]"
              )}
              aria-label="Play ambient soundscape"
            >
              <Play className="h-[18px] w-[18px]" fill="currentColor" />
            </button>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate font-serif font-normal leading-tight tracking-tight text-[var(--solace-text)]",
                  compact ? "text-[15px] sm:text-[1rem]" : "text-[16px] sm:text-[1.05rem]"
                )}
              >
                Night Calm Ambient Soundscape
              </p>
              <p className={cn("mt-1 truncate tracking-[0.04em] text-[var(--solace-muted)]", compact ? "text-[10px]" : "text-[11.5px]")}>
                Breath with the landscape
              </p>
            </div>
            <div className="ml-auto hidden items-center gap-2 sm:flex">
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-xl border border-white/[0.05] bg-white/[0.03] p-2.5 text-zinc-400 transition-colors hover:border-white/[0.1] hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
                aria-label="Previous ambient cue"
              >
                <SkipBack className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-xl border border-white/[0.05] bg-white/[0.03] p-2.5 text-zinc-400 transition-colors hover:border-white/[0.1] hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
                aria-label="Pause ambient soundscape"
              >
                <Pause className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-xl border border-white/[0.05] bg-white/[0.03] p-2.5 text-zinc-400 transition-colors hover:border-white/[0.1] hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
                aria-label="Skip ambient track forward"
              >
                <SkipForward className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
          <div
            className={cn(
              "grid w-full min-w-[min(100%,560px)] grid-cols-1 sm:grid-cols-3 lg:flex-1 xl:max-w-[640px]",
              compact ? "gap-3 sm:gap-4" : "gap-5 sm:gap-5"
            )}
          >
            <label className="flex min-w-[140px] flex-1 flex-col gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500/85">
              Environment
              <select
                className={cn(
                  "solace-scroll w-full rounded-[0.92rem] border border-white/[0.1] bg-black/42 py-2.5 pl-3.5 pr-9 font-normal normal-case tracking-normal text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[border-color,box-shadow] focus-visible:border-violet-400/28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/28",
                  compact ? "min-h-[44px] text-[13px]" : "min-h-[48px] py-3 text-[13.5px]"
                )}
                defaultValue="mountain-lake"
              >
                <option value="mountain-lake">Mountain Lake</option>
                <option value="forest">Mist Forest</option>
                <option value="coast">Quiet Coast</option>
              </select>
            </label>
            <label className="flex min-w-[140px] flex-1 flex-col gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500/85">
              Sound
              <select
                className={cn(
                  "solace-scroll w-full rounded-[0.92rem] border border-white/[0.1] bg-black/42 pl-3.5 pr-9 font-normal normal-case tracking-normal text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/35",
                  compact ? "min-h-[44px] py-2.5 text-[13px]" : "min-h-[48px] py-3 text-[13.5px]"
                )}
                defaultValue="low-rain"
              >
                <option value="low-rain">Low Rain</option>
                <option value="ember">Soft Ember</option>
                <option value="dawn">Dawn Air</option>
              </select>
            </label>
            <label className="flex min-w-[160px] flex-1 flex-col gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500/85">
              Volume
              <input
                type="range"
                min={0}
                max={100}
                defaultValue={20}
                className={cn(
                  "w-full cursor-pointer rounded-full accent-[var(--solace-purple)]",
                  compact ? "h-2 min-h-[40px]" : "h-3 min-h-[48px]"
                )}
                aria-label="Ambient volume"
              />
            </label>
          </div>
        </div>
      </div>
    </SolacePanel>
  );
}
