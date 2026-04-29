import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { api } from "../../../lib/api";
import { Heart, RefreshCw } from "lucide-react";
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
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

const tooltipStyle = {
  backgroundColor: "rgba(255, 255, 255, 0.97)",
  border: "1px solid rgba(236, 72, 153, 0.22)",
  borderRadius: "14px",
  boxShadow: "0 16px 45px rgba(236, 72, 153, 0.14)",
  backdropFilter: "blur(6px)",
};

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthStart(year: number, monthIdx: number) {
  return new Date(year, monthIdx, 1, 0, 0, 0, 0);
}

function monthEndExclusive(year: number, monthIdx: number) {
  return new Date(year, monthIdx + 1, 1, 0, 0, 0, 0);
}

function monthLabel(monthIdx: number) {
  return new Date(2000, monthIdx, 1).toLocaleDateString(undefined, { month: "long" });
}

function moodEmoji(mood?: string) {
  const m = String(mood || "").trim().toLowerCase();
  const map: Record<string, string> = {
    happy: "😊",
    joy: "😊",
    excited: "🤩",
    calm: "😌",
    relaxed: "😌",
    neutral: "😐",
    anxious: "😰",
    stressed: "😫",
    sad: "😢",
    depressed: "😞",
    angry: "😡",
    tired: "😴",
    grateful: "🙏",
  };
  return map[m] || "🙂";
}

