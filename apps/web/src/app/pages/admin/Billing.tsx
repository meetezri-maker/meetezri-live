import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { 
  DollarSign,
  TrendingUp,
  CreditCard,
  Users,
  Download,
  Calendar,
  ArrowUp,
  ArrowDown,
  Filter,
  Search
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useState, useEffect, useMemo } from "react";
import { api } from "../../../lib/api";
import { AdminTableSkeletonRows } from "../../components/admin/AdminTableSkeleton";

/** Stripe / API may send ISO strings, unix seconds, or ms — normalize for sorting & display. */
function parseBillingDate(raw: unknown): Date {
  if (raw == null || raw === "") return new Date(0);
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  if (typeof raw === "number") {
    return raw > 1e12 ? new Date(raw) : new Date(raw * 1000);
  }
  if (typeof raw === "string") {
    const t = Date.parse(raw);
    if (!isNaN(t)) return new Date(t);
  }
  return new Date(0);
}

function billingDisplayUser(row: {
  user_name?: unknown;
  user_email?: unknown;
}): string {
  const name = typeof row.user_name === "string" ? row.user_name.trim() : "";
  if (name) return name;
  const email = typeof row.user_email === "string" ? row.user_email.trim() : "";
  if (email) return email;
  return "Unknown user";
}

/** Prefer active/trialing/past_due, then most recently created. */
function pickPreferredSubscription(subs: any[]): any | undefined {
  if (!subs?.length) return undefined;
  const rank = (s: any) => {
    const st = String(s?.status ?? "").toLowerCase();
    if (["active", "trial", "trialing", "past_due"].includes(st)) return 2;
    return 1;
  };
  return [...subs].sort((a, b) => {
    const dr = rank(b) - rank(a);
    if (dr !== 0) return dr;
    return parseBillingDate(b.created_at).getTime() - parseBillingDate(a.created_at).getTime();
  })[0];
}

function subscriptionByUserIdMap(subscriptions: any[]): Map<string, any> {
  const byUser = new Map<string, any[]>();
  for (const sub of subscriptions || []) {
    const uid = sub.user_id;
    if (typeof uid !== "string" || !uid) continue;
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid)!.push(sub);
  }
  const out = new Map<string, any>();
  for (const [uid, list] of byUser) {
    const picked = pickPreferredSubscription(list);
    if (picked) out.set(uid, picked);
  }
  return out;
}

/** When the user subscribed / plan row was created (DB); falls back to billing period start. */
function dateFromSubscription(sub: any): Date | null {
  if (!sub) return null;
  const created = parseBillingDate(sub.created_at);
  if (created.getTime() !== 0) return created;
  const start = parseBillingDate(sub.start_date);
  if (start.getTime() !== 0) return start;
  return null;
}

function displayUserFromSubscriptionOrRow(
  sub: any | undefined,
  row: { user_name?: unknown; user_email?: unknown }
): string {
  const p = sub?.profiles;
  if (p) {
    return billingDisplayUser({
      user_name: typeof p.full_name === "string" && p.full_name.trim() ? p.full_name : row.user_name,
      user_email: typeof p.email === "string" && p.email.trim() ? p.email : row.user_email,
    });
  }
  return billingDisplayUser(row);
}

