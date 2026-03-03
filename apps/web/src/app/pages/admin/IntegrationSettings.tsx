import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Plug,
  Key,
  Globe,
  Zap,
  Mail,
  MessageSquare,
  CreditCard,
  BarChart,
  Cloud,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Copy,
  Activity,
} from "lucide-react";
import { useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

interface Integration {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: any;
  color: string;
  enabled: boolean;
  configured: boolean;
  status: "active" | "inactive" | "error";
  lastSync?: string;
  apiKey?: string;
  webhooks?: number;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  status: "active" | "inactive" | "error";
  lastTriggered: string;
  totalCalls: number;
}

export function IntegrationSettings() {
  const [showApiKeys, setShowApiKeys] = useState<{ [key: string]: boolean }>({});
  const [showAddIntegrationModal, setShowAddIntegrationModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddWebhookModal, setShowAddWebhookModal] = useState(false);
  const [showEditWebhookModal, setShowEditWebhookModal] = useState(false);
  const [showDeleteWebhookModal, setShowDeleteWebhookModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);

  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: "stripe",
      name: "Stripe",
      category: "Payment",
      description: "Payment processing and subscriptions",
      icon: CreditCard,
      color: "from-blue-500 to-indigo-600",
      enabled: true,
      configured: true,
      status: "active",
      lastSync: "2 minutes ago",
      apiKey: "sk_live_51H***********************************",
      webhooks: 3,
    },
    {
      id: "sendgrid",
      name: "SendGrid",
      category: "Email",
      description: "Transactional email delivery",
      icon: Mail,
      color: "from-cyan-500 to-blue-600",
      enabled: true,
      configured: true,
      status: "active",
      lastSync: "5 minutes ago",
      apiKey: "SG.***********************************",
      webhooks: 2,
    },
    {
      id: "twilio",
      name: "Twilio",
      category: "SMS",
      description: "SMS notifications and 2FA",
      icon: MessageSquare,
      color: "from-red-500 to-pink-600",
      enabled: true,
      configured: true,
      status: "active",
      lastSync: "10 minutes ago",
      apiKey: "AC***********************************",
      webhooks: 1,
    },
    {
      id: "google-analytics",
      name: "Google Analytics",
      category: "Analytics",
      description: "Web analytics and tracking",
      icon: BarChart,
      color: "from-orange-500 to-amber-600",
      enabled: true,
      configured: true,
      status: "active",
      lastSync: "1 hour ago",
      apiKey: "G-***********",
    },
    {
      id: "aws-s3",
      name: "AWS S3",
      category: "Storage",
      description: "File storage and CDN",
      icon: Cloud,
      color: "from-yellow-500 to-orange-600",
      enabled: true,
      configured: true,
      status: "active",
      lastSync: "30 minutes ago",
      apiKey: "AKIA***********************************",
    },
    {
      id: "slack",
      name: "Slack",
      category: "Communication",
      description: "Team notifications and alerts",
      icon: Zap,
      color: "from-purple-500 to-pink-600",
      enabled: false,
      configured: false,
      status: "inactive",
    },
    {
      id: "zapier",
      name: "Zapier",
      category: "Automation",
      description: "Workflow automation",
      icon: Plug,
      color: "from-orange-500 to-red-600",
      enabled: false,
      configured: false,
      status: "inactive",
    },
  ]);

  const [webhooks, setWebhooks] = useState<Webhook[]>([
    {
      id: "1",
      url: "https://api.stripe.com/v1/webhooks/stripe_payment",
      events: ["payment.succeeded", "payment.failed", "subscription.updated"],
      status: "active",
      lastTriggered: "5 minutes ago",
      totalCalls: 12458,
    },
    {
      id: "2",
      url: "https://hooks.sendgrid.com/email_delivered",
      events: ["email.delivered", "email.bounced", "email.opened"],
      status: "active",
      lastTriggered: "10 minutes ago",
      totalCalls: 34521,
    },
    {
      id: "3",
      url: "https://api.twilio.com/sms_webhook",
      events: ["sms.sent", "sms.delivered", "sms.failed"],
      status: "active",
      lastTriggered: "15 minutes ago",
      totalCalls: 8934,
    },
    {
      id: "4",
      url: "https://slack.com/api/crisis_alert",
      events: ["crisis.detected"],
      status: "error",
      lastTriggered: "2 days ago",
      totalCalls: 234,
    },
  ]);

  const oauthProviders = [
    {
      id: "google",
      name: "Google",
      enabled: true,
      users: 856,
      color: "from-blue-500 to-cyan-600",
    },
    {
      id: "facebook",
      name: "Facebook",
      enabled: true,
      users: 423,
      color: "from-blue-600 to-indigo-700",
    },
    {
      id: "apple",
      name: "Apple",
      enabled: true,
      users: 234,
      color: "from-gray-700 to-gray-900",
    },
    {
      id: "microsoft",
      name: "Microsoft",
      enabled: false,
      users: 0,
      color: "from-cyan-500 to-blue-600",
    },
  ];

  const stats = [
    {
      label: "Active Integrations",
      value: integrations.filter((i) => i.enabled).length.toString(),
      icon: CheckCircle2,
      color: "from-green-500 to-emerald-600",
    },
    {
      label: "Total Webhooks",
      value: webhooks.length.toString(),
      icon: Zap,
      color: "from-purple-500 to-pink-600",
    },
    {
      label: "API Calls Today",
      value: "56.2K",
      icon: Activity,
      color: "from-blue-500 to-cyan-600",
    },
    {
      label: "OAuth Users",
      value: oauthProviders
        .reduce((sum, p) => sum + p.users, 0)
        .toLocaleString(),
      icon: Key,
      color: "from-orange-500 to-amber-600",
    },
  ];

  const toggleIntegration = (id: string) => {
    setIntegrations(
      integrations.map((int) =>
        int.id === id ? { ...int, enabled: !int.enabled } : int
      )
    );
  };

  const toggleApiKeyVisibility = (id: string) => {
    setShowApiKeys({ ...showApiKeys, [id]: !showApiKeys[id] });
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
              Integration Settings
            </h1>
            <p className="text-gray-600">
              Third-party APIs, webhooks, and OAuth providers
            </p>
          </div>

          <Button 
            onClick={() => setShowAddIntegrationModal(true)}
            className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Integration
          </Button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-white border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}
                  >
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Integrations Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">API Integrations</h2>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>Active</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full" />
                <span>Inactive</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span>Error</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {integrations.map((integration, index) => (
              <motion.div
                key={integration.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
              >
                <Card className="bg-white border border-gray-200 p-6 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${integration.color} flex items-center justify-center`}
                      >
                        <integration.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {integration.name}
                        </h3>
                        <p className="text-xs text-gray-600">
                          {integration.category}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleIntegration(integration.id)}
                      className={`relative w-14 h-8 rounded-full transition-all ${
                        integration.enabled
                          ? "bg-gradient-to-r from-green-500 to-emerald-600"
                          : "bg-gray-300"
                      }`}
                    >
                      <motion.div
                        className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
                        animate={{ left: integration.enabled ? 30 : 4 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>

                  <p className="text-sm text-gray-700 mb-4">
                    {integration.description}
                  </p>

                  {integration.configured && (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            integration.status === "active"
                              ? "bg-green-100 text-green-700"
                              : integration.status === "error"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {integration.status}
                        </span>
                        {integration.lastSync && (
                          <span className="text-xs text-gray-600">
                            Last sync: {integration.lastSync}
                          </span>
                        )}
                      </div>

                      {integration.apiKey && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-600">API Key</span>
                            <button
                              onClick={() => toggleApiKeyVisibility(integration.id)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              {showApiKeys[integration.id] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs text-gray-900 font-mono truncate">
                              {showApiKeys[integration.id]
                                ? integration.apiKey
                                : "••••••••••••••••••••••••••••••••"}
                            </code>
                            <Button size="sm" variant="ghost">
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {integration.webhooks && integration.webhooks > 0 && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                          <Zap className="w-4 h-4" />
                          <span>{integration.webhooks} webhooks configured</span>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                    {integration.configured ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedIntegration(integration);
                            setShowEditModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Test
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedIntegration(integration);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Configure
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Webhooks & OAuth Providers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Webhooks */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-white border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Webhooks</h3>
                    <p className="text-sm text-gray-600">Event-driven endpoints</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowAddWebhookModal(true)}
                  className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {webhooks.map((webhook) => (
                  <div
                    key={webhook.id}
                    className="p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <code className="text-xs text-gray-900 font-mono truncate block">
                          {webhook.url}
                        </code>
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              webhook.status === "active"
                                ? "bg-green-100 text-green-700"
                                : webhook.status === "error"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {webhook.status}
                          </span>
                          <span className="text-xs text-gray-600">
                            {webhook.totalCalls.toLocaleString()} calls
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => {
                            setSelectedWebhook(webhook);
                            setShowEditWebhookModal(true);
                          }}
                          className="text-blue-600 hover:bg-blue-50"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => {
                            setSelectedWebhook(webhook);
                            setShowDeleteWebhookModal(true);
                          }}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                      {webhook.events.map((event) => (
                        <span
                          key={event}
                          className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs"
                        >
                          {event}
                        </span>
                      ))}
                    </div>

                    <p className="text-xs text-gray-600">
                      Last triggered: {webhook.lastTriggered}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* OAuth Providers */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-white border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                  <Key className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">OAuth Providers</h3>
                  <p className="text-sm text-gray-600">Social login configuration</p>
                </div>
              </div>

              <div className="space-y-4">
                {oauthProviders.map((provider) => (
                  <div
                    key={provider.id}
                    className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${provider.color} flex items-center justify-center`}
                      >
                        <Globe className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="text-gray-900 font-medium">{provider.name}</h4>
                        <p className="text-xs text-gray-600">
                          {provider.users.toLocaleString()} users
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {provider.enabled && (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          Enabled
                        </span>
                      )}
                      <button
                        className={`relative w-14 h-8 rounded-full transition-all ${
                          provider.enabled
                            ? "bg-gradient-to-r from-green-500 to-emerald-600"
                            : "bg-gray-300"
                        }`}
                      >
                        <motion.div
                          className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
                          animate={{ left: provider.enabled ? 30 : 4 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <Globe className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-900 font-medium mb-1">
                      OAuth Configuration
                    </p>
                    <p className="text-xs text-gray-600">
                      Configure redirect URLs and client secrets for each provider in
                      their respective settings panels.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Add Integration Modal */}
        {showAddIntegrationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddIntegrationModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Add Integration</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Integration Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Stripe, SendGrid"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none">
                    <option>Payment</option>
                    <option>Email</option>
                    <option>SMS</option>
                    <option>Analytics</option>
                    <option>Storage</option>
                    <option>Communication</option>
                    <option>Automation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                  <input
                    type="password"
                    placeholder="Enter API key"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddIntegrationModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Cancel
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddIntegrationModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-medium"
                >
                  Add Integration
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Edit Integration Modal */}
        {showEditModal && selectedIntegration && (
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
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Edit Integration</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Integration Name</label>
                  <input
                    type="text"
                    defaultValue={selectedIntegration.name}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none">
                    <option>{selectedIntegration.category}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                  <input
                    type="password"
                    defaultValue={selectedIntegration.apiKey}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
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

        {/* Delete Integration Modal */}
        {showDeleteModal && selectedIntegration && (
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
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Delete Integration</h3>
              
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete the <strong>{selectedIntegration.name}</strong> integration? This action cannot be undone.
              </p>

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
                  Delete
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
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Add Webhook</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Webhook URL</label>
                  <input
                    type="text"
                    placeholder="https://api.example.com/webhook"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Events</label>
                  <textarea
                    placeholder="e.g., payment.succeeded, user.created"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none"
                    rows={3}
                  />
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
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-medium"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Webhook URL</label>
                  <input
                    type="text"
                    defaultValue={selectedWebhook.url}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Events</label>
                  <textarea
                    defaultValue={selectedWebhook.events.join(", ")}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 outline-none"
                    rows={3}
                  />
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
              
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete the webhook <code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{selectedWebhook.url}</code>? This action cannot be undone.
              </p>

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
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AdminLayoutNew>
  );
}
