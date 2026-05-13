import { Pause, Play, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { SolacePanel } from "./SolacePanel";

interface SolaceAmbientBarProps {
  className?: string;
}

/** Static presentation-only ambient player — no audio wiring */
export function SolaceAmbientBar({ className }: SolaceAmbientBarProps) {
  return (
    <SolacePanel glow="cyan" soft className={cn("p-3 sm:p-4", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--solace-cyan)]/40"
            aria-label="Play ambient soundscape (preview)"
          >
            <Play className="h-4 w-4" fill="currentColor" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--solace-text)]">Night Calm</p>
            <p className="truncate text-xs text-[var(--solace-muted)]">Ambient soundscape</p>
          </div>
          <div className="ml-auto hidden items-center gap-1 sm:flex">
            <button
              type="button"
              className="rounded-lg p-2 text-zinc-500 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
              aria-label="Pause"
            >
              <Pause className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-zinc-500 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
              aria-label="Skip"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3 lg:flex lg:flex-wrap lg:items-center">
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[var(--solace-muted)]">
            Environment
            <select
              className="solace-scroll rounded-lg border border-white/10 bg-black/30 py-2 pl-3 pr-8 text-sm font-normal normal-case text-[var(--solace-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35"
              defaultValue="mountain-lake"
            >
              <option value="mountain-lake">Mountain Lake</option>
              <option value="forest">Mist Forest</option>
              <option value="coast">Quiet Coast</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[var(--solace-muted)]">
            Sound
            <select
              className="solace-scroll rounded-lg border border-white/10 bg-black/30 py-2 pl-3 pr-8 text-sm font-normal normal-case text-[var(--solace-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/35"
              defaultValue="low-rain"
            >
              <option value="low-rain">Low Rain</option>
              <option value="ember">Soft Ember</option>
              <option value="dawn">Dawn Air</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[var(--solace-muted)]">
            Volume
            <input
              type="range"
              min={0}
              max={100}
              defaultValue={42}
              className="h-2 w-full cursor-pointer accent-[var(--solace-purple)]"
              aria-label="Volume"
            />
          </label>
        </div>
      </div>
    </SolacePanel>
  );
}
