import { Link } from "react-router-dom";
import { Phone, Shield, Video, BookMarked } from "lucide-react";
import type { ReactNode } from "react";
import { SolacePanel } from "./SolacePanel";
import { cn } from "@/lib/utils";
import { DASHBOARD_IMAGES } from "@/lib/solace/dashboardImages";

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
    <SolacePanel glow="violet" className={cn("p-4 sm:p-5", className)}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <img
            src={DASHBOARD_IMAGES.quoteDecor}
            alt=""
            className="hidden h-14 w-14 shrink-0 rounded-xl object-cover object-center ring-1 ring-violet-400/20 sm:block"
            loading="lazy"
            decoding="async"
          />
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--solace-muted)]">
              When you need a hand
            </p>
            <p className="text-base font-medium text-[var(--solace-text)]">Need support right now?</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">{getSupportSlot}</div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {links.map(({ to, label, icon: Icon, danger }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "rounded-xl border border-white/[0.06] bg-black/25 px-3 py-3 text-center text-xs font-medium text-[var(--solace-text)] transition-all duration-500 hover:border-violet-400/25 hover:shadow-[var(--solace-glow-purple)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35",
              danger && "hover:border-rose-500/30 hover:shadow-[0_0_28px_rgba(190,18,60,0.18)]"
            )}
          >
            <Icon className="mx-auto mb-1.5 h-4 w-4 text-[var(--solace-muted)]" aria-hidden />
            {label}
          </Link>
        ))}
      </div>
    </SolacePanel>
  );
}
