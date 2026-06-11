import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayoutNew } from "@/app/components/AdminLayoutNew";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { api } from "@/lib/api";
import { DEFAULT_AI_COMPANIONS } from "@meetezri/shared";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  effectiveAvatarImageUrlFromDb,
  tryResolveCompanionPortraitUrl,
} from "@/lib/avatar/companionModelUrl";
import { Brain, ArrowLeft, User } from "lucide-react";

const AVATAR_CHART_COLORS: Record<string, string> = {
  Alex: "#3b82f6",
  "Alex Rivera": "#3b82f6",
  "Sara Mitchell": "#ec4899",
  "Sarah Mitchell": "#ec4899",
  "Jordan Taylor": "#10b981",
  "Maya Chen": "#f59e0b",
  Other: "#64748b",
};

const AVATAR_CHART_FALLBACK = ["#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#6366f1"];

const ADMIN_CHART_TOOLTIP = {
  backgroundColor: "var(--admin-chart-tooltip-bg, rgba(17, 22, 42, 0.96))",
  border: "1px solid var(--admin-chart-tooltip-border, rgba(167, 139, 250, 0.22))",
  borderRadius: "12px",
  boxShadow: "0 18px 50px rgba(0, 0, 0, 0.38)",
  color: "var(--admin-chart-tooltip-text, #f8fafc)",
  fontSize: 12,
};

type AvatarUsageRow = {
  id: string;
  name: string;
  image: string;
  createdAt: string | null;
  totalSessions: number;
  usagePercent: number;
};

function formatUsagePercent(value: number): string {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function formatCreatedAt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function resolveAvatarImage(name: string, imageUrl: string): string {
  const fromDb = effectiveAvatarImageUrlFromDb(imageUrl);
  if (fromDb) return fromDb;
  return tryResolveCompanionPortraitUrl(name) ?? "";
}

export function AvatarSelectionAnalytics() {
  const [rows, setRows] = useState<AvatarUsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchAvatarUsage = async () => {
      setLoading(true);
      try {
        const data = await api.aiAvatars.getAllWithUsageStats();
        const items = Array.isArray(data) ? data : [];
        const mapped: AvatarUsageRow[] = items.map((item: any) => {
          const sessions = Number.isFinite(item?.session_count) ? Number(item.session_count) : 0;
          return {
            id: String(item?.id ?? item?.name ?? `avatar-${Math.random().toString(36).slice(2)}`),
            name: String(item?.name ?? "Unknown avatar"),
            image: resolveAvatarImage(
              String(item?.name ?? ""),
              typeof item?.image_url === "string" ? item.image_url : ""
            ),
            createdAt: typeof item?.created_at === "string" ? item.created_at : null,
            totalSessions: sessions,
            usagePercent: 0,
          };
        });

        const fallbackRows: AvatarUsageRow[] =
          mapped.length > 0
            ? mapped
            : DEFAULT_AI_COMPANIONS.map((companion) => ({
                id: companion.id,
                name: companion.name,
                image: resolveAvatarImage(companion.name, ""),
                createdAt: null,
                totalSessions: 0,
                usagePercent: 0,
              }));

        const totalSessions = fallbackRows.reduce((sum, row) => sum + row.totalSessions, 0);
        const withUsage = fallbackRows
          .map((row) => ({
            ...row,
            usagePercent:
              totalSessions > 0 ? (row.totalSessions / totalSessions) * 100 : 0,
          }))
          .sort((a, b) => b.totalSessions - a.totalSessions);

        if (!cancelled) {
          setRows(withUsage);
        }
      } catch (error) {
        console.error("Failed to fetch avatar usage", error);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchAvatarUsage();

    return () => {
      cancelled = true;
    };
  }, []);

  const mostUsed = useMemo(() => rows.slice(0, 3), [rows]);

  const chartData = useMemo(
    () =>
      rows.map((row, index) => ({
        name: row.name,
        sessions: row.totalSessions,
        usagePercent: row.usagePercent,
        color:
          AVATAR_CHART_COLORS[row.name] ??
          AVATAR_CHART_FALLBACK[index % AVATAR_CHART_FALLBACK.length],
      })),
    [rows]
  );

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Avatar Selection Analytics</h1>
              <p className="text-muted-foreground">
                Most used avatars and complete usage breakdown
              </p>
            </div>
          </div>
          <Link to="/admin/super-admin-dashboard">
            <Button variant="outline" size="sm" type="button">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Avatar Usage</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Share of Talk it out sessions by avatar companion.
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading usage graph…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No usage data available for chart.</p>
          ) : (
            <>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--admin-chart-grid, rgba(167, 139, 250, 0.12))"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: "var(--admin-chart-axis, #667085)" }}
                      axisLine={{ stroke: "var(--admin-border, #E7DDFB)" }}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "var(--admin-chart-axis, #667085)" }}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(167, 139, 250, 0.08)" }}
                      contentStyle={ADMIN_CHART_TOOLTIP}
                      itemStyle={{ color: "#f8fafc" }}
                      labelStyle={{ color: "#b8c0d4" }}
                      formatter={(value: number, _key, item) => {
                        const row = item.payload as (typeof chartData)[number];
                        return [
                          `${Number(value).toLocaleString()} sessions (${formatUsagePercent(row.usagePercent)})`,
                          "Talk it out",
                        ];
                      }}
                    />
                    <Bar dataKey="sessions" name="Talk it out" radius={[8, 8, 0, 0]} maxBarSize={56}>
                      {chartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {chartData.map((item) => (
                  <div key={item.name} className="flex items-start gap-2 text-sm">
                    <div
                      className="mt-1 h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">{item.name}</span>
                      <span className="mx-1">·</span>
                      {item.sessions.toLocaleString()} sessions ({formatUsagePercent(item.usagePercent)})
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Most Used Avatars</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading avatar usage…</p>
          ) : mostUsed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No avatar usage found yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {mostUsed.map((avatar, index) => (
                <div
                  key={avatar.id}
                  className="rounded-xl border bg-white p-4 flex flex-col gap-3"
                >
                  <div className="text-xs font-medium text-muted-foreground">
                    #{index + 1} Most Used
                  </div>
                  <div className="w-24 h-24 rounded-xl overflow-hidden border bg-gray-50 flex items-center justify-center">
                    {avatar.image ? (
                      <img
                        src={avatar.image}
                        alt={avatar.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-10 h-10 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{avatar.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {avatar.totalSessions.toLocaleString()} sessions
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatUsagePercent(avatar.usagePercent)} usage
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">All Avatars</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading all avatars…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No avatars available to display.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-3 font-medium text-muted-foreground">Avatar</th>
                    <th className="pb-3 pr-3 font-medium text-muted-foreground">Name</th>
                    <th className="pb-3 pr-3 font-medium text-muted-foreground">Created At</th>
                    <th className="pb-3 pr-3 font-medium text-muted-foreground">Talk it out</th>
                    <th className="pb-3 font-medium text-muted-foreground">Usage %</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((avatar) => (
                    <tr key={avatar.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden border bg-gray-50 flex items-center justify-center">
                          {avatar.image ? (
                            <img
                              src={avatar.image}
                              alt={avatar.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-3 font-medium">{avatar.name}</td>
                      <td className="py-3 pr-3 text-muted-foreground">
                        {formatCreatedAt(avatar.createdAt)}
                      </td>
                      <td className="py-3 pr-3">{avatar.totalSessions.toLocaleString()}</td>
                      <td className="py-3">{formatUsagePercent(avatar.usagePercent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AdminLayoutNew>
  );
}
