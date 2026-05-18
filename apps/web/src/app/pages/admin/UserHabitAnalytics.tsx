import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { api } from "../../../lib/api";
import { ArrowLeft, Target, Flame } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type HabitRow = {
  id: string;
  name?: string;
  category?: string;
  frequency?: string;
  created_at?: string;
  habit_logs?: { completed_at: string }[];
};

const tooltipStyle = {
  backgroundColor: "rgba(255, 255, 255, 0.97)",
  border: "1px solid rgba(13, 148, 136, 0.22)",
  borderRadius: "14px",
  boxShadow: "0 16px 45px rgba(13, 148, 136, 0.14)",
  backdropFilter: "blur(6px)",
};

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function UserHabitAnalytics() {
  const { userId } = useParams<{ userId: string }>();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [habits, setHabits] = useState<HabitRow[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [u, rows] = await Promise.all([
          api.admin.getUserProfile(userId),
          api.habits.getUserHabits(userId),
        ]);
        if (cancelled) return;
        setUser(u);
        setHabits(Array.isArray(rows) ? rows : []);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setUser(null);
          setHabits([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const completionByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of habits) {
      for (const l of h.habit_logs || []) {
        if (!l?.completed_at) continue;
        const key = ymd(new Date(l.completed_at));
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    const items = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
    return items.map(([k, v]) => ({
      day: new Date(k).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      completions: v,
    }));
  }, [habits]);

  const totalCompletions = useMemo(() => {
    let c = 0;
    for (const h of habits) c += (h.habit_logs || []).length;
    return c;
  }, [habits]);

  const topHabit = useMemo(() => {
    if (habits.length === 0) return null;
    const sorted = [...habits].sort((a, b) => (b.habit_logs?.length ?? 0) - (a.habit_logs?.length ?? 0));
    return sorted[0] ?? null;
  }, [habits]);

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
              <Target className="w-7 h-7 text-teal-600" />
              Habit Tracker Analytics
            </h1>
            <p className="text-sm text-muted-foreground">
              {user?.full_name || user?.email || "User"} • Last 30 days
            </p>
          </div>
          <Link to="/admin/user-management">
            <Button variant="outline">User Management</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 bg-gradient-to-br from-white via-teal-50/40 to-emerald-50/30 border-teal-100/60">
            <p className="text-sm text-muted-foreground">Active habits</p>
            <p className="text-3xl font-bold mt-1">{habits.length}</p>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-white via-teal-50/40 to-emerald-50/30 border-teal-100/60">
            <p className="text-sm text-muted-foreground">Total completions</p>
            <p className="text-3xl font-bold mt-1">{totalCompletions}</p>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-white via-teal-50/40 to-emerald-50/30 border-teal-100/60">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Flame className="w-4 h-4" />
              Top habit
            </p>
            <p className="text-xl font-bold mt-2 truncate">{topHabit?.name || "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(topHabit?.habit_logs?.length ?? 0).toLocaleString()} completions
            </p>
          </Card>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6 bg-gradient-to-br from-white via-teal-50/30 to-emerald-50/20 border-teal-100/70">
            <h2 className="text-lg font-bold mb-4">Completions per day</h2>
            {loading ? (
              <div className="h-[320px] grid place-items-center text-sm text-muted-foreground">Loading…</div>
            ) : completionByDay.length === 0 ? (
              <div className="h-[320px] grid place-items-center text-sm text-muted-foreground">No habit logs found.</div>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={completionByDay} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="habitBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5eead4" stopOpacity={1} />
                        <stop offset="70%" stopColor="#14b8a6" stopOpacity={0.96} />
                        <stop offset="100%" stopColor="#0f766e" stopOpacity={0.92} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" stroke="#e8e8ed" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Completions"]} />
                    <Bar dataKey="completions" fill="url(#habitBar)" radius={[12, 12, 4, 4]} maxBarSize={34} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}

