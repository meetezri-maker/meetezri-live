import { Pause, Play, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { SolacePanel } from "./SolacePanel";

interface SolaceAmbientBarProps {
  className?: string;
}

/** Static presentation-only ambient player — no audio wiring */
export function SolaceAmbientBar({ className }: SolaceAmbientBarProps) {
  return (
    <SolacePanel
      glow="cyan"
      soft
      className={cn("relative overflow-hidden p-4 sm:p-5", className)}
    >
      <div
        className="pointer-events-none absolute -right-24 top-1/2 h-40 w-72 -translate-y-1/2 rounded-full bg-cyan-400/[0.07] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-16 bottom-0 h-28 w-56 rounded-full bg-violet-500/[0.06] blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <button
            type="button"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/[0.11] bg-gradient-to-b from-white/[0.09] to-white/[0.03] text-zinc-100 shadow-[0_12px_40px_-12px_rgba(34,211,238,0.25),inset_0_1px_0_rgba(255,255,255,0.12)] transition-[transform,box-shadow,background-color] duration-500 hover:-translate-y-0.5 hover:shadow-[0_16px_44px_-10px_rgba(34,211,238,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--solace-cyan)]/35"
            aria-label="Play ambient soundscape (preview)"
          >
            <Play className="h-[18px] w-[18px]" fill="currentColor" />
          </button>
          <div className="min-w-0">
            <p className="truncate font-serif text-[15px] font-normal tracking-tight text-zinc-50/95">
              Night Calm
            </p>
            <p className="truncate text-[11px] tracking-wide text-[var(--solace-muted-soft)]">
              Ambient soundscape
            </p>
          </div>
          <div className="ml-auto hidden items-center gap-0.5 sm:flex">
            <button
              type="button"
              className="rounded-full p-2.5 text-zinc-600/90 transition-colors hover:bg-white/[0.05] hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35"
              aria-label="Pause"
            >
              <Pause className="h-[17px] w-[17px]" />
            </button>
            <button
              type="button"
              className="rounded-full p-2.5 text-zinc-600/90 transition-colors hover:bg-white/[0.05] hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35"
              aria-label="Skip"
            >
              <SkipForward className="h-[17px] w-[17px]" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 lg:flex lg:flex-wrap lg:items-end">
          <label className="flex flex-col gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--solace-muted-soft)]">
            Environment
            <select
              className="solace-scroll rounded-[0.85rem] border border-white/[0.09] bg-black/35 py-2.5 pl-3.5 pr-8 text-[13px] font-normal normal-case text-zinc-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/30"
              defaultValue="mountain-lake"
            >
              <option value="mountain-lake">Mountain Lake</option>
              <option value="forest">Mist Forest</option>
              <option value="coast">Quiet Coast</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--solace-muted-soft)]">
            Sound
            <select
              className="solace-scroll rounded-[0.85rem] border border-white/[0.09] bg-black/35 py-2.5 pl-3.5 pr-8 text-[13px] font-normal normal-case text-zinc-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/28"
              defaultValue="low-rain"
            >
              <option value="low-rain">Low Rain</option>
              <option value="ember">Soft Ember</option>
              <option value="dawn">Dawn Air</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--solace-muted-soft)]">
            Volume
            <input
              type="range"
              min={0}
              max={100}
              defaultValue={42}
              className="h-1.5 w-full cursor-pointer rounded-full accent-[var(--solace-purple)]"
              aria-label="Volume"
            />
          </label>
        </div>
      </div>
    </SolacePanel>
  );
}
