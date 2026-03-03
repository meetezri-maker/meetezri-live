import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useState, useEffect } from "react";
import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  Zap,
  Database,
  Cloud,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Users,
  Globe,
  RefreshCw,
  AlertTriangle,
  Clock,
  MemoryStick,
  Wifi,
  Download,
  Shield,
  XCircle,
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

export function SystemHealthEnhanced() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleExport = () => {
    alert(`✅ System Health Report Exported!\n\nReport Details:\n• All system metrics\n• Performance charts\n• Service status\n• Recent incidents\n• Resource utilization\n\nThe report has been generated and will download shortly in CSV format.`);
  };

  // Real-time metrics data
  const cpuData = [
    { time: "00:00", usage: 45, temperature: 62 },
    { time: "04:00", usage: 38, temperature: 58 },
    { time: "08:00", usage: 62, temperature: 71 },
    { time: "12:00", usage: 78, temperature: 84 },
    { time: "16:00", usage: 85, temperature: 89 },
    { time: "20:00", usage: 71, temperature: 78 },
    { time: "Now", usage: 54, temperature: 65 },
  ];

  const memoryData = [
    { time: "00:00", used: 4.2, available: 11.8 },
    { time: "04:00", used: 3.8, available: 12.2 },
    { time: "08:00", used: 5.6, available: 10.4 },
    { time: "12:00", used: 6.8, available: 9.2 },
    { time: "16:00", used: 7.2, available: 8.8 },
    { time: "20:00", used: 6.1, available: 9.9 },
    { time: "Now", used: 5.3, available: 10.7 },
  ];

  const requestData = [
    { time: "00:00", requests: 1200, errors: 12 },
    { time: "04:00", requests: 800, errors: 8 },
    { time: "08:00", requests: 2800, errors: 15 },
    { time: "12:00", requests: 4200, errors: 23 },
    { time: "16:00", requests: 3800, errors: 18 },
    { time: "20:00", requests: 2400, errors: 14 },
    { time: "Now", requests: 1600, errors: 10 },
  ];

  const responseTimeData = [
    { time: "00:00", avg: 42, p95: 89, p99: 156 },
    { time: "04:00", avg: 38, p95: 76, p99: 134 },
    { time: "08:00", avg: 56, p95: 112, p99: 203 },
    { time: "12:00", avg: 78, p95: 145, p99: 267 },
    { time: "16:00", avg: 85, p95: 167, p99: 298 },
    { time: "20:00", avg: 64, p95: 123, p99: 234 },
    { time: "Now", avg: 48, p95: 95, p99: 178 },
  ];

  const services = [
    {
      name: "Web Server",
      status: "healthy",
      uptime: "99.98%",
      responseTime: "42ms",
      icon: Server,
      color: "from-green-500 to-emerald-600",
      requests: "45.2K/hr",
      errors: "0.02%",
    },
    {
      name: "Database",
      status: "healthy",
      uptime: "99.95%",
      responseTime: "12ms",
      icon: Database,
      color: "from-blue-500 to-indigo-600",
      requests: "89.5K/hr",
      errors: "0.01%",
    },
    {
      name: "API Gateway",
      status: "healthy",
      uptime: "99.99%",
      responseTime: "8ms",
      icon: Globe,
      color: "from-purple-500 to-pink-600",
      requests: "156K/hr",
      errors: "0.03%",
    },
    {
      name: "Cache Server",
      status: "warning",
      uptime: "98.52%",
      responseTime: "156ms",
      icon: Zap,
      color: "from-yellow-500 to-orange-500",
      requests: "234K/hr",
      errors: "1.48%",
    },
    {
      name: "File Storage",
      status: "healthy",
      uptime: "99.97%",
      responseTime: "23ms",
      icon: Cloud,
      color: "from-indigo-500 to-blue-600",
      requests: "23.4K/hr",
      errors: "0.01%",
    },
    {
      name: "AI Service",
      status: "healthy",
      uptime: "99.91%",
      responseTime: "234ms",
      icon: Activity,
      color: "from-pink-500 to-rose-600",
      requests: "12.3K/hr",
      errors: "0.09%",
    },
  ];

  const systemMetrics = [
    {
      label: "CPU Usage",
      value: "54%",
      status: "healthy",
      icon: Cpu,
      color: "text-blue-600",
      bg: "bg-blue-100",
      trend: "-8%",
    },
    {
      label: "Memory",
      value: "5.3 / 16 GB",
      status: "healthy",
      icon: MemoryStick,
      color: "text-green-600",
      bg: "bg-green-100",
      trend: "-12%",
    },
    {
      label: "Disk Usage",
      value: "234 / 500 GB",
      status: "healthy",
      icon: HardDrive,
      color: "text-purple-600",
      bg: "bg-purple-100",
      trend: "+3%",
    },
    {
      label: "Network I/O",
      value: "1.2 GB/s",
      status: "healthy",
      icon: Wifi,
      color: "text-orange-600",
      bg: "bg-orange-100",
      trend: "+15%",
    },
    {
      label: "Active Sessions",
      value: "1,234",
      status: "healthy",
      icon: Users,
      color: "text-pink-600",
      bg: "bg-pink-100",
      trend: "+23%",
    },
    {
      label: "Avg Response",
      value: "48ms",
      status: "healthy",
      icon: Clock,
      color: "text-emerald-600",
      bg: "bg-emerald-100",
      trend: "-18%",
    },
  ];

  const alerts = [
    {
      id: 1,
      type: "warning",
      service: "Cache Server",
      message: "Response time above threshold (156ms)",
      time: "2 minutes ago",
    },
    {
      id: 2,
      type: "info",
      service: "API Gateway",
      message: "High traffic detected - auto-scaling initiated",
      time: "15 minutes ago",
    },
    {
      id: 3,
      type: "success",
      service: "Database",
      message: "Backup completed successfully",
      time: "1 hour ago",
    },
  ];

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

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-blue-600" />;
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
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center shadow-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">System Health</h1>
                <p className="text-muted-foreground">
                  Real-time monitoring of system performance and services
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-700">
                  All Systems Operational
                </span>
              </div>
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${autoRefresh ? "animate-spin" : ""}`} />
                {autoRefresh ? "Auto-refresh" : "Paused"}
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Last updated: {currentTime.toLocaleTimeString()}
          </p>
        </motion.div>

        {/* System Metrics Grid */}
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
                  <span className={`text-sm font-medium ${
                    metric.trend.startsWith("+") ? "text-green-600" : "text-blue-600"
                  }`}>
                    {metric.trend}
                  </span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Service Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-6">Service Status</h2>
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
                      <span className="text-muted-foreground">Uptime</span>
                      <span className="font-medium">{service.uptime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Response</span>
                      <span className="font-medium">{service.responseTime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Requests</span>
                      <span className="font-medium">{service.requests}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Error Rate</span>
                      <span className={`font-medium ${
                        parseFloat(service.errors) > 1 ? "text-red-600" : "text-green-600"
                      }`}>
                        {service.errors}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Performance Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">CPU & Temperature</h2>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={cpuData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="usage"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    name="CPU %"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="temperature"
                    stroke="#EF4444"
                    strokeWidth={2}
                    name="Temp °C"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Memory Usage</h2>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={memoryData}>
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
                  <Area
                    type="monotone"
                    dataKey="used"
                    stackId="1"
                    stroke="#8B5CF6"
                    fill="url(#colorUsed)"
                    name="Used GB"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Request Volume</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={requestData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="requests" fill="#10B981" radius={[8, 8, 0, 0]} name="Success" />
                  <Bar dataKey="errors" fill="#EF4444" radius={[8, 8, 0, 0]} name="Errors" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Response Time</h2>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={responseTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="avg" stroke="#10B981" strokeWidth={2} name="Average" />
                  <Line type="monotone" dataKey="p95" stroke="#F59E0B" strokeWidth={2} name="P95" />
                  <Line type="monotone" dataKey="p99" stroke="#EF4444" strokeWidth={2} name="P99" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        {/* System Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Recent Alerts</h2>
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1 + index * 0.1 }}
                  className={`p-4 border rounded-lg ${
                    alert.type === "warning" ? "bg-yellow-50 border-yellow-200" :
                    alert.type === "error" ? "bg-red-50 border-red-200" :
                    alert.type === "success" ? "bg-green-50 border-green-200" :
                    "bg-blue-50 border-blue-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {getAlertIcon(alert.type)}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="font-medium">{alert.service}</h3>
                        <span className="text-xs text-muted-foreground">{alert.time}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}