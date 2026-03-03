import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Activity,
  Server,
  Database,
  Zap,
  Globe,
  HardDrive,
  Cpu,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

export function SystemHealthDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // System Metrics
  const metrics = [
    {
      label: "System Uptime",
      value: "99.98%",
      status: "healthy",
      trend: "up",
      change: "+0.02%",
      icon: Activity,
      color: "from-green-500 to-emerald-600",
    },
    {
      label: "API Response Time",
      value: "124ms",
      status: "healthy",
      trend: "down",
      change: "-12ms",
      icon: Zap,
      color: "from-blue-500 to-cyan-600",
    },
    {
      label: "Database Health",
      value: "Optimal",
      status: "healthy",
      trend: "up",
      change: "+2%",
      icon: Database,
      color: "from-purple-500 to-pink-600",
    },
    {
      label: "Error Rate",
      value: "0.08%",
      status: "warning",
      trend: "up",
      change: "+0.03%",
      icon: AlertTriangle,
      color: "from-orange-500 to-amber-600",
    },
  ];

  // Services Status
  const services = [
    {
      name: "API Server",
      status: "healthy",
      uptime: "100%",
      latency: "45ms",
      requests: "12.4K/min",
    },
    {
      name: "Database Primary",
      status: "healthy",
      uptime: "100%",
      connections: "234/500",
      queries: "3.2K/s",
    },
    {
      name: "Database Replica",
      status: "healthy",
      uptime: "100%",
      connections: "156/500",
      queries: "1.8K/s",
    },
    {
      name: "Redis Cache",
      status: "healthy",
      uptime: "100%",
      memory: "2.4GB/8GB",
      hit_rate: "97.2%",
    },
    {
      name: "File Storage (S3)",
      status: "healthy",
      uptime: "99.99%",
      storage: "1.2TB/5TB",
      bandwidth: "124MB/s",
    },
    {
      name: "Email Service",
      status: "healthy",
      uptime: "100%",
      sent: "4.5K today",
      queue: "12 pending",
    },
    {
      name: "SMS Service",
      status: "warning",
      uptime: "99.8%",
      sent: "1.2K today",
      queue: "234 pending",
    },
    {
      name: "CDN",
      status: "healthy",
      uptime: "100%",
      bandwidth: "2.1GB/s",
      cache_hit: "94.5%",
    },
  ];

  // Performance Data
  const performanceData = [
    { time: "00:00", cpu: 45, memory: 62, network: 34 },
    { time: "04:00", cpu: 38, memory: 58, network: 28 },
    { time: "08:00", cpu: 72, memory: 68, network: 56 },
    { time: "12:00", cpu: 85, memory: 74, network: 68 },
    { time: "16:00", cpu: 78, memory: 71, network: 62 },
    { time: "20:00", cpu: 68, memory: 66, network: 48 },
    { time: "23:59", cpu: 52, memory: 64, network: 38 },
  ];

  // Response Time Data
  const responseTimeData = [
    { time: "00:00", p50: 98, p95: 245, p99: 456 },
    { time: "04:00", p50: 85, p95: 198, p99: 378 },
    { time: "08:00", p50: 124, p95: 312, p99: 589 },
    { time: "12:00", p50: 142, p95: 356, p99: 678 },
    { time: "16:00", p50: 135, p95: 334, p99: 612 },
    { time: "20:00", p50: 118, p95: 289, p99: 534 },
    { time: "23:59", p50: 106, p95: 256, p99: 478 },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600 bg-green-50";
      case "warning":
        return "text-yellow-600 bg-yellow-50";
      case "error":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return CheckCircle2;
      case "warning":
        return AlertTriangle;
      case "error":
        return XCircle;
      default:
        return Activity;
    }
  };

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              System Health Dashboard
            </h1>
            <p className="text-gray-600">
              Real-time monitoring and performance metrics
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-xl border border-green-200">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-green-700 font-medium">Live</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Auto-refresh</span>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`relative w-14 h-8 rounded-full transition-all ${
                  autoRefresh
                    ? "bg-gradient-to-r from-green-500 to-emerald-600"
                    : "bg-gray-300"
                }`}
              >
                <motion.div
                  className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
                  animate={{ left: autoRefresh ? 30 : 4 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>

            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric, index) => {
            const StatusIcon = getStatusIcon(metric.status);
            return (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="bg-white border border-gray-200 p-6 hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${metric.color} flex items-center justify-center shadow-lg`}
                    >
                      <metric.icon className="w-6 h-6 text-white" />
                    </div>
                    <StatusIcon
                      className={`w-5 h-5 ${
                        metric.status === "healthy"
                          ? "text-green-600"
                          : metric.status === "warning"
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    />
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-1">
                    {metric.value}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">{metric.label}</p>
                  <div
                    className={`flex items-center gap-1 text-xs font-medium ${
                      metric.trend === "up"
                        ? "text-green-600"
                        : metric.trend === "down"
                        ? "text-red-600"
                        : "text-gray-600"
                    }`}
                  >
                    {metric.trend === "up" ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {metric.change}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Performance Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Resources */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    System Resources
                  </h3>
                  <p className="text-sm text-gray-600">CPU, Memory, Network usage</p>
                </div>
                <Cpu className="w-5 h-5 text-purple-600" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorNetwork" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      color: "#1f2937",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCpu)"
                    name="CPU %"
                  />
                  <Area
                    type="monotone"
                    dataKey="memory"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorMemory)"
                    name="Memory %"
                  />
                  <Area
                    type="monotone"
                    dataKey="network"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorNetwork)"
                    name="Network %"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* API Response Time */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    API Response Time
                  </h3>
                  <p className="text-sm text-gray-600">p50, p95, p99 latency</p>
                </div>
                <Zap className="w-5 h-5 text-cyan-600" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={responseTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      color: "#1f2937",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="p50"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: "#10b981", r: 4 }}
                    name="p50 (ms)"
                  />
                  <Line
                    type="monotone"
                    dataKey="p95"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    dot={{ fill: "#f59e0b", r: 4 }}
                    name="p95 (ms)"
                  />
                  <Line
                    type="monotone"
                    dataKey="p99"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={{ fill: "#ef4444", r: 4 }}
                    name="p99 (ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        {/* Services Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-white border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Server className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="text-xl font-bold text-gray-900">Services Status</h3>
                <p className="text-sm text-gray-600">
                  All system services and dependencies
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {services.map((service, index) => {
                const StatusIcon = getStatusIcon(service.status);
                return (
                  <motion.div
                    key={service.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                    className="p-4 bg-gray-50 border border-gray-200 rounded-xl hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-gray-900 font-medium">{service.name}</h4>
                      <StatusIcon
                        className={`w-5 h-5 ${
                          service.status === "healthy"
                            ? "text-green-600"
                            : service.status === "warning"
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      />
                    </div>
                    <div className="space-y-1">
                      {Object.entries(service)
                        .filter(([key]) => key !== "name" && key !== "status")
                        .map(([key, value]) => (
                          <div key={key} className="flex justify-between text-xs">
                            <span className="text-gray-600 capitalize">
                              {key.replace("_", " ")}:
                            </span>
                            <span className="text-gray-900 font-medium">{value}</span>
                          </div>
                        ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}
