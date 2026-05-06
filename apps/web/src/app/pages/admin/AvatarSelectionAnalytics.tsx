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
          <h2 className="text-xl font-semibold mb-4">Avatar Usage Graph</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading usage graph…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No usage data available for chart.</p>
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number, key: string) => {
                      if (key === "usagePercent") return [formatUsagePercent(value), "Usage"];
                      return [Number(value).toLocaleString(), "Talk it out"];
                    }}
                  />
                  <Bar dataKey="usagePercent" name="Usage %" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