function titleCase(s: string) {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

type AdminUserRow = { id: string; name?: string; email?: string };

function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (next: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const end = Math.min(clampedPage * pageSize, total);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{start}</span>–
        <span className="font-semibold text-foreground">{end}</span> of{" "}
        <span className="font-semibold text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={clampedPage <= 1} onClick={() => onPageChange(clampedPage - 1)}>
          Prev
        </Button>
        <span className="text-muted-foreground">
          Page <span className="font-semibold text-foreground">{clampedPage}</span> / {totalPages}
        </span>
        <Button
          variant="outline"
          disabled={clampedPage >= totalPages}
          onClick={() => onPageChange(clampedPage + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function AllUsersMoodAnalytics() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MoodRow[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [entryQuery, setEntryQuery] = useState("");
  const [allUsers, setAllUsers] = useState<AdminUserRow[]>([]);

  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth());

  const [usersPage, setUsersPage] = useState(1);
  const [entriesPage, setEntriesPage] = useState(1);
  const pageSize = 25;

  const fetchAll = async () => {
    try {
      setLoading(true);
      const data = await api.moods.getAllMoods();
      const moodRows = Array.isArray(data) ? data : [];
      setRows(moodRows);

      // Build the user list from mood rows (avoids heavy /admin/users paging).
      const byEmail = new Map<string, AdminUserRow>();
      for (const r of moodRows) {
        const emailRaw = (r?.profiles?.email || "").trim().toLowerCase();
        if (!emailRaw) continue;
        if (byEmail.has(emailRaw)) continue;
        byEmail.set(emailRaw, {
          id: emailRaw,
          name: (r?.profiles?.full_name || "").trim() || undefined,
          email: emailRaw,
        });
      }
      setAllUsers(Array.from(byEmail.values()));
    } catch (e) {
      console.error(e);
      setRows([]);
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const period = useMemo(() => {
    const start = monthStart(filterYear, filterMonth);
    const end = monthEndExclusive(filterYear, filterMonth);
    return { start, end };
  }, [filterYear, filterMonth]);

  const periodRows = useMemo(() => {
    const s = period.start.getTime();
    const e = period.end.getTime();
    return rows.filter((r) => {
      const t = r.created_at ? new Date(r.created_at).getTime() : NaN;
      return Number.isFinite(t) && t >= s && t < e;
    });
  }, [rows, period]);

  const chartData = useMemo(() => {
    const map = new Map<string, { day: string; avg: number; n: number }>();
    for (const r of periodRows) {
      if (!r.created_at) continue;
      const key = ymd(new Date(r.created_at));
      const cur = map.get(key) ?? { day: new Date(key).toLocaleDateString(undefined, { month: "short", day: "numeric" }), avg: 0, n: 0 };
      const v = typeof r.intensity === "number" ? r.intensity : 0;
      const n2 = cur.n + 1;
      cur.avg = (cur.avg * cur.n + v) / n2;
      cur.n = n2;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => ({ day: v.day, avgIntensity: Math.round(v.avg * 10) / 10, samples: v.n }));
  }, [periodRows]);

  const topMoods = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of periodRows) {
      const k = (r.mood || "unknown").toLowerCase();
      count.set(k, (count.get(k) ?? 0) + 1);
    }
    return Array.from(count.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [periodRows]);

  const usersBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { name: string; email: string; entries30d: number; avgIntensity30d: number; _sum: number }
    >();
    for (const r of periodRows) {
      const email = (r.profiles?.email || "unknown").trim().toLowerCase();
      const name = (r.profiles?.full_name || "Unknown").trim() || "Unknown";
      const key = email || "unknown";
      const cur =
        map.get(key) ?? { name, email: email || "unknown", entries30d: 0, avgIntensity30d: 0, _sum: 0 };
      const v = typeof r.intensity === "number" ? r.intensity : 0;
      cur.entries30d += 1;
      cur._sum += v;
      cur.avgIntensity30d = Math.round(((cur._sum / cur.entries30d) * 10)) / 10;
      if (!cur.name || cur.name === "Unknown") cur.name = name;
      map.set(key, cur);
    }
    const all = allUsers.map((u) => {
      const email = (u.email || "unknown").trim().toLowerCase();
      const name = (u.name || (email && email !== "unknown" ? email.split("@")[0] : "User")).trim() || "User";
      const key = email || "unknown";
      const existing = map.get(key);
      return existing ?? { name, email: email || "unknown", entries30d: 0, avgIntensity30d: 0, _sum: 0 };
    });

    // add any rows missing from the directory (defensive)
    for (const v of map.values()) {
      if (!all.some((x) => x.email === v.email)) all.push(v);
    }

    const list = all.sort((a, b) => b.entries30d - a.entries30d);
    const q = userQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q));
  }, [periodRows, userQuery, allUsers]);

  useEffect(() => {
    setUsersPage(1);
  }, [userQuery, filterMonth, filterYear]);

  const filteredEntries = useMemo(() => {
    const q = entryQuery.trim().toLowerCase();
    const list = periodRows.slice().sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
    if (!q) return list;
    return list.filter((r) => {
      const email = (r.profiles?.email || "").toLowerCase();
      const name = (r.profiles?.full_name || "").toLowerCase();
      const mood = (r.mood || "").toLowerCase();
      const notes = (r.notes || "").toLowerCase();
      return email.includes(q) || name.includes(q) || mood.includes(q) || notes.includes(q);
    });
  }, [periodRows, entryQuery]);

  useEffect(() => {
    setEntriesPage(1);
  }, [entryQuery, filterMonth, filterYear]);

  const years = useMemo(() => {
    const ys = new Set<number>();
    for (const r of rows) {
      if (!r.created_at) continue;
      const y = new Date(r.created_at).getFullYear();
      if (Number.isFinite(y)) ys.add(y);
    }
    if (ys.size === 0) ys.add(new Date().getFullYear());
    return Array.from(ys).sort((a, b) => b - a);
  }, [rows]);

  const usersTotalPages = useMemo(
    () => Math.max(1, Math.ceil(usersBreakdown.length / pageSize)),
    [usersBreakdown.length, pageSize]
  );
  const usersPageClamped = Math.min(Math.max(1, usersPage), usersTotalPages);

  useEffect(() => {
    if (usersPage !== usersPageClamped) setUsersPage(usersPageClamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersPageClamped]);

  const entriesTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredEntries.length / pageSize)),
    [filteredEntries.length, pageSize]
  );
  const entriesPageClamped = Math.min(Math.max(1, entriesPage), entriesTotalPages);

  useEffect(() => {
    if (entriesPage !== entriesPageClamped) setEntriesPage(entriesPageClamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entriesPageClamped]);

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Heart className="w-7 h-7 text-pink-600" />
              All Users • Mood Analytics
            </h1>
            <p className="text-sm text-muted-foreground">Platform-wide mood entries (last 30 days focus)</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => fetchAll()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Card className="p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Filters</p>
              <p className="font-semibold">
                {monthLabel(filterMonth)} {filterYear}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={filterMonth}
                onChange={(e) => setFilterMonth(parseInt(e.target.value, 10))}
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i} value={i}>
                    {monthLabel(i)}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={filterYear}
                onChange={(e) => setFilterYear(parseInt(e.target.value, 10))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 bg-gradient-to-br from-white via-pink-50/50 to-rose-50/40 border-pink-100/60">
            <p className="text-sm text-muted-foreground">Total mood entries</p>
            <p className="text-3xl font-bold mt-1">{rows.length}</p>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-white via-pink-50/50 to-rose-50/40 border-pink-100/60">
            <p className="text-sm text-muted-foreground">Entries (selected month)</p>
            <p className="text-3xl font-bold mt-1">{periodRows.length}</p>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-white via-pink-50/50 to-rose-50/40 border-pink-100/60">
            <p className="text-sm text-muted-foreground">Top moods (selected month)</p>
            <div className="mt-2 space-y-1">
              {topMoods.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                topMoods.map(([m, c]) => (
                  <div key={m} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span aria-hidden>{moodEmoji(m)}</span>
                      <span className="capitalize">{m}</span>
                    </span>
                    <span className="font-semibold">{c}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6 bg-gradient-to-br from-white via-pink-50/40 to-rose-50/25 border-pink-100/70">
            <h2 className="text-lg font-bold mb-4">Average intensity per day</h2>
            {loading ? (
              <div className="h-[320px] grid place-items-center text-sm text-muted-foreground">Loading…</div>
            ) : chartData.length === 0 ? (
              <div className="h-[320px] grid place-items-center text-sm text-muted-foreground">No data in range.</div>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="allMoodPink" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ec4899" stopOpacity={0.35} />
                        <stop offset="85%" stopColor="#ec4899" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" stroke="#f3e8ff" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 10]} tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} width={32} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Avg intensity"]} />
                    <Area type="monotone" dataKey="avgIntensity" stroke="#db2777" strokeWidth={2.5} fill="url(#allMoodPink)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold">Users list</h2>
                <p className="text-sm text-muted-foreground">
                  Includes all users (even with 0 entries) for the selected month.
                </p>
              </div>
              <div className="w-full sm:w-80">
                <Input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Search user name or email…"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Entries</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg intensity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  ) : usersBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    usersBreakdown
                      .slice((usersPageClamped - 1) * pageSize, usersPageClamped * pageSize)
                      .map((u) => (
                      <tr key={u.email} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{u.name}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">
                          {u.entries30d}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">
                          {u.avgIntensity30d}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!loading && (
              <Pagination
                page={usersPageClamped}
                pageSize={pageSize}
                total={usersBreakdown.length}
                onPageChange={setUsersPage}
              />
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold">Mood entries</h2>
                <p className="text-sm text-muted-foreground">
                  Emoji + name + notes for the selected month.
                </p>
              </div>
              <div className="w-full sm:w-96">
                <Input
                  value={entryQuery}
                  onChange={(e) => setEntryQuery(e.target.value)}
                  placeholder="Search by user, email, mood, or notes…"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mood</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Intensity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  ) : filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No mood entries found.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries
                      .slice((entriesPageClamped - 1) * pageSize, entriesPageClamped * pageSize)
                      .map((r) => {
                        const dateLabel = r.created_at
                          ? new Date(r.created_at).toLocaleString(undefined, {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "2-digit",
                            })
                          : "—";
                        const name = (r.profiles?.full_name || "Unknown").trim() || "Unknown";
                        const email = (r.profiles?.email || "unknown").trim() || "unknown";
                        const moodName = titleCase(String(r.mood || "Unknown"));
                        return (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm whitespace-nowrap">{dateLabel}</td>
                            <td className="px-4 py-3 text-sm font-medium">{name}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{email}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className="inline-flex items-center gap-2">
                                <span aria-hidden>{moodEmoji(r.mood)}</span>
                                <span className="font-medium">{moodName}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">
                              {typeof r.intensity === "number" ? r.intensity : 0}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground max-w-[28rem] truncate">
                              {(r.notes || "").trim() || "—"}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
            {!loading && (
              <Pagination
                page={entriesPageClamped}
                pageSize={pageSize}
                total={filteredEntries.length}
                onPageChange={setEntriesPage}
              />
            )}
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}

