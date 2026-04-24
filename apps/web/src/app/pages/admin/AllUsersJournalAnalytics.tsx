import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { api } from "../../../lib/api";
import { BookOpen, RefreshCw } from "lucide-react";
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
  user_id?: string;
  title?: string | null;
  created_at?: string;
  mood_tags?: string[] | null;
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

function emojiName(tag: string) {
  const t = String(tag || "").trim();
  const map: Record<string, string> = {
    "😊": "Happy",
    "😄": "Happy",
    "😁": "Happy",
    "😌": "Calm",
    "😐": "Neutral",
    "😢": "Sad",
    "😞": "Sad",
    "😡": "Angry",
    "😴": "Tired",
    "😰": "Anxious",
    "😫": "Stressed",
    "🙏": "Grateful",
    "❤️": "Love",
    "💔": "Heartbroken",
    "✨": "Hopeful",
    "🌧️": "Low",
    "☀️": "Good",
    "🔥": "Motivated",
  };
  return map[t] || "";
}

function formatTag(t: string) {
  const raw = String(t || "").trim();
  if (!raw) return "";
  const name = emojiName(raw);
  return name ? `${raw} ${name}` : raw;
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

export function AllUsersJournalAnalytics() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<JournalRow[]>([]);
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
        api.journal.getAllJournalsAdmin(),
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
      const t = r.created_at ? new Date(r.created_at).getTime() : NaN;
      return Number.isFinite(t) && t >= s && t < e;
    });
  }, [rows, period]);

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of periodRows) {
      if (!r.created_at) continue;
      const key = ymd(new Date(r.created_at));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({
        day: new Date(k).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        entries: v,
      }));
  }, [periodRows]);

  const topTags = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of periodRows) {
      for (const t of r.mood_tags || []) {
        const k = String(t || "").trim().toLowerCase();
        if (!k) continue;
        count.set(k, (count.get(k) ?? 0) + 1);
      }
    }
    return Array.from(count.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [periodRows]);

  const usersBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; email: string; entries30d: number }>();
    for (const r of periodRows) {
      const email = (r.profiles?.email || "unknown").trim().toLowerCase();
      const name = (r.profiles?.full_name || "Unknown").trim() || "Unknown";
      const key = email || "unknown";
      const cur = map.get(key) ?? { name, email: email || "unknown", entries30d: 0 };
      cur.entries30d += 1;
      if (!cur.name || cur.name === "Unknown") cur.name = name;
      map.set(key, cur);
    }
    const all = allUsers.map((u) => {
      const email = (u.email || "unknown").trim().toLowerCase();
      const name = (u.name || (email && email !== "unknown" ? email.split("@")[0] : "User")).trim() || "User";
      const key = email || "unknown";
      const existing = map.get(key);
      return existing ?? { name, email: email || "unknown", entries30d: 0 };
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
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
    if (!q) return list;
    return list.filter((r) => {
      const email = (r.profiles?.email || "").toLowerCase();
      const name = (r.profiles?.full_name || "").toLowerCase();
      const title = (r.title || "").toLowerCase();
      const tags = (r.mood_tags || []).join(" ").toLowerCase();
      const dir = r.user_id ? dirById.get(String(r.user_id)) : undefined;
      const dirEmail = (dir?.email || "").toLowerCase();
      const dirName = (dir?.name || "").toLowerCase();
      return (
        email.includes(q) ||
        name.includes(q) ||
        title.includes(q) ||
        tags.includes(q) ||
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
      if (!r.created_at) continue;
      const y = new Date(r.created_at).getFullYear();
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
              <BookOpen className="w-7 h-7 text-indigo-600" />
              All Users • Journal Analytics
            </h1>
            <p className="text-sm text-muted-foreground">Platform-wide journal entries</p>
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
          <Card className="p-5 bg-gradient-to-br from-white via-indigo-50/45 to-blue-50/35 border-indigo-100/60">
            <p className="text-sm text-muted-foreground">Total journal entries</p>
            <p className="text-3xl font-bold mt-1">{rows.length}</p>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-white via-indigo-50/45 to-blue-50/35 border-indigo-100/60">
            <p className="text-sm text-muted-foreground">Entries (selected month)</p>
            <p className="text-3xl font-bold mt-1">{periodRows.length}</p>
          </Card>
          <Card className="p-5 bg-gradient-to-br from-white via-indigo-50/45 to-blue-50/35 border-indigo-100/60">
            <p className="text-sm text-muted-foreground">Top tags (selected month)</p>
            <div className="mt-2 space-y-1">
              {topTags.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                topTags.map(([t, c]) => (
                  <div key={t} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{formatTag(t)}</span>
                    <span className="font-semibold">{c}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6 bg-gradient-to-br from-white via-indigo-50/35 to-blue-50/25 border-indigo-100/70">
            <h2 className="text-lg font-bold mb-4">Entries per day</h2>
            {loading ? (
              <div className="h-[320px] grid place-items-center text-sm text-muted-foreground">Loading…</div>
            ) : chartData.length === 0 ? (
              <div className="h-[320px] grid place-items-center text-sm text-muted-foreground">No data in range.</div>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="allJournalBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                        <stop offset="70%" stopColor="#4f46e5" stopOpacity={0.96} />
                        <stop offset="100%" stopColor="#4338ca" stopOpacity={0.92} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" stroke="#e8e8ed" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Entries"]} />
                    <Bar dataKey="entries" fill="url(#allJournalBar)" radius={[12, 12, 4, 4]} maxBarSize={34} />
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  ) : usersBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-sm text-muted-foreground">
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
                <h2 className="text-lg font-bold">Journal entries</h2>
                <p className="text-sm text-muted-foreground">All entry rows for the selected month.</p>
              </div>
              <div className="w-full sm:w-96">
                <Input
                  value={entryQuery}
                  onChange={(e) => setEntryQuery(e.target.value)}
                  placeholder="Search by user, email, title, or tags…"
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  ) : filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No journal entries found.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries
                      .slice((entriesPage - 1) * pageSize, entriesPage * pageSize)
                      .map((r) => {
                        const dateLabel = r.created_at
                          ? new Date(r.created_at).toLocaleString(undefined, {
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
                        const title = (r.title || "").trim() || "—";
                        const tags = (r.mood_tags || [])
                          .map((t) => String(t || "").trim())
                          .filter(Boolean)
                          .map(formatTag);
                        return (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm whitespace-nowrap">{dateLabel}</td>
                            <td className="px-4 py-3 text-sm font-medium">{name}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{email}</td>
                            <td className="px-4 py-3 text-sm max-w-[26rem] truncate">{title}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {tags.length ? tags.join(", ") : "—"}
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

