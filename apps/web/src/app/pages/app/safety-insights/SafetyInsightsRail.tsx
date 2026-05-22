import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { ChevronRight, HandHeart, Info, Phone, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  wellnessPlanBtnRose,
  wellnessPlanIconChip,
  wellnessPlanRailActionRow,
  wellnessPlanRailCard,
} from "@/app/pages/app/wellness-plan-settings/wellnessPlanSettingsUi";
import {
  computeSafetySnapshot,
  SAFETY_SCORE_FORMULA_HINT,
  SNAPSHOT_DATA_SOURCES_HINT,
  type SafetyCheckInEntry,
  type SafetyInsightsData,
  type SafetySnapshotDisplay,
  type SnapshotTone,
} from "@/app/pages/app/safety-insights/safetyInsightsData";

export type { SafetyCheckInEntry };

export interface SafetyInsightsRailProps {
  insights: SafetyInsightsData;
  checkIns: SafetyCheckInEntry[];
}

function toneClassName(tone: SnapshotTone): string {
  if (tone === "emerald") return "text-emerald-300/90";
  if (tone === "amber") return "text-amber-300/90";
  return "text-rose-300/90";
}

function formatCheckInTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) {
    return `Today, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

interface SnapshotRowProps {
  label: string;
  value: string;
  detail?: string;
  valueClassName?: string;
}

function SnapshotRow({ label, value, detail, valueClassName }: SnapshotRowProps) {
  return (
    <div className="border-b border-white/[0.05] py-3 last:border-0 last:pb-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-[rgba(255,255,255,0.42)]">{label}</span>
        <span className={cn("text-sm font-medium text-white", valueClassName)}>{value}</span>
      </div>
      {detail ? (
        <p className="mt-1 text-[10px] leading-relaxed text-[rgba(255,255,255,0.38)]">{detail}</p>
      ) : null}
    </div>
  );
}

interface SafetySnapshotCardProps {
  snapshot: SafetySnapshotDisplay;
}

function SafetySnapshotCard({ snapshot }: SafetySnapshotCardProps) {
  return (
    <motion.div
      className={wellnessPlanRailCard}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
    >
      <h2 className="font-serif text-lg font-light text-white">Safety Snapshot</h2>
      <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">
        A calm read on where you are right now.
      </p>

      <div className="mt-4" role="list" aria-label="Safety snapshot metrics">
        <SnapshotRow
          label="Current Score"
          value={`${snapshot.safetyScore}%`}
          valueClassName={toneClassName(snapshot.scoreTone)}
          detail={SAFETY_SCORE_FORMULA_HINT}
        />
        <SnapshotRow
          label="Trend"
          value={snapshot.trendLabel}
          valueClassName={toneClassName(snapshot.trendTone)}
          detail={snapshot.trendDetail}
        />
        <SnapshotRow
          label="Risk Level"
          value={snapshot.riskLabel}
          valueClassName={toneClassName(snapshot.riskTone)}
          detail={snapshot.riskDetail}
        />
        <SnapshotRow
          label="Last Check-in"
          value={snapshot.lastCheckInLabel}
          detail={
            snapshot.lastCheckInSource === "mood"
              ? "From your latest mood check-in."
              : snapshot.lastCheckInSource === "safety"
                ? "From a recent safety moment."
                : snapshot.moodCheckInsLast30 === 0
                  ? "Log a mood check-in to start tracking."
                  : undefined
          }
        />
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-[rgba(255,255,255,0.35)]">
        <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        <span>
          {snapshot.moodCheckInsLast30} mood · {snapshot.safetyMomentsLast30} safety (30d)
          {snapshot.moodStreak > 0 ? ` · ${snapshot.moodStreak}-day streak` : ""}.{" "}
          {SNAPSHOT_DATA_SOURCES_HINT}
        </span>
      </p>
    </motion.div>
  );
}

export function SafetyInsightsRail({ insights, checkIns }: SafetyInsightsRailProps) {
  const snapshot = computeSafetySnapshot(insights, checkIns);

  return (
    <aside className="min-w-0 space-y-6 print:hidden xl:max-w-[340px]">
      <SafetySnapshotCard snapshot={snapshot} />

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
          to="/app/mood-history"
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
          "relative overflow-hidden border-rose-400/16",
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
      </motion.div>
    </aside>
  );
}
