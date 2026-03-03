import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { api } from "../../../lib/api";
import { format } from "date-fns";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Users,
  Calendar,
  Download,
  Filter,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Star,
  Crown,
  Zap,
  Shield,
  X,
} from "lucide-react";

interface Subscription {
  id: string;
  organization: string;
  plan: "trial" | "core" | "pro";
  status: "active" | "trial" | "cancelled" | "past_due";
  users: number;
  mrr: number;
  nextBilling: string;
  startDate: string;
  billing_cycle?: "monthly" | "yearly";
}

interface Transaction {
  id: string;
  date: string;
  organization: string;
  amount: number;
  status: "paid" | "pending" | "failed" | "refunded";
  invoice: string;
}

export function BillingSubscriptions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"overview" | "subscriptions" | "transactions">("overview");
  const [showProcessPaymentModal, setShowProcessPaymentModal] = useState(false);
  const [showManageSubscriptionModal, setShowManageSubscriptionModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);

  // Edit states
  const [editPlan, setEditPlan] = useState<"trial" | "core" | "pro">("trial");
  const [editStatus, setEditStatus] = useState<string>("active");
  const [editBillingCycle, setEditBillingCycle] = useState<string>("monthly");

  useEffect(() => {
    fetchSubscriptions();
    fetchInvoices();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setIsLoading(true);
      const data = await api.billing.getAllSubscriptions();
      
      const mappedSubscriptions: Subscription[] = data.map((sub: any) => {
        // Calculate MRR based on plan and cycle
        let mrr = 0;
        if (sub.plan_type === 'pro') {
          mrr = sub.billing_cycle === 'yearly' ? 40 : 49;
        } else if (sub.plan_type === 'core') {
          mrr = sub.billing_cycle === 'yearly' ? 20 : 25;
        }

        return {
          id: sub.id,
          organization: sub.users?.profiles?.full_name || sub.users?.email || "Unknown User",
          plan: (sub.plan_type || "trial") as any,
          status: (sub.status === 'canceled' ? 'cancelled' : sub.status) as any,
          users: 1, // Default to 1 as current model is individual subscriptions
          mrr: mrr,
          nextBilling: sub.current_period_end ? new Date(sub.current_period_end).toISOString().split('T')[0] : 'N/A',
          startDate: sub.created_at ? new Date(sub.created_at).toISOString().split('T')[0] : 'N/A',
          billing_cycle: sub.billing_cycle || 'monthly'
        };
      });

      setSubscriptions(mappedSubscriptions);
    } catch (error) {
      console.error("Failed to fetch subscriptions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      const data = await api.billing.getAdminInvoices();
      setInvoices(data);
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
    }
  };
  
  const handleUpdateSubscription = async () => {
    if (!selectedSubscription) return;
    
    try {
      await api.billing.updateSubscriptionById(selectedSubscription.id, {
        plan_type: editPlan as any,
        status: editStatus === 'cancelled' ? 'canceled' : editStatus, // backend uses 'canceled'
        billing_cycle: editBillingCycle as any
      });
      
      // Refresh list
      await fetchSubscriptions();
      setShowManageSubscriptionModal(false);
      alert("Subscription updated successfully");
    } catch (error) {
      console.error("Failed to update subscription:", error);
      alert("Failed to update subscription");
    }
  };

  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const handleExport = () => {
    // Determine what to export based on active tab
    let csvContent = "";
    let filename = "";

    if (activeTab === "subscriptions") {
      const headers = ["ID", "Organization", "Plan", "Status", "Users", "MRR", "Next Billing", "Start Date"];
      csvContent = [
        headers.join(","),
        ...subscriptions.map(sub => [
          sub.id,
          sub.organization,
          sub.plan,
          sub.status,
          sub.users,
          `$${sub.mrr}`,
          sub.nextBilling,
          sub.startDate
        ].join(","))
      ].join("\n");
      filename = `subscriptions-${new Date().toISOString().split("T")[0]}.csv`;
    } else if (activeTab === "transactions") {
      const headers = ["ID", "Date", "Organization", "Amount", "Status", "Invoice"];
      csvContent = [
        headers.join(","),
        ...transactions.map(txn => [
          txn.id,
          txn.date,
          txn.organization,
          `$${txn.amount}`,
          txn.status,
          txn.invoice
        ].join(","))
      ].join("\n");
      filename = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
    } else {
      // Export overview stats
      const headers = ["Metric", "Value"];
      csvContent = [
        headers.join(","),
        ["Total MRR", `$${stats.totalMRR.toLocaleString()}`].join(","),
        ["Active Subscriptions", stats.activeSubscriptions].join(","),
        ["Trial Conversions", `${stats.trialConversions}%`].join(","),
        ["Churn Rate", `${stats.churnRate}%`].join(",")
      ].join("\n");
      filename = `billing-overview-${new Date().toISOString().split("T")[0]}.csv`;
    }

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const transactions: Transaction[] = invoices.map((inv) => {
    let status: Transaction["status"] = "paid";
    if (inv.status === "open" || inv.status === "draft") status = "pending";
    if (inv.status === "uncollectible") status = "failed";
    if (inv.status === "void" || inv.status === "refunded") status = "refunded";

    return {
      id: inv.id,
      date: inv.created ? new Date(inv.created).toISOString().split("T")[0] : "",
      organization: inv.user_name || inv.user_email || "Unknown User",
      amount: inv.amount_due,
      status,
      invoice: inv.id,
    };
  });

  const filteredSubscriptions = subscriptions.filter((sub) => {
    const matchesSearch = sub.organization.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlan = filterPlan === "all" || sub.plan === filterPlan;
    const matchesStatus = filterStatus === "all" || sub.status === filterStatus;
    return matchesSearch && matchesPlan && matchesStatus;
  });

  const stats = {
    totalMRR: subscriptions.reduce((sum, sub) => sum + sub.mrr, 0),
    activeSubscriptions: subscriptions.filter((s) => s.status === "active").length,
    totalUsers: subscriptions.reduce((sum, sub) => sum + sub.users, 0),
    growth: 23.5,
    trialConversions: 20,
    churnRate: 5,
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case "trial":
        return "from-gray-500 to-gray-600";
      case "core":
        return "from-blue-500 to-blue-600";
      case "pro":
        return "from-purple-500 to-purple-600";
      default:
        return "from-gray-500 to-gray-600";
    }
  };

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case "trial":
        return Package;
      case "core":
        return Star;
      case "pro":
        return Crown;
      default:
        return Package;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700 border-green-300";
      case "trial":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "cancelled":
        return "bg-gray-100 text-gray-700 border-gray-300";
      case "past_due":
        return "bg-red-100 text-red-700 border-red-300";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getTransactionStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-700 border-green-300";
      case "pending":
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "failed":
        return "bg-red-100 text-red-700 border-red-300";
      case "refunded":
        return "bg-gray-100 text-gray-700 border-gray-300";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Billing & Subscriptions</h1>
                <p className="text-muted-foreground">
                  Manage subscriptions, plans, and billing (Placeholder)
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={handleExport}>
                <Download className="w-4 h-4" />
                Export
              </Button>
              <Button className="gap-2" onClick={() => setShowProcessPaymentModal(true)}>
                <CreditCard className="w-4 h-4" />
                Process Payment
              </Button>
            </div>
          </div>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">Placeholder Mode</p>
              <p className="text-xs text-blue-700">
                This is a fully-designed billing interface. Connect to Stripe or your payment processor to enable real transactions.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Monthly Recurring Revenue</p>
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold mb-1">${stats.totalMRR.toLocaleString()}</p>
              <div className="flex items-center gap-1 text-sm">
                <ArrowUpRight className="w-4 h-4 text-green-600" />
                <span className="text-green-600 font-medium">{stats.growth}%</span>
                <span className="text-muted-foreground">vs last month</span>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Active Subscriptions</p>
                <CheckCircle className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold mb-1">{stats.activeSubscriptions}</p>
              <p className="text-sm text-muted-foreground">
                {subscriptions.length} total subscriptions
              </p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Total Users</p>
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-3xl font-bold mb-1">{stats.totalUsers}</p>
              <p className="text-sm text-muted-foreground">Across all plans</p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Avg. Revenue Per User</p>
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-3xl font-bold mb-1">
                ${(stats.totalMRR / stats.totalUsers).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">ARPU</p>
            </Card>
          </motion.div>
        </div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-1">
            <div className="flex gap-1">
              <Button
                variant={activeTab === "overview" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setActiveTab("overview")}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Overview
              </Button>
              <Button
                variant={activeTab === "subscriptions" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setActiveTab("subscriptions")}
              >
                <Package className="w-4 h-4 mr-2" />
                Subscriptions
              </Button>
              <Button
                variant={activeTab === "transactions" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setActiveTab("transactions")}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Transactions
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {["trial", "core", "pro"].map((plan, index) => {
                const Icon = getPlanIcon(plan);
                const count = subscriptions.filter((s) => s.plan === plan).length;
                const revenue = subscriptions
                  .filter((s) => s.plan === plan)
                  .reduce((sum, s) => sum + s.mrr, 0);
                
                return (
                  <motion.div
                    key={plan}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                  >
                    <Card className="p-6 hover:shadow-lg transition-shadow">
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getPlanColor(plan)} flex items-center justify-center mb-4 shadow-lg`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="font-bold text-lg capitalize mb-1">{plan}</h3>
                      <p className="text-2xl font-bold text-primary mb-2">{count}</p>
                      <p className="text-sm text-muted-foreground">
                        ${revenue.toLocaleString()}/mo revenue
                      </p>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* Revenue Chart Placeholder */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4">Revenue Trends</h3>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Chart visualization would go here</p>
                    <p className="text-sm text-muted-foreground">Connect your analytics to view trends</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Subscriptions Tab */}
        {activeTab === "subscriptions" && (
          <div className="space-y-6">
            {/* Filters */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search organizations..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="px-3 py-2 border rounded-lg"
                      value={filterPlan}
                      onChange={(e) => setFilterPlan(e.target.value)}
                    >
                      <option value="all">All Plans</option>
                      <option value="trial">Trial Plan</option>
                      <option value="core">Core Habit</option>
                      <option value="pro">Pro Clarity</option>
                    </select>
                    <select
                      className="px-3 py-2 border rounded-lg"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="trial">Trial</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="past_due">Past Due</option>
                    </select>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Subscriptions List */}
            <div className="space-y-4">
              {filteredSubscriptions.map((sub, index) => {
                const Icon = getPlanIcon(sub.plan);
                return (
                  <motion.div
                    key={sub.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + index * 0.05 }}
                  >
                    <Card className="p-6 hover:shadow-lg transition-shadow">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getPlanColor(sub.plan)} flex items-center justify-center shadow-lg`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">{sub.organization}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm capitalize font-medium">{sub.plan} Plan</span>
                              <span className="text-muted-foreground">•</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(sub.status)}`}>
                                {sub.status.replace("_", " ")}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Users</p>
                            <p className="font-bold">{sub.users}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">MRR</p>
                            <p className="font-bold">${sub.mrr}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Next Billing</p>
                            <p className="font-bold text-sm">{sub.nextBilling}</p>
                          </div>
                          <div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedSubscription(sub);
                                setShowManageSubscriptionModal(true);
                              }}
                            >
                              Manage
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === "transactions" && (
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left p-4 font-medium">Date</th>
                        <th className="text-left p-4 font-medium">Organization</th>
                        <th className="text-left p-4 font-medium">Amount</th>
                        <th className="text-left p-4 font-medium">Invoice</th>
                        <th className="text-left p-4 font-medium">Status</th>
                        <th className="text-left p-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((txn, index) => (
                        <motion.tr
                          key={txn.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + index * 0.05 }}
                          className="border-b hover:bg-gray-50"
                        >
                          <td className="p-4">{txn.date}</td>
                          <td className="p-4 font-medium">{txn.organization}</td>
                          <td className="p-4 font-bold text-green-600">${txn.amount}</td>
                          <td className="p-4">
                            <code className="px-2 py-1 bg-gray-100 rounded text-sm">
                              {txn.invoice}
                            </code>
                          </td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getTransactionStatusBadge(txn.status)}`}>
                              {txn.status}
                            </span>
                          </td>
                          <td className="p-4">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedTransaction(txn);
                                setShowInvoiceModal(true);
                              }}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </div>

      {/* Process Payment Modal */}
      {showProcessPaymentModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowProcessPaymentModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-lg w-full"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Process Payment</h2>
                  <p className="text-sm text-muted-foreground">Manual payment processing</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowProcessPaymentModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Organization</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary">
                  <option value="">Select organization</option>
                  {subscriptions.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.organization} - {sub.plan}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="pl-8"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Payment Method</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary">
                  <option value="credit_card">Credit Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="paypal">PayPal</option>
                  <option value="wire">Wire Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary resize-none"
                  rows={3}
                  placeholder="Add any notes about this payment..."
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Placeholder Mode</p>
                  <p className="text-xs text-blue-700">
                    This would process a payment through your connected payment processor.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowProcessPaymentModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                  onClick={() => {
                    console.log("Processing payment...");
                    setShowProcessPaymentModal(false);
                  }}
                >
                  Process Payment
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Manage Subscription Modal */}
      {showManageSubscriptionModal && selectedSubscription && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowManageSubscriptionModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-lg w-full"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Manage Subscription</h2>
                  <p className="text-sm text-muted-foreground">Edit subscription details</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowManageSubscriptionModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Organization</label>
                <Input
                  type="text"
                  placeholder="Organization Name"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                  value={selectedSubscription.organization}
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Plan</label>
                <select 
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value as "trial" | "core" | "pro")}
                >
                  <option value="trial">Trial Plan</option>
                  <option value="core">Core Habit</option>
                  <option value="pro">Pro Clarity</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select 
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="past_due">Past Due</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Billing Cycle</label>
                <select 
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                  value={editBillingCycle}
                  onChange={(e) => setEditBillingCycle(e.target.value)}
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Users</label>
                <Input
                  type="number"
                  placeholder="Number of Users"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                  value={selectedSubscription.users}
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">MRR</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="pl-8"
                    step="0.01"
                    value={selectedSubscription.mrr}
                    readOnly
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Next Billing</label>
                <Input
                  type="text"
                  placeholder="Next Billing Date"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                  value={selectedSubscription.nextBilling}
                  readOnly
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowManageSubscriptionModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                  onClick={handleUpdateSubscription}
                >
                  Update Subscription
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && selectedTransaction && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowInvoiceModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-lg w-full"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Invoice Details</h2>
                  <p className="text-sm text-muted-foreground">View and download invoice</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInvoiceModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <Input
                  type="text"
                  placeholder="Invoice Date"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                  value={selectedTransaction.date}
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Organization</label>
                <Input
                  type="text"
                  placeholder="Organization Name"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                  value={selectedTransaction.organization}
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="pl-8"
                    step="0.01"
                    value={selectedTransaction.amount}
                    readOnly
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Invoice</label>
                <code className="px-2 py-1 bg-gray-100 rounded text-sm">
                  {selectedTransaction.invoice}
                </code>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getTransactionStatusBadge(selectedTransaction.status)}`}>
                  {selectedTransaction.status}
                </span>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Placeholder Mode</p>
                  <p className="text-xs text-blue-700">
                    This would download the invoice from your connected payment processor.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowInvoiceModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                  onClick={() => {
                    // Create invoice data
                    const invoiceData = `INVOICE: ${selectedTransaction.invoice}\n\nDate: ${selectedTransaction.date}\nOrganization: ${selectedTransaction.organization}\nAmount: $${selectedTransaction.amount}\nStatus: ${selectedTransaction.status}\n\n---\nGenerated by Ezri Admin Dashboard`;
                    
                    // Create and download file
                    const blob = new Blob([invoiceData], { type: 'text/plain' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${selectedTransaction.invoice}.txt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    
                    alert(`✅ Downloaded invoice: ${selectedTransaction.invoice}`);
                    setShowInvoiceModal(false);
                  }}
                >
                  Download Invoice
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AdminLayoutNew>
  );
}
