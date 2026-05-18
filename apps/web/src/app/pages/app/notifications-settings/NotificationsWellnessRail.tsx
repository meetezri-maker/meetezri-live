import { motion } from "motion/react";
import { Heart, Headphones, Moon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  NOTIFICATIONS_FOREST_IMG,
  NOTIFICATIONS_WATER_IMG,
  notificationsBtnPrimary,
  notificationsIconChip,
  notificationsRailCard,
} from "@/app/pages/app/notifications-settings/notificationsSettingsUi";

interface NotificationsWellnessRailProps {
  unreadCount: number;
  readCount: number;
  quietMode: boolean;
  onQuietModeChange: (value: boolean) => void;
}

function QuietModeToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Quiet mode"
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      className={cn(
        "relative h-8 w-14 shrink-0 rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50",
        enabled ? "bg-violet-500/55 shadow-[0_0_20px_-4px_rgba(139,92,246,0.55)]" : "bg-white/10"
      )}
    >
      <motion.span
        animate={{ x: enabled ? 26 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className="absolute top-1 left-0 h-6 w-6 rounded-full bg-white shadow-md"
      />
    </motion.button>
  );
}

export function NotificationsWellnessRail({
  unreadCount,
  readCount,
  quietMode,
  onQuietModeChange,
}: NotificationsWellnessRailProps) {
  const total = unreadCount + readCount;
  const readPct = total > 0 ? (readCount / total) * 100 : 0;
  const unreadPct = total > 0 ? (unreadCount / total) * 100 : 0;

  return (
    <aside className="min-w-0 space-y-5 xl:max-w-[340px]">
      <div className={notificationsRailCard}>
        <h2 className="font-serif text-lg font-light text-white">Notification overview</h2>
        <div className="mt-5 flex items-center gap-5">
          <motion.div
            className="relative h-[108px] w-[108px] shrink-0 rounded-full"
            style={{
              background: `conic-gradient(#ec4899 0% ${unreadPct}%, #3b82f6 ${unreadPct}% ${unreadPct + readPct}%, rgba(255,255,255,0.08) ${unreadPct + readPct}% 100%)`,
            }}
          >
            <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-[#0c0e1c]/95 text-center">
              <span className="text-2xl font-semibold text-white">{unreadCount}</span>
              <span className="text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.45)]">Unread</span>
            </div>
          </motion.div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-pink-400" />
              <span className="text-[rgba(255,255,255,0.7)]">Unread {unreadCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-[rgba(255,255,255,0.7)]">Read {readCount}</span>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-[rgba(255,255,255,0.45)]">
          You&apos;re doing great. Most of your updates are supportive reminders.
        </p>
      </div>

      <div className={notificationsRailCard}>
        <motion.div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className={notificationsIconChip("violet")}>
              <Moon className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <h2 className="font-serif text-lg font-light text-white">Quiet mode</h2>
              <p className="mt-2 text-xs leading-relaxed text-[rgba(255,255,255,0.45)]">
                Reduce interruptions and receive only essential emotional updates.
              </p>
            </div>
          </div>
          <QuietModeToggle enabled={quietMode} onToggle={() => onQuietModeChange(!quietMode)} />
        </motion.div>
      </div>

      <div className={cn(notificationsRailCard, "overflow-hidden p-0")}>
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <motion.div className={notificationsIconChip("cyan")}>
              <Heart className="h-4 w-4" aria-hidden />
            </motion.div>
            <h2 className="font-serif text-lg font-light text-white">Wellness pulse</h2>
          </div>
          <p className="mt-3 text-sm text-[rgba(255,255,255,0.55)]">You&apos;ve stayed consistent this week.</p>
          <div className="mt-4 flex justify-between gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2 flex-1 rounded-full",
                  i < 5
                    ? "bg-gradient-to-r from-fuchsia-400 to-violet-400 shadow-[0_0_10px_-2px_rgba(236,72,153,0.5)]"
                    : "bg-white/10"
                )}
              />
            ))}
          </div>
        </div>
        <div className="relative h-20 overflow-hidden">
          <img src={NOTIFICATIONS_WATER_IMG} alt="" className="h-full w-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e1c] to-transparent" />
        </div>
      </div>

      <div className={notificationsRailCard}>
        <div className="flex items-start gap-3">
          <div className="relative">
            <div className={notificationsIconChip("emerald")}>
              <Headphones className="h-4 w-4" aria-hidden />
            </div>
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0c0e1c] bg-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg font-light text-white">Support is here</h2>
            <p className="mt-1 text-sm text-emerald-200/80">Support is available 24/7</p>
            <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">We typically respond within 2 hours.</p>
            <Link to="/app/settings/help-support" className={cn(notificationsBtnPrimary, "mt-4 w-full")}>
              Contact support
            </Link>
          </div>
        </div>
      </div>

      <div className={cn(notificationsRailCard, "relative min-h-[220px] overflow-hidden p-0")}>
        <img src={NOTIFICATIONS_FOREST_IMG} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0b18] via-[#0a0b18]/55 to-[#0a0b18]/25" />
        <div className="relative flex min-h-[220px] flex-col items-center justify-end p-6 text-center">
          <p className="font-serif text-lg leading-snug text-white">
            You are not behind.
            <br />
            Small steps still matter.
          </p>
          <Heart className="mt-3 h-4 w-4 text-rose-300/80" aria-hidden />
        </div>
      </div>
    </aside>
  );
}
