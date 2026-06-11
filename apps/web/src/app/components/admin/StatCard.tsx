import { LucideIcon } from "lucide-react";
import { AdminCard } from "./AdminCard";
import { cn } from "@/lib/utils";
import {
  adminKpiCard,
  adminKpiIcon,
  adminStatValue,
  adminStatusPill,
} from "@/app/admin/adminPageChrome";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  subtitle?: string;
  iconVariant?: "violet" | "teal" | "amber" | "rose";
}

export function StatCard({
  title,
  value,
  icon: Icon,
  change,
  changeType = "neutral",
  subtitle,
  iconVariant = "teal",
}: StatCardProps) {
  const changeColors = {
    positive: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
    negative: "text-rose-300 bg-rose-500/10 border-rose-500/25",
    neutral: "text-[var(--admin-text-muted)] bg-white/[0.04] border-[color:var(--admin-border)]",
  };

  const iconColors = {
    violet: "text-[var(--admin-secondary)] border-[color:var(--admin-border-glow-soft)] bg-[color-mix(in_srgb,var(--admin-secondary)_12%,transparent)]",
    teal: "text-[var(--admin-primary)] border-[color:var(--admin-border-glow-teal)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)]",
    amber: "text-[var(--admin-accent)] border-[color:rgba(251,191,36,0.25)] bg-[color-mix(in_srgb,var(--admin-accent)_12%,transparent)]",
    rose: "text-[var(--admin-pink)] border-[color:rgba(236,72,153,0.25)] bg-[color-mix(in_srgb,var(--admin-pink)_12%,transparent)]",
  };

  return (
    <AdminCard className={adminKpiCard}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className={cn(adminKpiIcon, iconColors[iconVariant])}>
          <Icon className="h-5 w-5" />
        </div>
        {change && (
          <span className={cn(adminStatusPill, changeColors[changeType])}>{change}</span>
        )}
      </div>
      <p className="mb-1 text-sm font-medium text-[var(--admin-text-muted)]">{title}</p>
      <p className={cn(adminStatValue, "mb-1 text-2xl sm:text-3xl")}>{value}</p>
      {subtitle && <p className="text-xs leading-snug text-[var(--admin-text-muted)]">{subtitle}</p>}
    </AdminCard>
  );
}
