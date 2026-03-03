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
import { useState, useEffect } from "react";
import { api } from "../../../lib/api";

interface Transaction {
  id: string;
  user: string;
  plan: string;
  amount: number;
  status: "completed" | "pending" | "failed" | "refunded";
  date: Date;
  method: string;
}

export function Billing() {
  const [timeRange, setTimeRange] = useState("30d");
  const [filterStatus, setFilterStatus] = useState("all");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [subs, invs] = await Promise.all([
          api.billing.getAllSubscriptions(),
          api.billing.getAdminInvoices()
        ]);
        setSubscriptions(subs || []);
        setInvoices(invs || []);
      } catch (error) {
        console.error("Failed to load billing overview data:", error);
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

  const transactions: Transaction[] = invoices.map((inv: any) => ({
    id: inv.id,
    user: inv.user_name || inv.user_email || "Unknown User",
    plan: inv.description || "Subscription",
    amount: typeof inv.amount_due === "number" ? inv.amount_due : Number(inv.amount_due || 0),
    status: mapInvoiceStatusToTransactionStatus(inv.status),
    date: inv.created ? new Date(inv.created) : new Date(),
    method: "Card"
  }));

  const filteredTransactions = transactions.filter(t => 
    filterStatus === "all" || t.status === filterStatus
  );

  const rangeDays = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 365;
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(now.getDate() - rangeDays);

  const invoicesInRange = invoices.filter((inv: any) => {
    if (!inv.created) return false;
    const d = new Date(inv.created);
    return d >= cutoff && d <= now;
  });

  const totalRevenue = invoicesInRange.reduce((sum: number, inv: any) => {
    const amount = typeof inv.amount_due === "number" ? inv.amount_due : Number(inv.amount_due || 0);
    return sum + amount;
  }, 0);

  const prevStart = new Date(cutoff);
  prevStart.setDate(cutoff.getDate() - rangeDays);

  const invoicesPrev = invoices.filter((inv: any) => {
    if (!inv.created) return false;
    const d = new Date(inv.created);
    return d >= prevStart && d < cutoff;
  });

  const prevRevenue = invoicesPrev.reduce((sum: number, inv: any) => {
    const amount = typeof inv.amount_due === "number" ? inv.amount_due : Number(inv.amount_due || 0);
    return sum + amount;
  }, 0);

  const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  const activeSubscriptions = subscriptions.filter((sub: any) =>
    sub.status === "active" || sub.status === "trial" || sub.status === "past_due"
  ).length;

  const canceledSubscriptions = subscriptions.filter((sub: any) =>
    sub.status === "canceled" || sub.status === "cancelled"
  ).length;

  const subscriptionBase = activeSubscriptions + canceledSubscriptions;
  const churnRate = subscriptionBase > 0 ? (canceledSubscriptions / subscriptionBase) * 100 : 0;

  const averageRevenue = activeSubscriptions > 0 ? totalRevenue / activeSubscriptions : 0;

  const revenueByMonth: Record<string, { date: Date; revenue: number; count: number }> = {};
  invoices.forEach((inv: any) => {
    if (!inv.created) return;
    const d = new Date(inv.created);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const amount = typeof inv.amount_due === "number" ? inv.amount_due : Number(inv.amount_due || 0);
    if (!revenueByMonth[key]) {
      revenueByMonth[key] = { date: new Date(d.getFullYear(), d.getMonth(), 1), revenue: 0, count: 0 };
    }
    revenueByMonth[key].revenue += amount;
    revenueByMonth[key].count += 1;
  });

  const monthlyEntries = Object.values(revenueByMonth).sort((a, b) => a.date.getTime() - b.date.getTime());
  const lastSixMonths = monthlyEntries.slice(-6);

  const revenueData = lastSixMonths.map(entry => ({
    month: entry.date.toLocaleString(undefined, { month: "short" }),
    revenue: Number(entry.revenue.toFixed(2)),
    subscriptions: entry.count,
    oneTime: 0
  }));

  const dailyTotals: Record<string, number> = {};
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 6);

  invoices.forEach((inv: any) => {
    if (!inv.created) return;
    const d = new Date(inv.created);
    if (d < sevenDaysAgo || d > now) return;
    const dayLabel = d.toLocaleDateString(undefined, { weekday: "short" });
    const amount = typeof inv.amount_due === "number" ? inv.amount_due : Number(inv.amount_due || 0);
    dailyTotals[dayLabel] = (dailyTotals[dayLabel] || 0) + amount;
  });

  const dailyRevenueData = Object.entries(dailyTotals).map(([day, amount]) => ({
    day,
    amount
  }));

  const planCounts: Record<string, number> = {};
  subscriptions.forEach((sub: any) => {
    const key = sub.plan_type || "trial";
    planCounts[key] = (planCounts[key] || 0) + 1;
  });

  const planDistribution = Object.entries(planCounts).map(([key, value]) => ({
    name: key === "pro" ? "Pro" : key === "core" ? "Core" : key === "trial" ? "Trial" : key,
    value,
    color: key === "pro" ? "#3b82f6" : key === "core" ? "#10b981" : key === "trial" ? "#f59e0b" : "#8b5cf6"
  }));

  const stats = {
    monthlyRevenue: Number(totalRevenue.toFixed(2)),
    revenueGrowth: Number(revenueGrowth.toFixed(1)),
    activeSubscriptions,
    subscriptionGrowth: 0,
    averageRevenue: Number(averageRevenue.toFixed(2)),
    churnRate: Number(churnRate.toFixed(1))
  };

  const handleExport = () => {
    const headers = ["Transaction ID", "User", "Plan", "Amount", "Status", "Date", "Payment Method"];
    const csvContent = [
      headers.join(","),
      ...transactions.map(txn => [
        txn.id,
        txn.user,
        txn.plan,
        `$${txn.amount.toFixed(2)}`,
        txn.status,
        txn.date.toLocaleDateString(),
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
            <p className="text-gray-600 text-sm mt-1">Monthly Revenue</p>
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
            <h3 className="text-2xl font-bold text-gray-900">{stats.activeSubscriptions}</h3>
            <p className="text-gray-600 text-sm mt-1">Active Subscriptions</p>
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
            <p className="text-gray-600 text-sm mt-1">Avg Revenue Per User</p>
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
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm bg-green-100 text-green-700">
                <ArrowDown className="w-4 h-4" />
                0.3%
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{stats.churnRate}%</h3>
            <p className="text-gray-600 text-sm mt-1">Churn Rate</p>
          </motion.div>
        </div>

        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Revenue Overview</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
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
            <h2 className="text-xl font-bold text-gray-900 mb-6">Daily Revenue (This Week)</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" stroke="#6b7280" />
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
            <h2 className="text-xl font-bold text-gray-900 mb-6">Subscription Plans</h2>
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
            <h2 className="text-xl font-bold text-gray-900">Recent Transactions</h2>
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
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">User</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Plan</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Method</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction, index) => (
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
                      <span className="font-bold text-gray-900">${transaction.amount}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{transaction.method}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(transaction.status)}`}>
                        {transaction.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-sm">
                      {transaction.date.toLocaleDateString()}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}
