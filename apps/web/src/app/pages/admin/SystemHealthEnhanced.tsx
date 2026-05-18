import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  Database,
  Cloud,
  AlertCircle,
  CheckCircle,
  Users,
  Download,
  Shield,
  MemoryStick,
  Wifi,
  Clock,
} from "lucide-react";
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
  BarChart,
  Bar,
} from "recharts";
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

const MAX_POINTS = 12;

export function SystemHealthEnhanced() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [history, setHistory] = useState<{ time: string; heap: number; rss: number; err: number }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      setLoadError(null);
      const data = (await api.admin.getSystemHealth()) as HealthSnapshot;
      setSnapshot(data);
      const label = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setHistory((prev) => {
        const next = [
          ...prev,
          { time: label, heap: data.memoryHeapUsedMb, rss: data.memoryRssMb, err: data.errors24h },
        ];
        return next.slice(-MAX_POINTS);
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load system health");
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

  const heapPct = useMemo(() => {
    if (!snapshot || snapshot.memoryHeapTotalMb <= 0) return 0;
    return Math.min(100, Math.round((snapshot.memoryHeapUsedMb / snapshot.memoryHeapTotalMb) * 100));
  }, [snapshot]);

  const systemMetrics = useMemo(() => {
    if (!snapshot) return [];
    return [
      {
        label: "Heap used",
        value: `${snapshot.memoryHeapUsedMb.toFixed(1)} MB`,
        status: heapPct > 90 ? "warning" : "healthy",
        icon: Cpu,
        color: "text-blue-600",
        bg: "bg-blue-100",
        trend: heapPct > 85 ? "+pressure" : "ok",
      },
      {
        label: "RSS",
        value: `${snapshot.memoryRssMb.toFixed(0)} MB`,
        status: "healthy",
        icon: MemoryStick,
        color: "text-green-600",
        bg: "bg-green-100",
        trend: "resident",
      },
      {
        label: "Heap capacity",
        value: `${snapshot.memoryHeapTotalMb.toFixed(0)} MB`,
        status: "healthy",
        icon: HardDrive,
        color: "text-purple-600",
        bg: "bg-purple-100",
        trend: "v8 limit",
      },
      {
        label: "Errors (24h)",
        value: String(snapshot.errors24h),
        status: snapshot.errors24h > 50 ? "warning" : "healthy",
        icon: Wifi,
        color: "text-orange-600",
        bg: "bg-orange-100",
        trend: "from DB",
      },
      {
        label: "Active sessions",
        value: String(snapshot.activeSessions),
        status: "healthy",
        icon: Users,
        color: "text-pink-600",
        bg: "bg-pink-100",
        trend: "live",
      },
      {
        label: "Uptime",
        value: formatShortUptime(snapshot.uptimeSeconds),
        status: "healthy",
        icon: Clock,
        color: "text-emerald-600",
        bg: "bg-emerald-100",
        trend: "process",
      },
    ];
  }, [snapshot, heapPct]);

  const services = useMemo(() => {
    if (!snapshot) return [];
    return [
      {
        name: "Node API",
        status: "healthy",
        uptime: formatShortUptime(snapshot.uptimeSeconds),
        responseTime: `${snapshot.memoryHeapUsedMb.toFixed(0)} MB heap`,
        icon: Server,
        color: "from-green-500 to-emerald-600",
        requests: `${snapshot.activeSessions} sessions`,
        errors: snapshot.errors24h ? `${snapshot.errors24h} (24h)` : "0 (24h)",
      },
      {
        name: "PostgreSQL",
        status: snapshot.databaseConnected ? "healthy" : "error",
        uptime: snapshot.databaseConnected ? "reachable" : "down",
        responseTime: "ping",
        icon: Database,
        color: snapshot.databaseConnected ? "from-blue-500 to-indigo-600" : "from-red-500 to-rose-600",
        requests: "prisma",
        errors: snapshot.databaseConnected ? "0" : "fail",
      },
      {
        name: "Process RSS",
        status: "healthy",
        uptime: "resident",
        responseTime: `${snapshot.memoryRssMb.toFixed(0)} MB`,
        icon: Cloud,
        color: "from-indigo-500 to-blue-600",
        requests: "node",
        errors: "—",
      },
    ];
  }, [snapshot]);

  const cpuChartData = useMemo(() => {
    if (history.length === 0 && snapshot) {
      return [{ time: "now", usage: heapPct, temperature: 40 + heapPct / 2 }];
    }
    return history.map((h) => ({
      time: h.time,
      usage: Math.min(100, (h.heap / Math.max(snapshot?.memoryHeapTotalMb || 1, 1)) * 100),
      temperature: 45 + h.heap / 10,
    }));
  }, [history, snapshot, heapPct]);

  const memoryChartData = useMemo(() => {
    if (history.length === 0 && snapshot) {
      return [{ time: "now", used: snapshot.memoryHeapUsedMb, available: Math.max(0, snapshot.memoryHeapTotalMb - snapshot.memoryHeapUsedMb) }];
    }
    return history.map((h) => ({
      time: h.time,
      used: h.heap,
      available: Math.max(0, (snapshot?.memoryHeapTotalMb || 0) - h.heap),
    }));
  }, [history, snapshot]);

  const requestChartData = useMemo(() => {
    if (history.length === 0 && snapshot) {
      return [{ time: "now", requests: Math.max(1, snapshot.activeSessions * 50), errors: snapshot.errors24h }];
    }
    return history.map((h) => ({
      time: h.time,
      requests: Math.max(1, h.rss * 10),
      errors: h.err,
    }));
  }, [history, snapshot]);

  const responseTimeData = useMemo(() => {
    if (history.length === 0 && snapshot) {
      const b = snapshot.memoryHeapUsedMb * 3;
      return [{ time: "now", avg: b, p95: b * 1.3, p99: b * 1.6 }];
    }
    return history.map((h) => ({
      time: h.time,
      avg: h.heap * 2 + 15,
      p95: h.heap * 2.5 + 25,
      p99: h.heap * 3 + 40,
    }));
  }, [history, snapshot]);

  const handleExport = () => {
    if (!snapshot) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      snapshot,
      chartHistory: history,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-health-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600";
      case "warning":
        return "text-yellow-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-100 text-green-700 border-green-300";
      case "warning":
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "error":
        return "bg-red-100 text-red-700 border-red-300";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center shadow-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">System Health</h1>
                <p className="text-muted-foreground">Node process, database ping, sessions, and error volume</p>
                {loadError && <p className="text-sm text-red-600 mt-1">{loadError}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-700">Live • {currentTime.toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Auto-refresh</span>
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
              <button
                type="button"
                onClick={handleExport}
                disabled={!snapshot}
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Last sample: {snapshot ? new Date(snapshot.timestamp).toLocaleString() : "—"}
          </p>
        </motion.div>

        {!snapshot ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="p-6 h-28 animate-pulse bg-muted/50" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {systemMetrics.map((metric, index) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-12 h-12 rounded-lg ${metric.bg} flex items-center justify-center`}>
                        <metric.icon className={`w-6 h-6 ${metric.color}`} />
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(metric.status)}`}>
                        {metric.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{metric.label}</p>
                    <div className="flex items-end justify-between">
                      <p className="text-2xl font-bold">{metric.value}</p>
                      <span
                        className={`text-sm font-medium ${
                          String(metric.trend).startsWith("+") ? "text-amber-600" : "text-blue-600"
                        }`}
                      >
                        {metric.trend}
                      </span>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-6">Core dependencies</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {services.map((service, index) => (
                    <motion.div
                      key={service.name}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + index * 0.05 }}
                      className="p-5 border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${service.color} flex items-center justify-center shadow-md`}>
                          <service.icon className="w-6 h-6 text-white" />
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(service.status)}`}>
                          {service.status}
                        </span>
                      </div>
                      <h3 className="font-bold mb-3">{service.name}</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Uptime / state</span>
                          <span className="font-medium">{service.uptime}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Signal</span>
                          <span className="font-medium">{service.responseTime}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Detail</span>
                          <span className="font-medium">{service.requests}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Errors</span>
                          <span className={`font-medium ${String(service.errors).includes("fail") ? "text-red-600" : "text-green-600"}`}>
                            {service.errors}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>

            <div className="grid lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-2">Heap pressure vs derived temp</h2>
                  <p className="text-xs text-muted-foreground mb-4">Temperature is illustrative (not CPU die temperature)</p>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={cpuChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis yAxisId="left" domain={[0, 100]} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 120]} />
                      <Tooltip />
                      <Line yAxisId="left" type="monotone" dataKey="usage" stroke="#3B82F6" strokeWidth={2} name="Heap %" />
                      <Line yAxisId="right" type="monotone" dataKey="temperature" stroke="#EF4444" strokeWidth={2} name="Derived" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-6">Heap vs headroom</h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={memoryChartData}>
                      <defs>
                        <linearGradient id="colorUsed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="used" stackId="1" stroke="#8B5CF6" fill="url(#colorUsed)" name="Heap used MB" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </motion.div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-2">Activity proxy</h2>
                  <p className="text-xs text-muted-foreground mb-4">RSS-derived requests vs error_logs (24h)</p>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={requestChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="requests" fill="#10B981" radius={[8, 8, 0, 0]} name="Proxy load" />
                      <Bar dataKey="errors" fill="#EF4444" radius={[8, 8, 0, 0]} name="Errors 24h" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-2">Latency proxy (derived)</h2>
                  <p className="text-xs text-muted-foreground mb-4">From heap samples — not HTTP latency</p>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={responseTimeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="avg" stroke="#10B981" strokeWidth={2} name="avg" />
                      <Line type="monotone" dataKey="p95" stroke="#F59E0B" strokeWidth={2} name="p95" />
                      <Line type="monotone" dataKey="p99" stroke="#EF4444" strokeWidth={2} name="p99" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Notes</h2>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <span>Metrics come from the API process and database; charts fill as auto-refresh samples arrive.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <span>For production SLO charts, wire Prometheus or your host metrics; this view is operational visibility only.</span>
                  </div>
                  {snapshot.errors24h > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <span className="text-amber-900">
                        {snapshot.errors24h} error log entr{snapshot.errors24h === 1 ? "y" : "ies"} in the last 24 hours (see Error Tracking).
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </div>
    </AdminLayoutNew>
  );
}

function formatShortUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 48) return `${Math.floor(h / 24)}d`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
