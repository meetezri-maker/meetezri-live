import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Activity,
  Server,
  Database,
  Zap,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { api } from "@/lib/api";

type HealthSnapshot = {
  timestamp: string;
  uptimeSeconds: number;
  memoryHeapUsedMb: number;
  memoryHeapTotalMb: number;
  memoryRssMb: number;
  databaseConnected: boolean;
  activeSessions: number;
  errors24h: number;
};

const MAX_POINTS = 14;

export function SystemHealthDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [history, setHistory] = useState<{ time: string; heap: number; rss: number }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      setLoadError(null);
      const data = (await api.admin.getSystemHealth()) as HealthSnapshot;
      setSnapshot(data);
      const label = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setHistory((prev) => {
        const next = [...prev, { time: label, heap: data.memoryHeapUsedMb, rss: data.memoryRssMb }];
        return next.slice(-MAX_POINTS);
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load system health");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHealth();
  }, [fetchHealth]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => void fetchHealth(), 15000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchHealth]);

  const metrics = useMemo(() => {
    if (!snapshot) return [];
    const heapPct =
      snapshot.memoryHeapTotalMb > 0
        ? Math.min(100, Math.round((snapshot.memoryHeapUsedMb / snapshot.memoryHeapTotalMb) * 100))
        : 0;
    const dbOk = snapshot.databaseConnected;
    return [
      {
        label: "System Uptime",
        value: formatUptime(snapshot.uptimeSeconds),
        status: "healthy" as const,
        trend: "up" as const,
        change: "live",
        icon: Activity,
        color: "from-green-500 to-emerald-600",
      },
      {
        label: "Node heap used",
        value: `${snapshot.memoryHeapUsedMb.toFixed(0)} MB`,
        status: heapPct > 90 ? ("warning" as const) : ("healthy" as const),
        trend: heapPct > 85 ? ("up" as const) : ("down" as const),
        change: `${heapPct}% of cap`,
        icon: Zap,
        color: "from-blue-500 to-cyan-600",
      },
      {
        label: "Database",
        value: dbOk ? "Connected" : "Unreachable",
        status: dbOk ? ("healthy" as const) : ("error" as const),
        trend: "up" as const,
        change: dbOk ? "ok" : "fail",
        icon: Database,
        color: "from-purple-500 to-pink-600",
      },
      {
        label: "Errors (24h)",
        value: String(snapshot.errors24h),
        status: snapshot.errors24h > 20 ? ("warning" as const) : ("healthy" as const),
        trend: "up" as const,
        change: "from API logs",
        icon: AlertTriangle,
        color: "from-orange-500 to-amber-600",
      },
    ];
  }, [snapshot]);

  const services = useMemo(() => {
    if (!snapshot) return [];
    return [
      {
        name: "API process",
        status: "healthy" as const,
        uptime: formatUptime(snapshot.uptimeSeconds),
        heap: `${snapshot.memoryHeapUsedMb.toFixed(1)} / ${snapshot.memoryHeapTotalMb.toFixed(0)} MB`,
        rss: `${snapshot.memoryRssMb.toFixed(0)} MB`,
      },
      {
        name: "Database",
        status: snapshot.databaseConnected ? ("healthy" as const) : ("error" as const),
        uptime: snapshot.databaseConnected ? "connected" : "—",
        ping: snapshot.databaseConnected ? "ok" : "failed",
      },
      {
        name: "Live sessions",
        status: "healthy" as const,
        uptime: "now",
        count: String(snapshot.activeSessions),
      },
    ];
  }, [snapshot]);

  const performanceData = useMemo(() => {
    if (history.length === 0 && snapshot) {
      return [
        {
          time: "now",
          cpu: Math.min(100, (snapshot.memoryHeapUsedMb / Math.max(snapshot.memoryHeapTotalMb, 1)) * 100),
          memory: Math.min(100, (snapshot.memoryHeapUsedMb / Math.max(snapshot.memoryHeapTotalMb, 1)) * 100),
          network: Math.min(100, (snapshot.memoryRssMb / 4096) * 100),
        },
      ];
    }
    return history.map((h) => ({
      time: h.time,
      cpu: Math.min(100, h.heap * 2),
      memory: Math.min(100, h.heap * 3),
      network: Math.min(100, h.rss / 50),
    }));
  }, [history, snapshot]);

  const responseTimeData = useMemo(() => {
    if (history.length === 0 && snapshot) {
      const base = snapshot.memoryHeapUsedMb * 2 + 20;
      return [{ time: "now", p50: base, p95: base * 1.4, p99: base * 1.8 }];
    }
    return history.map((h) => ({
      time: h.time,
      p50: h.heap * 2 + 10,
      p95: h.heap * 2.5 + 20,
      p99: h.heap * 3 + 40,
    }));
  }, [history, snapshot]);

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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">System Health Dashboard</h1>
            <p className="text-gray-600">
              Live Node process and database metrics (same source as System Health)
            </p>
            {snapshot && (
              <p className="text-xs text-gray-500 mt-1">
                Last sample: {new Date(snapshot.timestamp).toLocaleString()}
              </p>
            )}
            {loadError && <p className="text-sm text-red-600 mt-2">{loadError}</p>}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-xl border border-green-200">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-green-700 font-medium">Live</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Auto-refresh</span>
              <button
                type="button"
                aria-pressed={autoRefresh}
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`relative w-14 h-8 rounded-full transition-all ${
                  autoRefresh ? "bg-gradient-to-r from-green-500 to-emerald-600" : "bg-gray-300"
                }`}
              >
                <motion.div
                  className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
                  animate={{ left: autoRefresh ? 30 : 4 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </div>
        </motion.div>

        {isLoading && !snapshot ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
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
                      <h3 className="text-3xl font-bold text-gray-900 mb-1">{metric.value}</h3>
                      <p className="text-sm text-gray-600 mb-2">{metric.label}</p>
                      <div
                        className={`flex items-center gap-1 text-xs font-medium ${
                          metric.trend === "up" ? "text-green-600" : metric.trend === "down" ? "text-red-600" : "text-gray-600"
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="bg-white border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">Resource pressure (derived)</h3>
                      <p className="text-sm text-gray-600">Heap / RSS sampled while this page is open</p>
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
                      <YAxis stroke="#6b7280" domain={[0, 100]} />
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
                        name="Scaled heap"
                      />
                      <Area
                        type="monotone"
                        dataKey="memory"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorMemory)"
                        name="Scaled memory"
                      />
                      <Area
                        type="monotone"
                        dataKey="network"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorNetwork)"
                        name="Scaled RSS"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="bg-white border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">Latency proxy (derived)</h3>
                      <p className="text-sm text-gray-600">Illustrative series from heap samples (not real HTTP latency)</p>
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
                        name="p50 (derived)"
                      />
                      <Line
                        type="monotone"
                        dataKey="p95"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={{ fill: "#f59e0b", r: 4 }}
                        name="p95 (derived)"
                      />
                      <Line
                        type="monotone"
                        dataKey="p99"
                        stroke="#ef4444"
                        strokeWidth={3}
                        dot={{ fill: "#ef4444", r: 4 }}
                        name="p99 (derived)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-white border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Server className="w-6 h-6 text-blue-600" />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Services</h3>
                    <p className="text-sm text-gray-600">From live system-health snapshot</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                              service.status === "healthy" ? "text-green-600" : "text-red-600"
                            }`}
                          />
                        </div>
                        <div className="space-y-1">
                          {Object.entries(service)
                            .filter(([key]) => key !== "name" && key !== "status")
                            .map(([key, value]) => (
                              <div key={key} className="flex justify-between text-xs">
                                <span className="text-gray-600 capitalize">{key.replace("_", " ")}:</span>
                                <span className="text-gray-900 font-medium">{String(value)}</span>
                              </div>
                            ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </div>
    </AdminLayoutNew>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
