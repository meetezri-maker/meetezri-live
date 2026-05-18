import type { ReactNode } from "react";
import { motion } from "motion/react";
import {
  Bell,
  ChevronRight,
  Mail,
  Moon,
  Phone,
  Smartphone,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  emergencyImmediateHelpCard,
  emergencyManageLink,
  emergencyPrefRow,
  emergencyRailCard,
  emergencyResourceRow,
  emergencyIconChip,
} from "@/app/pages/app/emergency-notifications/emergencyNotificationsUi";
import { RESOURCE_LINKS } from "@/app/pages/app/emergency-notifications/emergencyNotificationModel";
import { notificationsIconChip } from "@/app/pages/app/notifications-settings/notificationsSettingsUi";

interface EmergencyNotificationsRailProps {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  quietHoursLabel: string;
}

function PrefStatus({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={cn(
        "text-xs font-medium",
        enabled ? "text-emerald-300/90" : "text-[rgba(255,255,255,0.38)]"
      )}
    >
      {enabled ? "Enabled" : "Off"}
    </span>
  );
}

interface PrefRowProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}

function PrefRow({ icon, label, value }: PrefRowProps) {
  return (
    <div className={emergencyPrefRow}>
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm text-[rgba(255,255,255,0.88)]">{label}</span>
      </div>
      {value}
    </div>
  );
}

export function EmergencyNotificationsRail({
  inAppEnabled,
  emailEnabled,
  pushEnabled,
  quietHoursLabel,
}: EmergencyNotificationsRailProps) {
  return (
    <aside className="min-w-0 space-y-6 xl:max-w-[320px]">
      <motion.div
        className={emergencyRailCard}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        <h2 className="font-serif text-lg font-light text-white">Notification preferences</h2>
        <div className="mt-4">
          <PrefRow
            icon={
              <div className={emergencyIconChip("safety")}>
                <Bell className="h-4 w-4" aria-hidden />
              </div>
            }
            label="In-app notifications"
            value={<PrefStatus enabled={inAppEnabled} />}
          />
          <PrefRow
            icon={
              <div className={emergencyIconChip("system")}>
                <Mail className="h-4 w-4" aria-hidden />
              </div>
            }
            label="Email notifications"
            value={<PrefStatus enabled={emailEnabled} />}
          />
          <PrefRow
            icon={
              <div className={notificationsIconChip("cyan")}>
                <Smartphone className="h-4 w-4" aria-hidden />
              </div>
            }
            label="Push notifications"
            value={<PrefStatus enabled={pushEnabled} />}
          />
          <PrefRow
            icon={
              <div className={notificationsIconChip("violet")}>
                <Moon className="h-4 w-4" aria-hidden />
              </div>
            }
            label="Quiet hours"
            value={
              <span className="text-xs font-medium text-[rgba(255,255,255,0.5)]">{quietHoursLabel}</span>
            }
          />
        </div>
        <Link to="/app/settings/notifications" className={emergencyManageLink}>
          Manage Preferences
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </motion.div>

      <motion.div
        className={emergencyRailCard}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        <h2 className="font-serif text-lg font-light text-white">Helpful resources</h2>
        <div className="mt-2 divide-y divide-white/[0.05]">
          {RESOURCE_LINKS.map(({ to, title, subtitle, tone, icon: Icon }) => (
            <Link key={to} to={to} className={emergencyResourceRow}>
              <div className={notificationsIconChip(tone)} aria-hidden>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[rgba(255,255,255,0.92)]">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[rgba(255,255,255,0.42)]">{subtitle}</p>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-[rgba(255,255,255,0.28)] transition group-hover:translate-x-0.5 group-hover:text-violet-200/70"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </motion.div>

      <motion.div
        className={emergencyImmediateHelpCard}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div className="relative flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <Phone className="h-5 w-5 text-white" aria-hidden />
          </div>
          <div>
            <p className="font-serif text-lg font-light text-white">Need immediate help?</p>
            <p className="mt-1 text-sm text-white/80">Get support now.</p>
          </div>
        </div>
        <Link
          to="/app/session-lobby"
          className={cn(
            "relative mt-5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl",
            "bg-white/95 px-4 py-2.5 text-sm font-semibold text-fuchsia-800",
            "shadow-[0_8px_28px_-8px_rgba(0,0,0,0.35)] transition hover:bg-white"
          )}
        >
          Talk to Someone
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </motion.div>
    </aside>
  );
}