function formatTransactionDate(d: Date): string {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function invoiceAmountUsd(inv: any): number {
  return typeof inv.amount_due === "number" ? inv.amount_due : Number(inv.amount_due ?? 0);
}

function paygAmountUsd(tx: any): number {
  return typeof tx.amount === "number" ? tx.amount : Number(tx.amount ?? 0);
}

function startOfMondayLocal(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

type ChartBucketMode = "day" | "week" | "month";

function chartBucketMode(rangeDays: number): ChartBucketMode {
  if (rangeDays <= 31) return "day";
  if (rangeDays <= 120) return "week";
  return "month";
}

function bucketForDate(d: Date, mode: ChartBucketMode): { key: number; label: string } {
  const x = new Date(d);
  if (mode === "day") {
    x.setHours(0, 0, 0, 0);
    return {
      key: x.getTime(),
      label: x.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    };
  }
  if (mode === "week") {
    const w = startOfMondayLocal(x);
    return {
      key: w.getTime(),
      label: `Week of ${w.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
    };
  }
  const m = new Date(x.getFullYear(), x.getMonth(), 1);
  return {
    key: m.getTime(),
    label: m.toLocaleString(undefined, { month: "short", year: "numeric" }),
  };
}

function buildRevenueChartRows(
  invoices: any[],
  payg: any[],
  rangeStart: Date,
  rangeEnd: Date,
  rangeDays: number
): { period: string; revenue: number; count: number }[] {
  const mode = chartBucketMode(rangeDays);
  const map = new Map<number, { period: string; revenue: number; count: number }>();

  const add = (d: Date, amount: number) => {
    if (d.getTime() === 0 || d < rangeStart || d > rangeEnd) return;
    const b = bucketForDate(d, mode);
    const prev = map.get(b.key) ?? { period: b.label, revenue: 0, count: 0 };
    prev.revenue += amount;
    prev.count += 1;
    map.set(b.key, prev);
  };

  for (const inv of invoices || []) {
    add(parseBillingDate(inv.created), invoiceAmountUsd(inv));
  }
  for (const tx of payg || []) {
    add(parseBillingDate(tx.created), paygAmountUsd(tx));
  }

  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => ({
      period: v.period,
      revenue: Number(v.revenue.toFixed(2)),
      count: v.count,
    }));
}

interface Transaction {
  id: string;
  user: string;
  plan: string;
  amount: number;
  status: "completed" | "pending" | "failed" | "refunded";
  /** Stripe invoice / payment time — used for sort + “last N days” filter */
  date: Date;
  /** Shown in the Date column: plan/subscription created (or start) when known; else same as `date` */
  displayDate: Date;
  method: string;
}

export function Billing() {
  const [timeRange, setTimeRange] = useState("30d");
  const [filterStatus, setFilterStatus] = useState("all");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [paygTransactions, setPaygTransactions] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await api.billing.getAdminBillingOverview();
        setSubscriptions(data?.subscriptions || []);
        setInvoices(data?.invoices || []);
        setPaygTransactions(data?.paygTransactions || []);
      } catch (error) {
        console.error("Failed to load billing overview data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const mapInvoiceStatusToTransactionStatus = (status: string): Transaction["status"] => {
    if (status === "paid") return "completed";
    if (status === "open" || status === "draft") return "pending";
    if (status === "uncollectible") return "failed";
    if (status === "void" || status === "refunded") return "refunded";
    return "completed";
  };

  const mapPaygStatusToTransactionStatus = (status: string): Transaction["status"] => {
    if (status === "completed") return "completed";
    if (status === "pending") return "pending";
    if (status === "failed") return "failed";
    return "completed";
  };

  const transactions: Transaction[] = useMemo(() => {
    const subMap = subscriptionByUserIdMap(subscriptions);

    const fromInvoices: Transaction[] = (invoices || []).map((inv: any) => {
      const occurredAt = parseBillingDate(inv.created);
      const uid = typeof inv.user_id === "string" ? inv.user_id : null;
      const sub = uid ? subMap.get(uid) : undefined;
      const planDate = uid ? dateFromSubscription(sub) : null;
      const displayDate = planDate ?? occurredAt;

      return {
        id: `stripe_${inv.id}`,
        user: displayUserFromSubscriptionOrRow(sub, inv),
        plan:
          typeof inv.description === "string" && inv.description.trim()
            ? inv.description.trim()
            : "Subscription",
        amount:
          typeof inv.amount_due === "number"
            ? inv.amount_due
            : Number(inv.amount_due ?? 0),
        status: mapInvoiceStatusToTransactionStatus(String(inv.status ?? "")),
        date: occurredAt,
        displayDate,
        method: "Card",
      };
    });

    const fromPayg: Transaction[] = (paygTransactions || []).map((tx: any) => {
      const occurredAt = parseBillingDate(tx.created);
      const uid = typeof tx.user_id === "string" ? tx.user_id : null;
      const sub = uid ? subMap.get(uid) : undefined;
      return {
        id: `payg_${tx.id}`,
        user: displayUserFromSubscriptionOrRow(sub, tx),
        plan:
          typeof tx.plan_type === "string" && tx.plan_type.trim()
            ? tx.plan_type.trim()
            : "Pay as you go",
        amount:
          typeof tx.amount === "number" ? tx.amount : Number(tx.amount ?? 0),
        status: mapPaygStatusToTransactionStatus(String(tx.status ?? "completed")),
        date: occurredAt,
        displayDate: occurredAt,
        method:
          typeof tx.payment_method === "string" && tx.payment_method.trim()
            ? tx.payment_method.trim()
            : "Card",
      };
    });

    return [...fromInvoices, ...fromPayg].sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );
  }, [invoices, paygTransactions, subscriptions]);

  const rangeBounds = useMemo(() => {
    const rangeDays = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 365;
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - rangeDays);
    const label =
      timeRange === "7d"
        ? "Last 7 days"
        : timeRange === "30d"
          ? "Last 30 days"
          : timeRange === "90d"
            ? "Last 90 days"
            : "Last 12 months";
    return { start, end, rangeDays, label };
  }, [timeRange]);

  const subscriptionsCreatedInRange = useMemo(() => {
    const { start, end } = rangeBounds;
    return subscriptions.filter((sub: any) => {
      const d = parseBillingDate(sub.created_at);
      if (d.getTime() === 0) return false;
      return d >= start && d <= end;
    });
  }, [subscriptions, rangeBounds]);

  const filteredTransactions = useMemo(() => {
    const { start, end } = rangeBounds;
    return transactions.filter((t) => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (t.date.getTime() === 0) return false;
      return t.date >= start && t.date <= end;
    });
  }, [transactions, filterStatus, rangeBounds]);

  const invoicesInRange = useMemo(() => {
    const { start, end } = rangeBounds;
    return invoices.filter((inv: any) => {
      const d = parseBillingDate(inv.created);
      if (d.getTime() === 0) return false;
      return d >= start && d <= end;
    });
  }, [invoices, rangeBounds]);

  const paygInRange = useMemo(() => {
    const { start, end } = rangeBounds;
    return (paygTransactions || []).filter((tx: any) => {
      const d = parseBillingDate(tx.created);
      if (d.getTime() === 0) return false;
      return d >= start && d <= end;
    });
  }, [paygTransactions, rangeBounds]);

  const totalRevenue =
    invoicesInRange.reduce((sum: number, inv: any) => sum + invoiceAmountUsd(inv), 0) +
    paygInRange.reduce((sum: number, tx: any) => sum + paygAmountUsd(tx), 0);

  const prevWindow = useMemo(() => {
    const { start, rangeDays } = rangeBounds;
    const prevEnd = new Date(start);
    prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - rangeDays);
    return { prevStart, prevEnd };
  }, [rangeBounds]);

  const invoicesPrev = useMemo(() => {
    const { prevStart, prevEnd } = prevWindow;
    return invoices.filter((inv: any) => {
      const d = parseBillingDate(inv.created);
      if (d.getTime() === 0) return false;
      return d >= prevStart && d <= prevEnd;
    });
  }, [invoices, prevWindow]);

  const paygPrev = useMemo(() => {
    const { prevStart, prevEnd } = prevWindow;
    return (paygTransactions || []).filter((tx: any) => {
      const d = parseBillingDate(tx.created);
      if (d.getTime() === 0) return false;
      return d >= prevStart && d <= prevEnd;
    });
  }, [paygTransactions, prevWindow]);

  const prevRevenue =
    invoicesPrev.reduce((sum: number, inv: any) => sum + invoiceAmountUsd(inv), 0) +
    paygPrev.reduce((sum: number, tx: any) => sum + paygAmountUsd(tx), 0);

  const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  const activeSubscriptions = subscriptions.filter((sub: any) =>
    sub.status === "active" || sub.status === "trial" || sub.status === "past_due"
  ).length;

  const newSubscriptionsInRange = subscriptionsCreatedInRange.length;

  const newSubscriptionsPrev = useMemo(() => {
    const { prevStart, prevEnd } = prevWindow;
    return subscriptions.filter((sub: any) => {
      const d = parseBillingDate(sub.created_at);
      if (d.getTime() === 0) return false;
      return d >= prevStart && d <= prevEnd;
    }).length;
  }, [subscriptions, prevWindow]);

  const subscriptionGrowth =
    newSubscriptionsPrev > 0
      ? ((newSubscriptionsInRange - newSubscriptionsPrev) / newSubscriptionsPrev) * 100
      : newSubscriptionsInRange > 0
        ? 100
        : 0;

  const canceledSubscriptions = subscriptions.filter((sub: any) =>
    sub.status === "canceled" || sub.status === "cancelled"
  ).length;

  const subscriptionBase = activeSubscriptions + canceledSubscriptions;
  const churnRate = subscriptionBase > 0 ? (canceledSubscriptions / subscriptionBase) * 100 : 0;

  const chargeCountInRange = invoicesInRange.length + paygInRange.length;
  const averageRevenue = chargeCountInRange > 0 ? totalRevenue / chargeCountInRange : 0;

  const revenueChartData = useMemo(
    () =>
      buildRevenueChartRows(
        invoices,
        paygTransactions,
        rangeBounds.start,
        rangeBounds.end,
        rangeBounds.rangeDays
      ),
    [invoices, paygTransactions, rangeBounds]
  );

  const barChartData = revenueChartData.map((row) => ({
    period: row.period,
    amount: row.revenue,
  }));

  const planDistribution = useMemo(() => {
    const source = subscriptionsCreatedInRange.length > 0 ? subscriptionsCreatedInRange : subscriptions;
    const planCounts: Record<string, number> = {};
    source.forEach((sub: any) => {
      const key = sub.plan_type || "trial";
      planCounts[key] = (planCounts[key] || 0) + 1;
    });
    return Object.entries(planCounts).map(([key, value]) => ({
      name: key === "pro" ? "Pro" : key === "core" ? "Core" : key === "trial" ? "Trial" : key,
      value,
      color: key === "pro" ? "#3b82f6" : key === "core" ? "#10b981" : key === "trial" ? "#f59e0b" : "#8b5cf6"
    }));
  }, [subscriptionsCreatedInRange, subscriptions]);

  const stats = {
    monthlyRevenue: Number(totalRevenue.toFixed(2)),
    revenueGrowth: Number(revenueGrowth.toFixed(1)),
    activeSubscriptions,
    newSubscriptionsInRange,
    subscriptionGrowth: Number(subscriptionGrowth.toFixed(1)),
    averageRevenue: Number(averageRevenue.toFixed(2)),
    churnRate: Number(churnRate.toFixed(1))
  };

  const handleExport = () => {
    const headers = ["Transaction ID", "User", "Plan", "Amount", "Status", "Plan or account date", "Payment Method"];
    const csvContent = [
      headers.join(","),
      ...filteredTransactions.map(txn => [
        txn.id,
        txn.user,
        txn.plan,
        `$${txn.amount.toFixed(2)}`,
        txn.status,
        formatTransactionDate(txn.displayDate),
        txn.method
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billing-report-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "completed": return "bg-green-100 text-green-700";
      case "pending": return "bg-yellow-100 text-yellow-700";
      case "failed": return "bg-red-100 text-red-700";
      case "refunded": return "bg-gray-100 text-gray-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        <>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Billing & Revenue</h1>
            <p className="text-gray-600 mt-1">Financial analytics and subscription metrics</p>
          </div>

          <div className="flex gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg"
              onClick={handleExport}
            >
              <Download className="w-4 h-4" />
              Export
            </motion.button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 h-36 animate-pulse"
              >
                <div className="h-4 w-28 bg-gray-200 rounded mb-4" />
                <div className="h-8 w-24 bg-gray-200 rounded mb-2" />
                <div className="h-3 w-32 bg-gray-100 rounded" />
              </div>
            ))
          ) : (
          <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm bg-green-100 text-green-700">
                <ArrowUp className="w-4 h-4" />
                {stats.revenueGrowth}%
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">${stats.monthlyRevenue.toLocaleString()}</h3>
            <p className="text-gray-600 text-sm mt-1">Revenue ({rangeBounds.label})</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm bg-blue-100 text-blue-700">
                <ArrowUp className="w-4 h-4" />
                {stats.subscriptionGrowth}%
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{stats.newSubscriptionsInRange}</h3>
            <p className="text-gray-600 text-sm mt-1">New subscriptions ({rangeBounds.label})</p>
            <p className="text-xs text-gray-400 mt-1">{stats.activeSubscriptions} active total</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">${stats.averageRevenue}</h3>
            <p className="text-gray-600 text-sm mt-1">Avg per charge ({rangeBounds.label})</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-600">
                <ArrowDown className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm bg-gray-100 text-gray-600">
                <ArrowDown className="w-4 h-4" />
                churn
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{stats.churnRate}%</h3>
            <p className="text-gray-600 text-sm mt-1">Churn Rate</p>
          </motion.div>
          </>
          )}
        </div>

        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-2">Revenue Overview</h2>
          <p className="text-sm text-gray-500 mb-4">{rangeBounds.label} · subscription + pay-as-you-go</p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueChartData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="period" stroke="#6b7280" tick={{ fontSize: 11 }} angle={revenueChartData.length > 10 ? -35 : 0} textAnchor={revenueChartData.length > 10 ? "end" : "middle"} height={revenueChartData.length > 10 ? 60 : 30} />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                formatter={(value: number) => `$${value.toLocaleString()}`}
              />
              <Legend />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" name="Total Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Daily Revenue */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-2">Revenue by period</h2>
            <p className="text-sm text-gray-500 mb-4">Same range as overview ({rangeBounds.label})</p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="period" stroke="#6b7280" tick={{ fontSize: 11 }} angle={barChartData.length > 10 ? -35 : 0} textAnchor={barChartData.length > 10 ? "end" : "middle"} height={barChartData.length > 10 ? 55 : 30} />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                  formatter={(value: number) => `$${value.toLocaleString()}`}
                />
                <Bar dataKey="amount" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Plan Distribution */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-2">Subscription plans</h2>
            <p className="text-sm text-gray-500 mb-4">
              {subscriptionsCreatedInRange.length > 0
                ? `New subscribers in ${rangeBounds.label}`
                : `No new subscribers in ${rangeBounds.label} — showing current plan mix`}
            </p>
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPie>
                <Pie
                  data={planDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {planDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPie>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Transactions</h2>
              <p className="text-sm text-gray-500 mt-1">
                Date range and status filters apply to when the charge was processed. The Date column shows plan
                subscription time (created) when linked to a user; Pay-as-you-go rows show payment time.
              </p>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    User
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Plan
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Method
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Plan / account
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {isLoading && (
                  <AdminTableSkeletonRows columns={6} rows={8} padding="compact" />
                )}
                {!isLoading &&
                  filteredTransactions.map((transaction, index) => (
                  <motion.tr
                    key={transaction.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + index * 0.05 }}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{transaction.user}</p>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{transaction.plan}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-gray-900">
                        $
                        {transaction.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{transaction.method}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(transaction.status)}`}>
                        {transaction.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-sm whitespace-nowrap">
                      {formatTransactionDate(transaction.displayDate)}
                    </td>
                  </motion.tr>
                ))}
                {!isLoading && filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-sm text-gray-500">
                      No transactions in this view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
        </>
      </div>
    </AdminLayoutNew>
  );
}
