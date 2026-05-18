import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { ChevronRight, HandHeart, Heart, Phone, Target, Users } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";
import {
  wellnessPlanBtnGhost,
  wellnessPlanBtnRose,
  wellnessPlanIconChip,
  wellnessPlanRailActionRow,
  wellnessPlanRailCard,
} from "@/app/pages/app/wellness-plan-settings/wellnessPlanSettingsUi";

export interface SafetyCheckInEntry {
  timestamp: string;
  note: string;
}

export interface SafetyInsightsRailProps {
  safetyScore: number;
  trend: "increasing" | "decreasing" | "stable";
  last30DaysCount: number;
  checkIns: SafetyCheckInEntry[];
}

function formatCheckInTime(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return `Today, ${format(d, "h:mm a")}`;
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d, h:mm a");
}

function trendLabel(trend: SafetyInsightsRailProps["trend"]): string {
  if (trend === "decreasing") return "Improving";
  if (trend === "increasing") return "Needs care";
  return "Stable";
}

function riskLevel(score: number): { label: string; tone: "emerald" | "amber" | "rose" } {
  if (score >= 80) return { label: "Low", tone: "emerald" };
  if (score >= 50) return { label: "Moderate", tone: "amber" };
  return { label: "Elevated", tone: "rose" };
}

function SnapshotRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <motion.div className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-3 last:border-0 last:pb-0 first:pt-0">
      <span className="text-xs text-[rgba(255,255,255,0.42)]">{label}</span>
      <span className={cn("text-sm font-medium text-white", valueClassName)}>{value}</span>
    </motion.div>
  );
}

export function SafetyInsightsRail({
  safetyScore,
  trend,
  last30DaysCount,
  checkIns,
}: SafetyInsightsRailProps) {
  const risk = riskLevel(safetyScore);
  const lastCheckIn = checkIns[0];

  return (
    <aside className="min-w-0 space-y-6 print:hidden xl:max-w-[340px]">
      <motion.div
        className={wellnessPlanRailCard}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <h2 className="font-serif text-lg font-light text-white">Safety Snapshot</h2>
        <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">A calm read on where you are right now.</p>
        <div className="mt-4">
          <SnapshotRow label="Current Score" value={`${safetyScore}%`} valueClassName="text-emerald-300/90" />
          <SnapshotRow label="Trend" value={trendLabel(trend)} />
          <SnapshotRow
            label="Risk Level"
            value={risk.label}
            valueClassName={
              risk.tone === "emerald"
                ? "text-emerald-300/90"
                : risk.tone === "amber"
                  ? "text-amber-300/90"
                  : "text-rose-300/90"
            }
          />
          <SnapshotRow
            label="Last Check-in"
            value={
              lastCheckIn
                ? formatCheckInTime(lastCheckIn.timestamp)
                : last30DaysCount > 0
                  ? "Recently"
                  : "Not yet"
            }
          />
        </div>
      </motion.div>

      <motion.div
        className={wellnessPlanRailCard}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="font-serif text-lg font-light text-white">Recent Check-ins</h2>
        <div className="mt-4 space-y-0">
          {checkIns.length === 0 ? (
            <p className="text-xs leading-relaxed text-[rgba(255,255,255,0.45)]">
              Your recent safety moments will appear here as you check in and reflect.
            </p>
          ) : (
            checkIns.slice(0, 4).map((entry, i) => (
              <div
                key={`${entry.timestamp}-${i}`}
                className="relative border-l border-fuchsia-400/20 py-3 pl-4 first:pt-0 last:pb-0"
              >
                <span
                  className="absolute -left-[5px] top-4 h-2 w-2 rounded-full bg-fuchsia-400/80 shadow-[0_0_10px_rgba(236,72,153,0.55)] first:top-1"
                  aria-hidden
                />
                <p className="text-[11px] font-medium uppercase tracking-wider text-[rgba(255,255,255,0.38)]">
                  {formatCheckInTime(entry.timestamp)}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[rgba(255,255,255,0.78)]">{entry.note}</p>
              </div>
            ))
          )}
        </div>
        <Link
          to="/app/mood-check-in"
          className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-fuchsia-300/75 transition-colors hover:text-fuchsia-200"
        >
          View all check-ins
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </motion.div>

      <motion.div
        className={wellnessPlanRailCard}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h2 className="font-serif text-lg font-light text-white">Safety Plan Access</h2>
        <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">Quick paths when you need them.</p>
        <motion.div className="mt-4 space-y-2">
          <Link to="/app/settings/wellness-plan" className={wellnessPlanRailActionRow}>
            <div className={wellnessPlanIconChip("violet")}>
              <Target className="h-4 w-4" aria-hidden />
            </div>
            View Safety Plan
          </Link>
          <Link to="/app/emergency-resources" className={wellnessPlanRailActionRow}>
            <motion.div className={wellnessPlanIconChip("rose")}>
              <Phone className="h-4 w-4" aria-hidden />
            </motion.div>
            Emergency Resources
          </Link>
          <Link to="/app/settings/emergency-contacts" className={wellnessPlanRailActionRow}>
            <div className={wellnessPlanIconChip("pink")}>
              <Users className="h-4 w-4" aria-hidden />
            </div>
            Trusted Contacts
          </Link>
        </motion.div>
      </motion.div>

      <motion.div
        className={cn(
          wellnessPlanRailCard,
          "overflow-hidden border-rose-400/16",
          "bg-[linear-gradient(165deg,rgba(50,14,36,0.55)_0%,rgba(16,10,28,0.88)_100%)]"
        )}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-start gap-3">
          <motion.div className={wellnessPlanIconChip("rose")}>
            <HandHeart className="h-5 w-5" aria-hidden />
          </motion.div>
          <div>
            <h2 className="font-serif text-lg font-light text-white">Need Support Now?</h2>
            <p className="mt-2 text-xs leading-relaxed text-[rgba(255,255,255,0.55)]">
              If you&apos;re struggling, reaching out is a sign of strength—not weakness.
            </p>
          </div>
        </div>
        <div
          className="pointer-events-none absolute -right-6 -top-4 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(244,63,94,0.35)_0%,transparent_70%)]"
          aria-hidden
        />
        <Link to="/app/emergency-resources" className={cn(wellnessPlanBtnRose, "relative mt-5 w-full")}>
          Get Help Now
        </Link>
        <p className="relative mt-4 text-center text-xs italic text-rose-300/70">You are not alone.</p>
        <motion.div
          className="relative mt-4 flex justify-center"
          aria-hidden
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 ring-1 ring-rose-400/25 shadow-[0_0_32px_-8px_rgba(244,63,94,0.45)]">
            <Heart className="h-7 w-7 text-rose-300/90" />
          </div>
        </motion.div>
      </motion.div>
    </aside>
  );
}
