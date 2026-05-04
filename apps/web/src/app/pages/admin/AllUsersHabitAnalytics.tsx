import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { api } from "../../../lib/api";
import { RefreshCw, Target, Flame, Eye } from "lucide-react";
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
  profiles?: { full_name?: string | null; email?: string | null } | null;
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

function monthStart(year: number, monthIdx: number) {
  return new Date(year, monthIdx, 1, 0, 0, 0, 0);
}

function monthEndExclusive(year: number, monthIdx: number) {
  return new Date(year, monthIdx + 1, 1, 0, 0, 0, 0);
}

function monthLabel(monthIdx: number) {
  return new Date(2000, monthIdx, 1).toLocaleDateString(undefined, { month: "long" });
}

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  // JS: 0=Sun...6=Sat. We want Monday start.
  const day = x.getDay();
  const diff = (day + 6) % 7; // Mon->0, Tue->1, ... Sun->6
  x.setDate(x.getDate() - diff);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
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

export function AllUsersHabitAnalytics() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<HabitRow[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [entryQuery, setEntryQuery] = useState("");
  const [allUsers, setAllUsers] = useState<AdminUserRow[]>([]);

  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [weekOffset, setWeekOffset] = useState(0);

  const [usersPage, setUsersPage] = useState(1);
  const [entriesPage, setEntriesPage] = useState(1);
  const pageSize = 25;

  const emailToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of allUsers) {
      const email = (u.email || "").trim().toLowerCase();
      if (email) m.set(email, String(u.id));
    }
    return m;
  }, [allUsers]);

  const fetchAll = async (year = filterYear, month = filterMonth) => {
    try {
      setLoading(true);
      // Fetch one extra week on each side so the weekly view has data when spanning months
      const start = new Date(year, month, 1, 0, 0, 0, 0);
      start.setDate(start.getDate() - 7);
      const end = new Date(year, month + 1, 1, 0, 0, 0, 0);
      end.setDate(end.getDate() + 7);
      const [data, users] = await Promise.all([
        api.habits.getAllHabitsAdmin({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        }),
        api.admin.getUsers({ page: 1, limit: 1000 }).then((res: any) => {
          const list = Array.isArray(res) ? res : Array.isArray(res?.users) ? res.users : [];
          return list.map((u: any) => ({
            id: String(u.id),
            name: u.name ?? u.full_name ?? u.fullName ?? null,
            email: u.email ?? null,
          }));
        }),
      ]);
      setRows(Array.isArray(data) ? data : []);
      setAllUsers(users);
    } catch (e) {
      console.error(e);
      setRows([]);
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll(filterYear, filterMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterYear, filterMonth]);

  const period = useMemo(() => ({
    start: monthStart(filterYear, filterMonth),
    end: monthEndExclusive(filterYear, filterMonth),
  }), [filterYear, filterMonth]);

  const week = useMemo(() => {
    // Anchor on "today" shifted by weekOffset; then compute Monday..Sunday.
    const anchor = addDays(new Date(), weekOffset * 7);
    const start = startOfWeekMonday(anchor);
    const days = Array.from({ length: 7 }).map((_, i) => addDays(start, i));
    return { start, days };
  }, [weekOffset]);

  const weekProgressRows = useMemo(() => {
    const s = week.start.getTime();
    const e = addDays(week.start, 7).getTime();
    const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const list = rows.map((h) => {
      const habit = (h.name || "Untitled").trim() || "Untitled";
      const user = (h.profiles?.full_name || "Unknown").trim() || "Unknown";
      const email = (h.profiles?.email || "unknown").trim() || "unknown";

      const completed = new Set<number>();
      for (const l of h.habit_logs || []) {
        const t = new Date(l.completed_at).getTime();
        if (!Number.isFinite(t) || t < s || t >= e) continue;
        const d = new Date(l.completed_at);
        // convert to Mon=0..Sun=6
        const idx = (d.getDay() + 6) % 7;
        completed.add(idx);
      }
      return { id: h.id, habit, user, email, weekDays, completed };
    });

    const q = userQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.habit.toLowerCase().includes(q) ||
        r.user.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
    );
  }, [rows, week, userQuery]);

  const completionsByDay = useMemo(() => {
    const s = period.start.getTime();
    const e = period.end.getTime();
    const map = new Map<string, number>();
    for (const h of rows) {
      for (const l of h.habit_logs || []) {
        const t = new Date(l.completed_at).getTime();
        if (!Number.isFinite(t) || t < s || t >= e) continue;
        const key = ymd(new Date(l.completed_at));
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({
        day: String(new Date(`${k}T00:00:00`).getDate()),
        dateLabel: new Date(`${k}T00:00:00`).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        completions: v,
      }));
  }, [rows, period]);

  const totalCompletions = useMemo(
    () => completionsByDay.reduce((s, x) => s + x.completions, 0),
    [completionsByDay]
  );

  const topHabits = useMemo(() => {
    const s = period.start.getTime();
    const e = period.end.getTime();
    const counts = new Map<string, number>();
    for (const h of rows) {
      const name = (h.name || "Untitled").trim();
      let c = 0;
      for (const l of h.habit_logs || []) {
        const t = new Date(l.completed_at).getTime();
        if (Number.isFinite(t) && t >= s && t < e) c += 1;
      }
      if (c > 0) counts.set(name, (counts.get(name) ?? 0) + c);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [rows, period]);

  const usersBreakdown = useMemo(() => {
    const s = period.start.getTime();
    const e = period.end.getTime();
    const map = new Map<string, { name: string; email: string; activeHabits: number; completions30d: number }>();
    for (const h of rows) {
      const email = (h.profiles?.email || "unknown").trim().toLowerCase();
      const name = (h.profiles?.full_name || "Unknown").trim() || "Unknown";
      const key = email || "unknown";
      const cur = map.get(key) ?? { name, email: email || "unknown", activeHabits: 0, completions30d: 0 };
      cur.activeHabits += 1;
      for (const l of h.habit_logs || []) {
        const t = new Date(l.completed_at).getTime();
        if (Number.isFinite(t) && t >= s && t < e) cur.completions30d += 1;
      }
      if (!cur.name || cur.name === "Unknown") cur.name = name;
      map.set(key, cur);
    }
    const all = allUsers.map((u) => {
      const email = (u.email || "unknown").trim().toLowerCase();
      const name = (u.name || (email && email !== "unknown" ? email.split("@")[0] : "User")).trim() || "User";
      const key = email || "unknown";
      const existing = map.get(key);
      return existing ?? { name, email: email || "unknown", activeHabits: 0, completions30d: 0 };
    });
    for (const v of map.values()) {
      if (!all.some((x) => x.email === v.email)) all.push(v);
    }
    const list = all.sort((a, b) => b.completions30d - a.completions30d);
    const q = userQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q));
  }, [rows, userQuery, allUsers, period]);

  useEffect(() => {
    setUsersPage(1);
  }, [userQuery, filterMonth, filterYear]);

  useEffect(() => {
    setWeekOffset(0);
  }, [filterMonth, filterYear]);

  const completionEntries = useMemo(() => {
    const s = period.start.getTime();
    const e = period.end.getTime();
    const flat: Array<{ id: string; completed_at: string; habit: string; user: string; email: string }> = [];
    for (const h of rows) {
      const habit = (h.name || "Untitled").trim() || "Untitled";
      const user = (h.profiles?.full_name || "Unknown").trim() || "Unknown";
      const email = (h.profiles?.email || "unknown").trim() || "unknown";
      for (const l of h.habit_logs || []) {
        const t = new Date(l.completed_at).getTime();
        if (!Number.isFinite(t) || t < s || t >= e) continue;
        flat.push({
          id: `${h.id}:${l.completed_at}`,
          completed_at: l.completed_at,
          habit,
          user,
          email,
        });
      }
    }
    flat.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
    const q = entryQuery.trim().toLowerCase();
    if (!q) return flat;
    return flat.filter((r) => {
      return (
        r.habit.toLowerCase().includes(q) ||
        r.user.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
      );
    });
  }, [rows, entryQuery, period]);

  useEffect(() => {
    setEntriesPage(1);
  }, [entryQuery, filterMonth, filterYear]);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 4 }, (_, i) => currentYear - i);
  }, []);

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Target className="w-7 h-7 text-teal-600" />
              All Users • Habit Tracker
            </h1>
            <p className="text-sm text-muted-foreground">Habits and completions</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => fetchAll(filterYear, filterMonth)} disabled={loading}>
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
          <Card className="p-5 bg-gradient-to-br from-white via-teal-50/40 to-emerald-50/30 border-teal-100/60">
            <p className="text-sm text-muted-foreground">Active habits (this month)</p>
            <p className="text-3xl font-bold mt-1">{rows.length}</p>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-white via-teal-50/40 to-emerald-50/30 border-teal-100/60">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Flame className="w-4 h-4" />
              Completions (selected month)
            </p>
            <p className="text-3xl font-bold mt-1">{totalCompletions}</p>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-white via-teal-50/40 to-emerald-50/30 border-teal-100/60">
            <p className="text-sm text-muted-foreground">Top habits (selected month)</p>
            <div className="mt-2 space-y-1">
              {topHabits.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                topHabits.map(([n, c]) => (
                  <div key={n} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[12rem]">{n}</span>
                    <span className="font-semibold">{c}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6 bg-gradient-to-br from-white via-teal-50/30 to-emerald-50/20 border-teal-100/70">
            <h2 className="text-lg font-bold mb-4">Completions per day</h2>
            {loading ? (
              <div className="h-[320px] grid place-items-center text-sm text-muted-foreground">Loading…</div>
            ) : completionsByDay.length === 0 ? (
              <div className="h-[320px] grid place-items-center text-sm text-muted-foreground">No data in range.</div>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={completionsByDay} margin={{ top: 10, right: 12, left: 0, bottom: 18 }}>
                    <defs>
                      <linearGradient id="allHabitBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5eead4" stopOpacity={1} />
                        <stop offset="70%" stopColor="#14b8a6" stopOpacity={0.96} />
                        <stop offset="100%" stopColor="#0f766e" stopOpacity={0.92} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" stroke="#e8e8ed" vertical={false} />
                    <XAxis
                      dataKey="day"
                      interval="preserveStartEnd"
                      minTickGap={8}
                      tick={{ fill: "#64748b", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number) => [v, "Completions"]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.dateLabel ?? ""}
                    />
                    <Bar dataKey="completions" fill="url(#allHabitBar)" radius={[12, 12, 4, 4]} maxBarSize={34} />
                  </BarChart>
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
                  Includes all users (even with 0 completions) for the selected month.
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
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Active habits</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Completions (30d)</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  ) : usersBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    usersBreakdown
                      .slice((usersPage - 1) * pageSize, usersPage * pageSize)
                      .map((u) => {
                        const userId = emailToId.get(u.email.toLowerCase());
                        return (
                        <tr key={u.email} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium">{u.name}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">
                            {u.activeHabits}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">
                            {u.completions30d}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {userId ? (
                              <Link
                                to={`/admin/user-analytics/habits/${userId}`}
                                className="inline-flex items-center justify-center rounded-md p-1.5 text-teal-600 hover:bg-teal-50 transition-colors"
                                title="View user habit details"
                              >
                                <Eye size={16} />
                              </Link>
                            ) : (
                              <span className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-300 cursor-not-allowed">
                                <Eye size={16} />
                              </span>
                            )}
                          </td>
                        </tr>
                      )})
                  )}
                </tbody>
              </table>
            </div>
            {!loading && (
              <Pagination
                page={usersPage}
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
                <h2 className="text-lg font-bold">Habit completions</h2>
                <p className="text-sm text-muted-foreground">All completion rows for the selected month.</p>
              </div>
              <div className="w-full sm:w-96">
                <Input
                  value={entryQuery}
                  onChange={(e) => setEntryQuery(e.target.value)}
                  placeholder="Search by habit, user, or email…"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Habit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  ) : completionEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No completions found.
                      </td>
                    </tr>
                  ) : (
                    completionEntries
                      .slice((entriesPage - 1) * pageSize, entriesPage * pageSize)
                      .map((r) => {
                        const dateLabel = new Date(r.completed_at).toLocaleString(undefined, {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                        });
                        const userId = emailToId.get(r.email.toLowerCase());
                        return (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm whitespace-nowrap">{dateLabel}</td>
                            <td className="px-4 py-3 text-sm font-medium">{r.habit}</td>
                            <td className="px-4 py-3 text-sm">{r.user}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{r.email}</td>
                            <td className="px-4 py-3 text-center">
                              {userId ? (
                                <Link
                                  to={`/admin/user-analytics/habits/${userId}`}
                                  className="inline-flex items-center justify-center rounded-md p-1.5 text-teal-600 hover:bg-teal-50 transition-colors"
                                  title="View user habit details"
                                >
                                  <Eye size={16} />
                                </Link>
                              ) : (
                                <span className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-300 cursor-not-allowed">
                                  <Eye size={16} />
                                </span>
                              )}
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
                page={entriesPage}
                pageSize={pageSize}
                total={completionEntries.length}
                onPageChange={setEntriesPage}
              />
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold">Weekly habit progress</h2>
                <p className="text-sm text-muted-foreground">
                  Checked days (Mon–Sun) based on habit completions for the selected week.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Week:{" "}
                  <span className="font-medium text-foreground">
                    {week.days[0].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </span>{" "}
                  –{" "}
                  <span className="font-medium text-foreground">
                    {week.days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setWeekOffset((n) => n - 1)}>
                  Prev week
                </Button>
                <Button variant="outline" onClick={() => setWeekOffset(0)}>
                  This week
                </Button>
                <Button variant="outline" onClick={() => setWeekOffset((n) => n + 1)}>
                  Next week
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Habit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    {week.days.map((d, i) => (
                      <th
                        key={i}
                        className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase"
                        title={d.toLocaleDateString(undefined, {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      >
                        {d.toLocaleDateString(undefined, { weekday: "short" })[0]}
                        <span className="ml-1 text-[11px] font-semibold text-gray-700">{d.getDate()}</span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  ) : weekProgressRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No habits found.
                      </td>
                    </tr>
                  ) : (
                    weekProgressRows.slice(0, 300).map((r) => {
                      const userId = emailToId.get(r.email.toLowerCase());
                      return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{r.habit}</td>
                        <td className="px-4 py-3 text-sm">{r.user}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{r.email}</td>
                        {Array.from({ length: 7 }).map((_, i) => {
                          const done = r.completed.has(i);
                          return (
                            <td key={i} className="px-2 py-3 text-center">
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                                  done ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {done ? "✓" : r.weekDays[i][0]}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-center">
                          {userId ? (
                            <Link
                              to={`/admin/user-analytics/habits/${userId}`}
                              className="inline-flex items-center justify-center rounded-md p-1.5 text-teal-600 hover:bg-teal-50 transition-colors"
                              title="View user habit details"
                            >
                              <Eye size={16} />
                            </Link>
                          ) : (
                            <span className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-300 cursor-not-allowed">
                              <Eye size={16} />
                            </span>
                          )}
                        </td>
                      </tr>
                    )})
                  )}
                </tbody>
              </table>
            </div>
            {!loading && weekProgressRows.length > 300 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Showing first 300 habits for performance. Use search to narrow down.
              </p>
            )}
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}

