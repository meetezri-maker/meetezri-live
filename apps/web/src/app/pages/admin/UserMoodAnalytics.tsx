import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { api } from "../../../lib/api";
import { ArrowLeft, Heart, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MoodRow = {
  id: string;
  mood?: string;
  intensity?: number;
  created_at?: string;
  notes?: string | null;
};

const tooltipStyle = {
  backgroundColor: "rgba(255, 255, 255, 0.97)",
  border: "1px solid rgba(236, 72, 153, 0.22)",
  borderRadius: "14px",
  boxShadow: "0 16px 45px rgba(236, 72, 153, 0.14)",
  backdropFilter: "blur(6px)",
};

export function UserMoodAnalytics() {
  const { userId } = useParams<{ userId: string }>();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [moods, setMoods] = useState<MoodRow[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [u, rows] = await Promise.all([
          api.admin.getUserProfile(userId),
          api.moods.getUserMoods(userId),
        ]);
        if (cancelled) return;
        setUser(u);
        setMoods(Array.isArray(rows) ? rows : []);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setUser(null);
          setMoods([]);
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
    return [...moods]
      .filter((m) => m?.created_at)
      .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime())
      .slice(-60)
      .map((m) => ({
        day: new Date(m.created_at!).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        intensity: typeof m.intensity === "number" ? m.intensity : 0,
        mood: m.mood || "—",
      }));
  }, [moods]);

  const avgIntensity = useMemo(() => {
    const vals = moods.map((m) => (typeof m.intensity === "number" ? m.intensity : null)).filter((v): v is number => v != null);
    if (vals.length === 0) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }, [moods]);

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
              <Heart className="w-7 h-7 text-pink-600" />
              Mood Analytics
            </h1>
            <p className="text-sm text-muted-foreground">
              {user?.full_name || user?.email || "User"} • Last 60 entries
            </p>
          </div>
          <Link to="/admin/user-management">
            <Button variant="outline">User Management</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 bg-gradient-to-br from-white via-pink-50/50 to-rose-50/40 border-pink-100/60">
            <p className="text-sm text-muted-foreground">Total mood entries</p>
            <p className="text-3xl font-bold mt-1">{moods.length}</p>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-white via-pink-50/50 to-rose-50/40 border-pink-100/60">
            <p className="text-sm text-muted-foreground">Average intensity</p>
            <p className="text-3xl font-bold mt-1">{avgIntensity}/10</p>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-white via-pink-50/50 to-rose-50/40 border-pink-100/60">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Latest intensity
            </p>
            <p className="text-3xl font-bold mt-1">
              {(moods[0]?.intensity ?? "—") as any}/10
            </p>
          </Card>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6 bg-gradient-to-br from-white via-pink-50/40 to-rose-50/25 border-pink-100/70">
            <h2 className="text-lg font-bold mb-4">Mood intensity trend</h2>
            {loading ? (
              <div className="h-[320px] grid place-items-center text-sm text-muted-foreground">Loading…</div>
            ) : chartData.length === 0 ? (
              <div className="h-[320px] grid place-items-center text-sm text-muted-foreground">No mood data found.</div>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="moodPink" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ec4899" stopOpacity={0.35} />
                        <stop offset="85%" stopColor="#ec4899" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" stroke="#f3e8ff" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 10]} tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} width={32} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Intensity"]} />
                    <Area type="monotone" dataKey="intensity" stroke="#db2777" strokeWidth={2.5} fill="url(#moodPink)" />
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

