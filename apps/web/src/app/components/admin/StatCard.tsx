import { LucideIcon } from "lucide-react";
import { AdminCard } from "./AdminCard";
import { cn } from "@/lib/utils";
import { adminStatValue } from "@/app/admin/adminPageChrome";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  subtitle?: string;
}

export function StatCard({ title, value, icon: Icon, change, changeType = "neutral", subtitle }: StatCardProps) {
  const changeColors = {
    positive: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    negative: "text-rose-300 bg-rose-500/10 border-rose-500/20",
    neutral: "text-[var(--admin-text-muted)] bg-white/[0.04] border-[color:var(--admin-border)]",
  };

  return (
    <AdminCard className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="mb-1 text-sm font-medium text-[var(--admin-text-muted)]">{title}</p>
          <p className={cn(adminStatValue, "mb-1")}>{value}</p>
          {subtitle && (
            <p className="text-xs text-[var(--admin-text-muted)]">{subtitle}</p>
          )}
          {change && (
            <span
              className={cn(
                "mt-2 inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium",
                changeColors[changeType]
              )}
            >
              {change}
            </span>
          )}
        </div>
        <div
          className="rounded-xl border border-[color:var(--admin-border-glow-teal)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] p-3"
        >
          <Icon className="h-6 w-6 text-[var(--admin-primary)]" />
        </div>
      </div>
    </AdminCard>
  );
}
