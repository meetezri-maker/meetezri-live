import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { 
  Key,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Edit,
  Check,
  X,
  Webhook,
  Activity,
  BarChart3,
  AlertCircle,
  Globe
} from "lucide-react";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface APIKey {
  id: string;
  name: string;
  key: string;
  created: Date;
  lastUsed: Date;
  requests: number;
  rateLimit: string;
  status: "active" | "inactive";
  environment: "production" | "development" | "staging";
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: "active" | "inactive";
  lastTriggered?: Date;
  successRate: number;
}

export function APIManagement() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddWebhookModal, setShowAddWebhookModal] = useState(false);
  const [showEditWebhookModal, setShowEditWebhookModal] = useState(false);
  const [showDeleteWebhookModal, setShowDeleteWebhookModal] = useState(false);
  const [selectedAPIKey, setSelectedAPIKey] = useState<APIKey | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Mock API keys
  const [apiKeys, setApiKeys] = useState<APIKey[]>([
    {
      id: "key1",
      name: "Production API Key",
      key: "ezri_prod_xk7b9m3n2p5q8w1e4r6t",
      created: new Date("2024-01-15"),
      lastUsed: new Date(Date.now() - 5 * 60 * 1000),
      requests: 125420,
      rateLimit: "1000/hour",
      status: "active",
      environment: "production"
    },
    {
      id: "key2",
      name: "Mobile App Key",
      key: "ezri_prod_a5c8f2k9m7n4p1q3r6s8",
      created: new Date("2024-02-01"),
      lastUsed: new Date(Date.now() - 30 * 60 * 1000),
      requests: 89234,
      rateLimit: "5000/hour",
      status: "active",
      environment: "production"
    },
    {
      id: "key3",
      name: "Development Key",
      key: "ezri_dev_h2j5k8l1m4n7p0q3r6s9",
      created: new Date("2024-03-10"),
      lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000),
      requests: 3456,
      rateLimit: "100/hour",
      status: "active",
      environment: "development"
    },
    {
      id: "key4",
      name: "Legacy API Key",
      key: "ezri_prod_z9x8c7v6b5n4m3k2j1h0",
      created: new Date("2023-11-20"),
      lastUsed: new Date("2024-06-15"),
      requests: 234890,
      rateLimit: "500/hour",
      status: "inactive",
      environment: "production"
    }
  ]);

  // Mock webhooks
  const [webhooks, setWebhooks] = useState<Webhook[]>([
    {
      id: "wh1",
      name: "User Events",
      url: "https://api.example.com/webhooks/users",
      events: ["user.created", "user.updated", "user.deleted"],
      status: "active",
      lastTriggered: new Date(Date.now() - 10 * 60 * 1000),
      successRate: 99.8
    },
    {
      id: "wh2",
      name: "Session Analytics",
      url: "https://analytics.example.com/session-data",
      events: ["session.started", "session.completed"],
      status: "active",
      lastTriggered: new Date(Date.now() - 25 * 60 * 1000),
      successRate: 98.5
    },
    {
      id: "wh3",
      name: "Crisis Alerts",
      url: "https://alerts.example.com/crisis",
      events: ["crisis.detected", "crisis.escalated"],
      status: "active",
      lastTriggered: new Date(Date.now() - 2 * 60 * 60 * 1000),
      successRate: 100
    },
    {
      id: "wh4",
      name: "Payment Notifications",
      url: "https://billing.example.com/webhook",
      events: ["payment.success", "payment.failed", "subscription.updated"],
      status: "inactive",
      successRate: 95.2
    }
  ]);

  // Mock API usage data
  const usageData = [
    { time: "00:00", requests: 1200 },
    { time: "04:00", requests: 800 },
    { time: "08:00", requests: 2800 },
    { time: "12:00", requests: 4200 },
    { time: "16:00", requests: 3800 },
    { time: "20:00", requests: 2400 },
    { time: "24:00", requests: 1600 }
  ];

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (text: string, keyId: string) => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        setCopiedKey(keyId);
        setTimeout(() => setCopiedKey(null), 2000);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          textArea.remove();
          setCopiedKey(keyId);
          setTimeout(() => setCopiedKey(null), 2000);
        } catch (err) {
          console.error('Fallback: Could not copy text', err);
          textArea.remove();
          // Silently fail - don't show error to user
        }
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Silently fail - don't show error to user
    }
  };

  const formatTimeAgo = (date: Date) => {
    const minutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const maskKey = (key: string) => {
    return `${key.substring(0, 12)}${"•".repeat(20)}`;
  };

  const getEnvironmentColor = (env: string) => {
    switch(env) {
      case "production": return "bg-red-100 text-red-700";
      case "development": return "bg-blue-100 text-blue-700";
      case "staging": return "bg-yellow-100 text-yellow-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusColor = (status: string) => {
    return status === "active" 
      ? "bg-green-100 text-green-700" 
      : "bg-gray-100 text-gray-700";
  };

  const totalRequests = apiKeys.reduce((sum, key) => sum + key.requests, 0);
  const activeKeys = apiKeys.filter(k => k.status === "active").length;
  const activeWebhooks = webhooks.filter(w => w.status === "active").length;

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
            <h1 className="text-3xl font-bold text-gray-900">API Management</h1>
            <p className="text-gray-600 mt-1">Manage API keys, webhooks, and rate limits</p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Create API Key
          </motion.button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <Key className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Active API Keys</p>
                <p className="text-2xl font-bold text-gray-900">{activeKeys}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total Requests</p>
                <p className="text-2xl font-bold text-gray-900">{totalRequests.toLocaleString()}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                <Webhook className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Active Webhooks</p>
                <p className="text-2xl font-bold text-gray-900">{activeWebhooks}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* API Usage Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">API Usage (24h)</h2>
              <p className="text-gray-600 text-sm mt-1">Requests per hour across all keys</p>
            </div>
            <BarChart3 className="w-5 h-5 text-blue-500" />
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={usageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="time" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}
                formatter={(value: number) => `${value.toLocaleString()} req`}
              />
              <Line type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* API Keys */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">API Keys</h2>
          
          <div className="space-y-4">
            {apiKeys.map((key, index) => {
              const isVisible = visibleKeys.has(key.id);
              const isCopied = copiedKey === key.id;
              
              return (
                <motion.div
                  key={key.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.05 }}
                  className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-gray-900">{key.name}</h3>
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${getEnvironmentColor(key.environment)}`}>
                          {key.environment}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${getStatusColor(key.status)}`}>
                          {key.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-3">
                        <code className="text-sm bg-gray-100 px-3 py-1 rounded-lg font-mono">
                          {isVisible ? key.key : maskKey(key.key)}
                        </code>
                        
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => toggleKeyVisibility(key.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100"
                        >
                          {isVisible ? <EyeOff className="w-4 h-4 text-gray-600" /> : <Eye className="w-4 h-4 text-gray-600" />}
                        </motion.button>
                        
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => copyToClipboard(key.key, key.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100"
                        >
                          {isCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
                        </motion.button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Created</p>
                          <p className="font-medium text-gray-900">{key.created.toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Last Used</p>
                          <p className="font-medium text-gray-900">{formatTimeAgo(key.lastUsed)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Requests</p>
                          <p className="font-medium text-gray-900">{key.requests.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Rate Limit</p>
                          <p className="font-medium text-gray-900">{key.rateLimit}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          setSelectedAPIKey(key);
                          setShowEditModal(true);
                        }}
                        className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                      >
                        <Edit className="w-4 h-4" />
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          setSelectedAPIKey(key);
                          setShowDeleteModal(true);
                        }}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>

                  {key.status === "inactive" && (
                    <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg text-sm">
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                      <span className="text-yellow-900">This key is currently inactive and cannot be used</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Webhooks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Webhooks</h2>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAddWebhookModal(true)}
              className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Webhook
            </motion.button>
          </div>

          <div className="space-y-4">
            {webhooks.map((webhook, index) => (
              <motion.div
                key={webhook.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.05 }}
                className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Webhook className="w-5 h-5 text-purple-500" />
                      <h3 className="font-bold text-gray-900">{webhook.name}</h3>
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${getStatusColor(webhook.status)}`}>
                        {webhook.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                      <Globe className="w-4 h-4" />
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">{webhook.url}</code>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {webhook.events.map(event => (
                        <span key={event} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg font-medium">
                          {event}
                        </span>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Success Rate</p>
                        <p className="font-medium text-gray-900">{webhook.successRate}%</p>
                      </div>
                      {webhook.lastTriggered && (
                        <div>
                          <p className="text-gray-600">Last Triggered</p>
                          <p className="font-medium text-gray-900">{formatTimeAgo(webhook.lastTriggered)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setSelectedWebhook(webhook);
                        setShowEditWebhookModal(true);
                      }}
                      className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                    >
                      <Edit className="w-4 h-4" />
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setSelectedWebhook(webhook);
                        setShowDeleteWebhookModal(true);
                      }}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Create Key Modal */}
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Create New API Key</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Key Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Mobile App Production"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Environment</label>
                  <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>Production</option>
                    <option>Development</option>
                    <option>Staging</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rate Limit</label>
                  <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>100 requests/hour</option>
                    <option>500 requests/hour</option>
                    <option>1000 requests/hour</option>
                    <option>5000 requests/hour</option>
                    <option>Unlimited</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Cancel
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium"
                >
                  Create Key
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Edit Key Modal */}
        {showEditModal && selectedAPIKey && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Edit API Key</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Key Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Mobile App Production"
                    defaultValue={selectedAPIKey.name}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Environment</label>
                  <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>Production</option>
                    <option>Development</option>
                    <option>Staging</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rate Limit</label>
                  <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>100 requests/hour</option>
                    <option>500 requests/hour</option>
                    <option>1000 requests/hour</option>
                    <option>5000 requests/hour</option>
                    <option>Unlimited</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Cancel
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium"
                >
                  Save Changes
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Delete Key Modal */}
        {showDeleteModal && selectedAPIKey && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Delete API Key</h3>
              
              <div className="space-y-4">
                <p className="text-gray-600">Are you sure you want to delete the API key <strong>{selectedAPIKey.name}</strong>?</p>
                <p className="text-gray-600">This action cannot be undone.</p>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Cancel
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium"
                >
                  Delete Key
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Add Webhook Modal */}
        {showAddWebhookModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddWebhookModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Add New Webhook</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Webhook Name</label>
                  <input
                    type="text"
                    placeholder="e.g., User Events"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">URL</label>
                  <input
                    type="text"
                    placeholder="https://api.example.com/webhooks/users"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Events</label>
                  <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>user.created</option>
                    <option>user.updated</option>
                    <option>user.deleted</option>
                    <option>session.started</option>
                    <option>session.completed</option>
                    <option>crisis.detected</option>
                    <option>crisis.escalated</option>
                    <option>payment.success</option>
                    <option>payment.failed</option>
                    <option>subscription.updated</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddWebhookModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Cancel
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddWebhookModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium"
                >
                  Add Webhook
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Edit Webhook Modal */}
        {showEditWebhookModal && selectedWebhook && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEditWebhookModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Edit Webhook</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Webhook Name</label>
                  <input
                    type="text"
                    placeholder="e.g., User Events"
                    defaultValue={selectedWebhook.name}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">URL</label>
                  <input
                    type="text"
                    placeholder="https://api.example.com/webhooks/users"
                    defaultValue={selectedWebhook.url}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Events</label>
                  <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>user.created</option>
                    <option>user.updated</option>
                    <option>user.deleted</option>
                    <option>session.started</option>
                    <option>session.completed</option>
                    <option>crisis.detected</option>
                    <option>crisis.escalated</option>
                    <option>payment.success</option>
                    <option>payment.failed</option>
                    <option>subscription.updated</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowEditWebhookModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Cancel
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowEditWebhookModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium"
                >
                  Save Changes
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Delete Webhook Modal */}
        {showDeleteWebhookModal && selectedWebhook && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteWebhookModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Delete Webhook</h3>
              
              <div className="space-y-4">
                <p className="text-gray-600">Are you sure you want to delete the webhook <strong>{selectedWebhook.name}</strong>?</p>
                <p className="text-gray-600">This action cannot be undone.</p>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDeleteWebhookModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Cancel
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDeleteWebhookModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium"
                >
                  Delete Webhook
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AdminLayoutNew>
  );
}