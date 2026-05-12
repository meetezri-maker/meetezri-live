import { Link } from "react-router-dom";
import { Phone, Shield, Video, BookMarked } from "lucide-react";
import type { ReactNode } from "react";
import { SolacePanel } from "./SolacePanel";
import { cn } from "@/lib/utils";

interface SolaceSupportStripProps {
  getSupportSlot: ReactNode;
  className?: string;
}

export function SolaceSupportStrip({ getSupportSlot, className }: SolaceSupportStripProps) {
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
      className={cn("relative overflow-hidden p-5 sm:p-6", className)}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_0%,rgba(109,40,217,0.08),transparent_55%)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--solace-muted-soft)]">
            When you need a hand
          </p>
          <p className="font-serif text-[1.05rem] font-normal tracking-tight text-zinc-100/95">
            Need support right now?
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">{getSupportSlot}</div>
      </div>
      <div className="relative mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {links.map(({ to, label, icon: Icon, danger }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "rounded-[0.95rem] border border-white/[0.06] bg-gradient-to-b from-black/28 to-black/[0.12] px-3 py-3.5 text-center text-[11.5px] font-medium leading-snug text-zinc-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-all duration-500 hover:border-violet-400/22 hover:bg-white/[0.03] hover:shadow-[0_0_36px_-12px_rgba(109,40,217,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/32",
              danger &&
                "hover:border-rose-400/28 hover:shadow-[0_0_32px_-10px_rgba(190,18,60,0.22)]"
            )}
          >
            <Icon
              className="mx-auto mb-2 h-[17px] w-[17px] text-zinc-500/90"
              aria-hidden
              strokeWidth={1.75}
            />
            {label}
          </Link>
        ))}
      </div>
    </SolacePanel>
  );
}
