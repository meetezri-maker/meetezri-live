import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { api } from "../../../lib/api";
import { ArrowLeft, BookOpen, CalendarDays } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type JournalRow = {
  id: string;
  title?: string | null;
  created_at?: string;
  mood_tags?: string[] | null;
};

const tooltipStyle = {
  backgroundColor: "rgba(255, 255, 255, 0.97)",
  border: "1px solid rgba(99, 102, 241, 0.22)",
  borderRadius: "14px",
  boxShadow: "0 16px 45px rgba(67, 56, 202, 0.14)",
  backdropFilter: "blur(6px)",
};

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function UserJournalAnalytics() {
  const { userId } = useParams<{ userId: string }>();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [journals, setJournals] = useState<JournalRow[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [u, rows] = await Promise.all([
          api.admin.getUserProfile(userId),
          api.journal.getUserJournals(userId),
        ]);
        if (cancelled) return;
        setUser(u);
        setJournals(Array.isArray(rows) ? rows : []);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setUser(null);
          setJournals([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const j of journals) {
      if (!j.created_at) continue;
      const key = ymd(new Date(j.created_at));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const days = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30);
    return days.map(([k, v]) => ({
      day: new Date(k).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      entries: v,
    }));
  }, [journals]);

  const avgPerWeek = useMemo(() => {
    if (journals.length === 0) return 0;
    const min = Math.min(...journals.filter((j) => j.created_at).map((j) => new Date(j.created_at!).getTime()));
    const max = Math.max(...journals.filter((j) => j.created_at).map((j) => new Date(j.created_at!).getTime()));
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0;
    const weeks = Math.max(1, Math.ceil((max - min) / (7 * 24 * 60 * 60 * 1000)));
    return Math.round((journals.length / weeks) * 10) / 10;
  }, [journals]);

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
              <BookOpen className="w-7 h-7 text-indigo-600" />
              Journal Analytics
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
          <Card className="p-5 bg-gradient-to-br from-white via-indigo-50/45 to-blue-50/35 border-indigo-100/60">
            <p className="text-sm text-muted-foreground">Total journal entries</p>
            <p className="text-3xl font-bold mt-1">{journals.length}</p>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-white via-indigo-50/45 to-blue-50/35 border-indigo-100/60">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Avg entries / week
            </p>
            <p className="text-3xl font-bold mt-1">{avgPerWeek}</p>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-white via-indigo-50/45 to-blue-50/35 border-indigo-100/60">
            <p className="text-sm text-muted-foreground">Days with entries (30d)</p>
            <p className="text-3xl font-bold mt-1">{byDay.filter((d) => d.entries > 0).length}</p>
          </Card>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6 bg-gradient-to-br from-white via-indigo-50/35 to-blue-50/25 border-indigo-100/70">
            <h2 className="text-lg font-bold mb-4">Entries per day</h2>
            {loading ? (
              <div className="h-[320px] grid place-items-center text-sm text-muted-foreground">Loading…</div>
            ) : byDay.length === 0 ? (
              <div className="h-[320px] grid place-items-center text-sm text-muted-foreground">No journal data found.</div>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDay} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="journalBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                        <stop offset="70%" stopColor="#4f46e5" stopOpacity={0.96} />
                        <stop offset="100%" stopColor="#4338ca" stopOpacity={0.92} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" stroke="#e8e8ed" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Entries"]} />
                    <Bar dataKey="entries" fill="url(#journalBar)" radius={[12, 12, 4, 4]} maxBarSize={34} />
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

