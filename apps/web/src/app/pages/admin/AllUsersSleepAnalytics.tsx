import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { api } from "../../../lib/api";
import { Moon, RefreshCw, Clock } from "lucide-react";
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
  user_id?: string;
  bed_time?: string;
  wake_time?: string;
  quality_rating?: number | null;
  created_at?: string;
  profiles?: { full_name?: string | null; email?: string | null } | null;
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

function monthStart(year: number, monthIdx: number) {
  return new Date(year, monthIdx, 1, 0, 0, 0, 0);
}

function monthEndExclusive(year: number, monthIdx: number) {
  return new Date(year, monthIdx + 1, 1, 0, 0, 0, 0);
}

function monthLabel(monthIdx: number) {
  return new Date(2000, monthIdx, 1).toLocaleDateString(undefined, { month: "long" });
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

function durationHours(bed?: string, wake?: string): number | null {
  if (!bed || !wake) return null;
  const b = new Date(bed).getTime();
  const w = new Date(wake).getTime();
  if (!Number.isFinite(b) || !Number.isFinite(w) || w <= b) return null;
  return Math.round(((w - b) / (1000 * 60 * 60)) * 10) / 10;
}

export function AllUsersSleepAnalytics() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SleepRow[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [entryQuery, setEntryQuery] = useState("");
  const [allUsers, setAllUsers] = useState<AdminUserRow[]>([]);

  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth());

  const [usersPage, setUsersPage] = useState(1);
  const [entriesPage, setEntriesPage] = useState(1);
  const pageSize = 25;

  const dirById = useMemo(() => {
    const m = new Map<string, { name?: string; email?: string }>();
    for (const u of allUsers) m.set(String(u.id), { name: u.name, email: u.email });
    return m;
  }, [allUsers]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [data, users] = await Promise.all([
        api.sleep.getAllEntriesAdmin(),
        (async () => {
          const collected: AdminUserRow[] = [];
          let page = 1;
          const limit = 1000;
          for (let guard = 0; guard < 25; guard++) {
            const res: any = await api.admin.getUsers({ page, limit });
            const list = Array.isArray(res) ? res : Array.isArray(res?.users) ? res.users : [];
            if (list.length === 0) break;
            collected.push(
              ...list.map((u: any) => ({
                id: String(u.id),
                name: u.name ?? u.full_name ?? u.fullName ?? null,
                email: u.email ?? null,
              }))
            );
            if (list.length < limit) break;
            page += 1;
          }
          return collected;
        })(),
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
      const t = new Date(r.bed_time || r.created_at || "").getTime();
      return Number.isFinite(t) && t >= s && t < e;
    });
  }, [rows, period]);

  const avgHours = useMemo(() => {
    const vals = periodRows.map((r) => durationHours(r.bed_time, r.wake_time)).filter((v): v is number => v != null);
    if (vals.length === 0) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }, [periodRows]);

  const avgQuality = useMemo(() => {
    const vals = periodRows
      .map((r) => (typeof r.quality_rating === "number" ? r.quality_rating : null))
      .filter((v): v is number => v != null);
    if (vals.length === 0) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }, [periodRows]);

  const chartData = useMemo(() => {
    const map = new Map<string, { sum: number; n: number }>();
    for (const r of periodRows) {
      const keyDate = r.bed_time || r.created_at;
      if (!keyDate) continue;
      const key = ymd(new Date(keyDate));
      const h = durationHours(r.bed_time, r.wake_time);
      if (h == null) continue;
      const cur = map.get(key) ?? { sum: 0, n: 0 };
      cur.sum += h;
      cur.n += 1;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({
        day: new Date(k).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        avgHours: Math.round(((v.n ? v.sum / v.n : 0) * 10)) / 10,
        samples: v.n,
      }));
  }, [periodRows]);

  const usersBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { name: string; email: string; entries30d: number; avgHours30d: number; avgQuality30d: number; _sumH: number; _sumQ: number; _nQ: number }
    >();
    for (const r of periodRows) {
      const email = (r.profiles?.email || "unknown").trim().toLowerCase();
      const name = (r.profiles?.full_name || "Unknown").trim() || "Unknown";
      const key = email || "unknown";
      const cur =
        map.get(key) ?? {
          name,
          email: email || "unknown",
          entries30d: 0,
          avgHours30d: 0,
          avgQuality30d: 0,
          _sumH: 0,
          _sumQ: 0,
          _nQ: 0,
        };
      cur.entries30d += 1;
      const h = durationHours(r.bed_time, r.wake_time);
      if (h != null) cur._sumH += h;
      const q = typeof r.quality_rating === "number" ? r.quality_rating : null;
      if (q != null) {
        cur._sumQ += q;
        cur._nQ += 1;
      }
      cur.avgHours30d = Math.round(((cur._sumH / cur.entries30d) * 10)) / 10;
      cur.avgQuality30d = cur._nQ > 0 ? Math.round(((cur._sumQ / cur._nQ) * 10)) / 10 : 0;
      if (!cur.name || cur.name === "Unknown") cur.name = name;
      map.set(key, cur);
    }
    const all = allUsers.map((u) => {
      const email = (u.email || "unknown").trim().toLowerCase();
      const name = (u.name || (email && email !== "unknown" ? email.split("@")[0] : "User")).trim() || "User";
      const key = email || "unknown";
      const existing = map.get(key);
      return (
        existing ?? {
          name,
          email: email || "unknown",
          entries30d: 0,
          avgHours30d: 0,
          avgQuality30d: 0,
          _sumH: 0,
          _sumQ: 0,
          _nQ: 0,
        }
      );
    });
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
      const ta = new Date(a.bed_time || a.created_at || "").getTime();
      const tb = new Date(b.bed_time || b.created_at || "").getTime();
      return tb - ta;
    });
    if (!q) return list;
    return list.filter((r) => {
      const email = (r.profiles?.email || "").toLowerCase();
      const name = (r.profiles?.full_name || "").toLowerCase();
      const bed = (r.bed_time || "").toLowerCase();
      const wake = (r.wake_time || "").toLowerCase();
      const dir = r.user_id ? dirById.get(String(r.user_id)) : undefined;
      const dirEmail = (dir?.email || "").toLowerCase();
      const dirName = (dir?.name || "").toLowerCase();
      return (
        email.includes(q) ||
        name.includes(q) ||
        bed.includes(q) ||
        wake.includes(q) ||
        dirEmail.includes(q) ||
        dirName.includes(q)
      );
    });
  }, [periodRows, entryQuery, dirById]);

  useEffect(() => {
    setEntriesPage(1);
  }, [entryQuery, filterMonth, filterYear]);

  const years = useMemo(() => {
    const ys = new Set<number>();
    for (const r of rows) {
      const d = r.bed_time || r.created_at;
      if (!d) continue;
      const y = new Date(d).getFullYear();
      if (Number.isFinite(y)) ys.add(y);
    }
    if (ys.size === 0) ys.add(new Date().getFullYear());
    return Array.from(ys).sort((a, b) => b - a);
  }, [rows]);

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Moon className="w-7 h-7 text-indigo-600" />
              All Users • Sleep Logs
            </h1>
            <p className="text-sm text-muted-foreground">Platform-wide sleep entries</p>
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
          <Card className="p-5 bg-gradient-to-br from-white via-indigo-50/40 to-blue-50/30 border-indigo-100/60">
            <p className="text-sm text-muted-foreground">Total sleep entries</p>
            <p className="text-3xl font-bold mt-1">{rows.length}</p>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-white via-indigo-50/40 to-blue-50/30 border-indigo-100/60">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Avg sleep (selected month)
            </p>
            <p className="text-3xl font-bold mt-1">{avgHours}h</p>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-white via-indigo-50/40 to-blue-50/30 border-indigo-100/60">
            <p className="text-sm text-muted-foreground">Avg quality (selected month)</p>
            <p className="text-3xl font-bold mt-1">{avgQuality}</p>
          </Card>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6 bg-gradient-to-br from-white via-indigo-50/30 to-blue-50/20 border-indigo-100/70">
            <h2 className="text-lg font-bold mb-4">Average sleep hours per day</h2>
            {loading ? (
              <div className="h-[320px] grid place-items-center text-sm text-muted-foreground">Loading…</div>
            ) : chartData.length === 0 ? (
              <div className="h-[320px] grid place-items-center text-sm text-muted-foreground">No data in range.</div>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="allSleepIndigo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="85%" stopColor="#6366f1" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" stroke="#e8e8ed" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} width={32} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}h`, "Avg sleep"]} />
                    <Area type="monotone" dataKey="avgHours" stroke="#4338ca" strokeWidth={2.5} fill="url(#allSleepIndigo)" />
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
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Entries (30d)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg hours</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg quality</th>
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
                      .map((u) => (
                      <tr key={u.email} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{u.name}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">
                          {u.entries30d}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">
                          {u.avgHours30d}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">
                          {u.avgQuality30d}
                        </td>
                      </tr>
                    ))
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
                <h2 className="text-lg font-bold">Sleep entries</h2>
                <p className="text-sm text-muted-foreground">All entry rows for the selected month.</p>
              </div>
              <div className="w-full sm:w-96">
                <Input
                  value={entryQuery}
                  onChange={(e) => setEntryQuery(e.target.value)}
                  placeholder="Search by user, email, or timestamps…"
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bed time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wake time</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quality</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  ) : filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No sleep entries found.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries
                      .slice((entriesPage - 1) * pageSize, entriesPage * pageSize)
                      .map((r) => {
                        const keyDate = r.bed_time || r.created_at;
                        const dateLabel = keyDate
                          ? new Date(keyDate).toLocaleString(undefined, {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "2-digit",
                            })
                          : "—";
                        const dir = r.user_id ? dirById.get(String(r.user_id)) : undefined;
                        const name =
                          (r.profiles?.full_name || dir?.name || "Unknown").trim() || "Unknown";
                        const email =
                          (r.profiles?.email || dir?.email || "unknown").trim() || "unknown";
                        const bed = r.bed_time ? new Date(r.bed_time).toLocaleString() : "—";
                        const wake = r.wake_time ? new Date(r.wake_time).toLocaleString() : "—";
                        const hours = durationHours(r.bed_time, r.wake_time);
                        return (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm whitespace-nowrap">{dateLabel}</td>
                            <td className="px-4 py-3 text-sm font-medium">{name}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{email}</td>
                            <td className="px-4 py-3 text-sm">{bed}</td>
                            <td className="px-4 py-3 text-sm">{wake}</td>
                            <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">
                              {typeof r.quality_rating === "number" ? r.quality_rating : 0}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">
                              {hours ?? 0}
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

