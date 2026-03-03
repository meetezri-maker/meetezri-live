import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
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
  RefreshCw
} from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";

export function SystemHealth() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Mock system metrics
  const cpuData = [
    { time: "00:00", usage: 45 },
    { time: "04:00", usage: 38 },
    { time: "08:00", usage: 62 },
    { time: "12:00", usage: 78 },
    { time: "16:00", usage: 85 },
    { time: "20:00", usage: 71 },
    { time: "24:00", usage: 54 }
  ];

  const memoryData = [
    { time: "00:00", memory: 4.2 },
    { time: "04:00", memory: 3.8 },
    { time: "08:00", memory: 5.6 },
    { time: "12:00", memory: 6.8 },
    { time: "16:00", memory: 7.2 },
    { time: "20:00", memory: 6.1 },
    { time: "24:00", memory: 5.3 }
  ];

  const requestData = [
    { time: "00:00", requests: 1200 },
    { time: "04:00", requests: 800 },
    { time: "08:00", requests: 2800 },
    { time: "12:00", requests: 4200 },
    { time: "16:00", requests: 3800 },
    { time: "20:00", requests: 2400 },
    { time: "24:00", requests: 1600 }
  ];

  const services = [
    {
      name: "Web Server",
      status: "healthy",
      uptime: "99.98%",
      responseTime: "42ms",
      icon: Server,
      color: "from-green-500 to-emerald-600"
    },
    {
      name: "Database",
      status: "healthy",
      uptime: "99.95%",
      responseTime: "12ms",
      icon: Database,
      color: "from-blue-500 to-indigo-600"
    },
    {
      name: "API Gateway",
      status: "healthy",
      uptime: "99.99%",
      responseTime: "8ms",
      icon: Globe,
      color: "from-purple-500 to-pink-600"
    },
    {
      name: "Cache Server",
      status: "warning",
      uptime: "98.52%",
      responseTime: "156ms",
      icon: Zap,
      color: "from-yellow-500 to-orange-500"
    },
    {
      name: "File Storage",
      status: "healthy",
      uptime: "99.97%",
      responseTime: "23ms",
      icon: Cloud,
      color: "from-indigo-500 to-blue-600"
    },
    {
      name: "AI Service",
      status: "healthy",
      uptime: "99.91%",
      responseTime: "234ms",
      icon: Cpu,
      color: "from-pink-500 to-rose-600"
    }
  ];

  const systemMetrics = [
    {
      label: "CPU Usage",
      value: "68%",
      status: "normal",
      icon: Cpu,
      color: "from-blue-500 to-indigo-600"
    },
    {
      label: "Memory",
      value: "6.2 / 16 GB",
      status: "normal",
      icon: HardDrive,
      color: "from-green-500 to-emerald-600"
    },
    {
      label: "Disk I/O",
      value: "245 MB/s",
      status: "normal",
      icon: Activity,
      color: "from-purple-500 to-pink-600"
    },
    {
      label: "Network",
      value: "1.2 GB/s",
      status: "normal",
      icon: TrendingUp,
      color: "from-orange-500 to-red-600"
    }
  ];

  const getStatusColor = (status: string) => {
    switch(status) {
      case "healthy": return "text-green-500 bg-green-100";
      case "warning": return "text-yellow-600 bg-yellow-100";
      case "critical": return "text-red-500 bg-red-100";
      default: return "text-gray-500 bg-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "healthy": return CheckCircle;
      case "warning": return AlertCircle;
      case "critical": return AlertCircle;
      default: return CheckCircle;
    }
  };

  const handleRefresh = () => {
    setLastUpdated(new Date());
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
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
              <motion.div
                animate={{ rotate: autoRefresh ? 360 : 0 }}
                transition={{ duration: 2, repeat: autoRefresh ? Infinity : 0, ease: "linear" }}
              >
                <Activity className="w-6 h-6 text-green-500" />
              </motion.div>
            </div>
            <p className="text-gray-600 mt-1">Real-time system monitoring and performance metrics</p>
          </div>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                autoRefresh 
                  ? "bg-green-500 text-white" 
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              {autoRefresh ? "Auto-Refresh ON" : "Auto-Refresh OFF"}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, rotate: 180 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleRefresh}
              className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50"
            >
              <RefreshCw className="w-5 h-5 text-gray-700" />
            </motion.button>
          </div>
        </motion.div>

        {/* Last Updated */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-gray-600 text-right"
        >
          Last updated: {lastUpdated.toLocaleTimeString()}
        </motion.div>

        {/* System Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {systemMetrics.map((metric, index) => {
            const Icon = metric.icon;
            
            return (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -5 }}
                className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${metric.color}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-600 text-sm">{metric.label}</p>
                    <p className="text-xl font-bold text-gray-900">{metric.value}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Services Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Services Status</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service, index) => {
              const Icon = service.icon;
              const StatusIcon = getStatusIcon(service.status);
              
              return (
                <motion.div
                  key={service.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                  whileHover={{ scale: 1.03 }}
                  className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${service.color}`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{service.name}</h3>
                    </div>
                    <StatusIcon className={`w-5 h-5 ${service.status === 'healthy' ? 'text-green-500' : 'text-yellow-500'}`} />
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Uptime</span>
                      <span className="font-medium text-gray-900">{service.uptime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Response Time</span>
                      <span className="font-medium text-gray-900">{service.responseTime}</span>
                    </div>
                    <div className="pt-2">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium capitalize ${getStatusColor(service.status)}`}>
                        {service.status}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* CPU Usage Chart */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">CPU Usage (24h)</h2>
              <Cpu className="w-5 h-5 text-blue-500" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={cpuData}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                  formatter={(value: number) => `${value}%`}
                />
                <Area type="monotone" dataKey="usage" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCpu)" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Memory Usage Chart */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Memory Usage (24h)</h2>
              <HardDrive className="w-5 h-5 text-green-500" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={memoryData}>
                <defs>
                  <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                  formatter={(value: number) => `${value} GB`}
                />
                <Area type="monotone" dataKey="memory" stroke="#10b981" fillOpacity={1} fill="url(#colorMemory)" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* API Requests Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">API Requests (24h)</h2>
              <p className="text-gray-600 text-sm mt-1">Total requests per hour</p>
            </div>
            <Globe className="w-5 h-5 text-purple-500" />
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={requestData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="time" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                formatter={(value: number) => `${value.toLocaleString()} req`}
              />
              <Line type="monotone" dataKey="requests" stroke="#8b5cf6" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* System Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="grid md:grid-cols-2 gap-6"
        >
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">System Information</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Operating System</span>
                <span className="font-medium text-gray-900">Ubuntu 22.04 LTS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Server Location</span>
                <span className="font-medium text-gray-900">US East (Virginia)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Deployment</span>
                <span className="font-medium text-gray-900">Production v2.4.1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Deploy</span>
                <span className="font-medium text-gray-900">2 hours ago</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Alerts</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-yellow-900">Cache server high latency</p>
                  <p className="text-yellow-700">15 minutes ago</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-green-900">Database backup completed</p>
                  <p className="text-green-700">1 hour ago</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}