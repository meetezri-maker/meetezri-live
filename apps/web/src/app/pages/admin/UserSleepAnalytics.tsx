import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { api } from "../../../lib/api";
import { ArrowLeft, Moon, Clock } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type SleepRow = {
  id: string;
  bed_time?: string;
  wake_time?: string;
  quality_rating?: number | null;
  created_at?: string;
};

const tooltipStyle = {
  backgroundColor: "rgba(255, 255, 255, 0.97)",
  border: "1px solid rgba(99, 102, 241, 0.22)",
  borderRadius: "14px",
  boxShadow: "0 16px 45px rgba(67, 56, 202, 0.14)",
  backdropFilter: "blur(6px)",
};

function durationHours(bedIso?: string, wakeIso?: string): number | null {
  if (!bedIso || !wakeIso) return null;
  const b = new Date(bedIso).getTime();
  const w = new Date(wakeIso).getTime();
  if (!Number.isFinite(b) || !Number.isFinite(w) || w <= b) return null;
  return Math.round(((w - b) / (1000 * 60 * 60)) * 10) / 10;
}

export function UserSleepAnalytics() {
  const { userId } = useParams<{ userId: string }>();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [entries, setEntries] = useState<SleepRow[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [u, rows] = await Promise.all([
          api.admin.getUserProfile(userId),
          api.sleep.getUserEntries(userId),
        ]);
        if (cancelled) return;
        setUser(u);
        setEntries(Array.isArray(rows) ? rows : []);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setUser(null);
          setEntries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const chartData = useMemo(() => {
    return [...entries]
      .filter((e) => e.bed_time && e.wake_time)
      .sort((a, b) => new Date(a.bed_time!).getTime() - new Date(b.bed_time!).getTime())
      .slice(-30)
      .map((e) => ({
        day: new Date(e.bed_time!).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        hours: durationHours(e.bed_time, e.wake_time) ?? 0,
        quality: typeof e.quality_rating === "number" ? e.quality_rating : null,
      }));
  }, [entries]);

  const avgHours = useMemo(() => {
    const vals = entries.map((e) => durationHours(e.bed_time, e.wake_time)).filter((v): v is number => v != null);
    if (vals.length === 0) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }, [entries]);

  const avgQuality = useMemo(() => {
    const vals = entries.map((e) => (typeof e.quality_rating === "number" ? e.quality_rating : null)).filter((v): v is number => v != null);
    if (vals.length === 0) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }, [entries]);

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link to={userId ? `/admin/user-details-enhanced/${userId}` : "/admin/user-management"}>
              <Button variant="ghost" className="gap-2 mb-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Moon className="w-7 h-7 text-indigo-600" />
              Sleep Log Analytics
            </h1>
            <p className="text-sm text-muted-foreground">
              {user?.full_name || user?.email || "User"} • Last 30 entries
            </p>
          </div>
          <Link to="/admin/user-management">
            <Button variant="outline">User Management</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 bg-gradient-to-br from-white via-indigo-50/40 to-blue-50/30 border-indigo-100/60">
            <p className="text-sm text-muted-foreground">Total sleep entries</p>
            <p className="text-3xl font-bold mt-1">{entries.length}</p>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-white via-indigo-50/40 to-blue-50/30 border-indigo-100/60">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Average sleep hours
            </p>
            <p className="text-3xl font-bold mt-1">{avgHours}h</p>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-white via-indigo-50/40 to-blue-50/30 border-indigo-100/60">
            <p className="text-sm text-muted-foreground">Average quality</p>
            <p className="text-3xl font-bold mt-1">{avgQuality}</p>
          </Card>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6 bg-gradient-to-br from-white via-indigo-50/30 to-blue-50/20 border-indigo-100/70">
            <h2 className="text-lg font-bold mb-4">Sleep duration (hours)</h2>
            {loading ? (
              <div className="h-[320px] grid place-items-center text-sm text-muted-foreground">Loading…</div>
            ) : chartData.length === 0 ? (
              <div className="h-[320px] grid place-items-center text-sm text-muted-foreground">No sleep data found.</div>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sleepIndigo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="85%" stopColor="#6366f1" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" stroke="#e8e8ed" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} width={32} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}h`, "Sleep"]} />
                    <Area type="monotone" dataKey="hours" stroke="#4338ca" strokeWidth={2.5} fill="url(#sleepIndigo)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}

