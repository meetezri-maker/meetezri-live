import { useState } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Plus,
  Flag,
  CheckCircle,
  Code,
  Globe,
  Users,
  XCircle,
  Edit,
  Trash2,
  Search,
} from "lucide-react";

interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  enabled: boolean;
  environment: "all" | "production" | "development" | "staging";
  rolloutPercentage: number;
  targetUsers?: string[];
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
  category: "feature" | "experiment" | "killswitch" | "config";
}

export function FeatureFlags() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterEnvironment, setFilterEnvironment] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);

  // Mock feature flags
  const [flags, setFlags] = useState<FeatureFlag[]>([
    {
      id: "ff1",
      name: "AI Voice Sessions",
      key: "ai_voice_sessions_enabled",
      description: "Enable voice-based AI therapy sessions with real-time speech recognition",
      enabled: true,
      environment: "production",
      rolloutPercentage: 100,
      createdBy: "Admin Sarah",
      createdAt: new Date("2024-01-15"),
      lastModified: new Date("2024-06-20"),
      category: "feature"
    },
    {
      id: "ff2",
      name: "Advanced Analytics Dashboard",
      key: "advanced_analytics_v2",
      description: "New analytics dashboard with enhanced visualizations and insights",
      enabled: true,
      environment: "production",
      rolloutPercentage: 75,
      createdBy: "Admin John",
      createdAt: new Date("2024-02-10"),
      lastModified: new Date("2024-06-25"),
      category: "feature"
    },
    {
      id: "ff3",
      name: "Group Therapy Sessions",
      key: "group_sessions_beta",
      description: "Beta feature for group therapy sessions with multiple participants",
      enabled: false,
      environment: "development",
      rolloutPercentage: 10,
      targetUsers: ["beta_testers"],
      createdBy: "Admin Mike",
      createdAt: new Date("2024-03-01"),
      lastModified: new Date("2024-06-15"),
      category: "experiment"
    },
    {
      id: "ff4",
      name: "Gamification System",
      key: "gamification_enabled",
      description: "Achievement badges, streaks, and rewards for wellness activities",
      enabled: true,
      environment: "production",
      rolloutPercentage: 100,
      createdBy: "Admin Sarah",
      createdAt: new Date("2024-01-20"),
      lastModified: new Date("2024-06-28"),
      category: "feature"
    },
    {
      id: "ff5",
      name: "Emergency Session Killswitch",
      key: "emergency_killswitch",
      description: "Ability to immediately disable all AI sessions in case of emergency",
      enabled: false,
      environment: "all",
      rolloutPercentage: 0,
      createdBy: "Admin John",
      createdAt: new Date("2024-02-01"),
      lastModified: new Date("2024-03-10"),
      category: "killswitch"
    },
    {
      id: "ff6",
      name: "Premium Features",
      key: "premium_tier_enabled",
      description: "Enable premium subscription features including extended sessions",
      enabled: true,
      environment: "production",
      rolloutPercentage: 100,
      createdBy: "Admin Sarah",
      createdAt: new Date("2024-01-10"),
      lastModified: new Date("2024-06-29"),
      category: "feature"
    },
    {
      id: "ff7",
      name: "Session Recording",
      key: "session_recording_consent",
      description: "Allow users to optionally record therapy sessions for playback",
      enabled: true,
      environment: "production",
      rolloutPercentage: 50,
      createdBy: "Admin Mike",
      createdAt: new Date("2024-03-15"),
      lastModified: new Date("2024-06-22"),
      category: "feature"
    },
    {
      id: "ff8",
      name: "Dark Mode",
      key: "dark_mode_theme",
      description: "Enable dark theme across the application",
      enabled: true,
      environment: "all",
      rolloutPercentage: 100,
      createdBy: "Admin Sarah",
      createdAt: new Date("2024-02-05"),
      lastModified: new Date("2024-06-18"),
      category: "config"
    },
    {
      id: "ff9",
      name: "Multi-language Support",
      key: "i18n_enabled",
      description: "Support for Spanish, French, and German languages",
      enabled: false,
      environment: "staging",
      rolloutPercentage: 20,
      targetUsers: ["translators", "beta_testers"],
      createdBy: "Admin John",
      createdAt: new Date("2024-04-01"),
      lastModified: new Date("2024-06-26"),
      category: "experiment"
    },
    {
      id: "ff10",
      name: "Biometric Authentication",
      key: "biometric_auth_enabled",
      description: "Enable fingerprint and face ID login",
      enabled: true,
      environment: "production",
      rolloutPercentage: 90,
      createdBy: "Admin Mike",
      createdAt: new Date("2024-03-20"),
      lastModified: new Date("2024-06-24"),
      category: "feature"
    }
  ]);

  const filteredFlags = flags.filter(flag => {
    const matchesSearch = 
      flag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      flag.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      flag.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || flag.category === filterCategory;
    const matchesEnvironment = filterEnvironment === "all" || flag.environment === filterEnvironment || flag.environment === "all";
    return matchesSearch && matchesCategory && matchesEnvironment;
  });

  const toggleFlag = (flagId: string) => {
    setFlags(flags.map(flag => 
      flag.id === flagId ? { ...flag, enabled: !flag.enabled, lastModified: new Date() } : flag
    ));
  };

  const getCategoryColor = (category: string) => {
    switch(category) {
      case "feature": return "bg-blue-100 text-blue-700";
      case "experiment": return "bg-purple-100 text-purple-700";
      case "killswitch": return "bg-red-100 text-red-700";
      case "config": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getEnvironmentColor = (env: string) => {
    switch(env) {
      case "production": return "bg-red-100 text-red-700";
      case "development": return "bg-blue-100 text-blue-700";
      case "staging": return "bg-yellow-100 text-yellow-700";
      case "all": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const stats = {
    total: flags.length,
    enabled: flags.filter(f => f.enabled).length,
    experiments: flags.filter(f => f.category === "experiment").length,
    production: flags.filter(f => f.environment === "production").length
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
            <h1 className="text-3xl font-bold text-gray-900">Feature Flags</h1>
            <p className="text-gray-600 mt-1">Manage feature toggles and experiments</p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Create Flag
          </motion.button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <Flag className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total Flags</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Enabled</p>
                <p className="text-2xl font-bold text-gray-900">{stats.enabled}</p>
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
                <Code className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Experiments</p>
                <p className="text-2xl font-bold text-gray-900">{stats.experiments}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-rose-600">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Production</p>
                <p className="text-2xl font-bold text-gray-900">{stats.production}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search flags by name, key, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex gap-3">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">All Categories</option>
                <option value="feature">Features</option>
                <option value="experiment">Experiments</option>
                <option value="killswitch">Killswitches</option>
                <option value="config">Config</option>
              </select>

              <select
                value={filterEnvironment}
                onChange={(e) => setFilterEnvironment(e.target.value)}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">All Environments</option>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Feature Flags List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Feature Flags ({filteredFlags.length})</h2>

          <div className="space-y-4">
            {filteredFlags.map((flag, index) => (
              <motion.div
                key={flag.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.03 }}
                className={`border-2 rounded-xl p-5 transition-all ${
                  flag.enabled 
                    ? "border-green-200 bg-green-50/50" 
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-gray-900 text-lg">{flag.name}</h3>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getCategoryColor(flag.category)}`}>
                        {flag.category}
                      </span>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getEnvironmentColor(flag.environment)}`}>
                        {flag.environment}
                      </span>
                    </div>

                    <code className="text-sm bg-gray-800 text-green-400 px-3 py-1 rounded-lg font-mono inline-block mb-3">
                      {flag.key}
                    </code>

                    <p className="text-gray-700 mb-4">{flag.description}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Rollout</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${flag.rolloutPercentage}%` }}
                              transition={{ duration: 1 }}
                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                            />
                          </div>
                          <span className="font-bold text-gray-900">{flag.rolloutPercentage}%</span>
                        </div>
                      </div>

                      <div>
                        <p className="text-gray-600">Created By</p>
                        <p className="font-medium text-gray-900">{flag.createdBy}</p>
                      </div>

                      <div>
                        <p className="text-gray-600">Created</p>
                        <p className="font-medium text-gray-900">{flag.createdAt.toLocaleDateString()}</p>
                      </div>

                      <div>
                        <p className="text-gray-600">Last Modified</p>
                        <p className="font-medium text-gray-900">{flag.lastModified.toLocaleDateString()}</p>
                      </div>
                    </div>

                    {flag.targetUsers && (
                      <div className="mt-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-600" />
                        <span className="text-sm text-gray-700">
                          Target Users: {flag.targetUsers.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    {/* Toggle Switch */}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleFlag(flag.id)}
                      className={`relative w-16 h-8 rounded-full transition-colors ${
                        flag.enabled ? "bg-green-500" : "bg-gray-300"
                      }`}
                    >
                      <motion.div
                        animate={{ x: flag.enabled ? 32 : 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center"
                      >
                        {flag.enabled ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-400" />
                        )}
                      </motion.div>
                    </motion.button>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          setSelectedFlag(flag);
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
                          setSelectedFlag(flag);
                          setShowDeleteModal(true);
                        }}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredFlags.length === 0 && (
            <div className="text-center py-12">
              <Flag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No feature flags match your filters</p>
            </div>
          )}
        </motion.div>

        {/* Create Modal */}
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
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Create Feature Flag</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Flag Name</label>
                  <input
                    type="text"
                    placeholder="e.g., AI Voice Sessions"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Flag Key</label>
                  <input
                    type="text"
                    placeholder="e.g., ai_voice_sessions_enabled"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Describe what this feature flag controls..."
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                      <option>Feature</option>
                      <option>Experiment</option>
                      <option>Killswitch</option>
                      <option>Config</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Environment</label>
                    <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                      <option>Production</option>
                      <option>Staging</option>
                      <option>Development</option>
                      <option>All</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rollout Percentage</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    defaultValue="0"
                    className="w-full"
                  />
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
                  Create Flag
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Edit Modal */}
        {showEditModal && selectedFlag && (
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
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Edit Feature Flag</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Flag Name</label>
                  <input
                    type="text"
                    placeholder="e.g., AI Voice Sessions"
                    value={selectedFlag.name}
                    onChange={(e) => {
                      const updatedFlag = { ...selectedFlag, name: e.target.value };
                      setSelectedFlag(updatedFlag);
                    }}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Flag Key</label>
                  <input
                    type="text"
                    placeholder="e.g., ai_voice_sessions_enabled"
                    value={selectedFlag.key}
                    onChange={(e) => {
                      const updatedFlag = { ...selectedFlag, key: e.target.value };
                      setSelectedFlag(updatedFlag);
                    }}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Describe what this feature flag controls..."
                    value={selectedFlag.description}
                    onChange={(e) => {
                      const updatedFlag = { ...selectedFlag, description: e.target.value };
                      setSelectedFlag(updatedFlag);
                    }}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                      value={selectedFlag.category}
                      onChange={(e) => {
                        const updatedFlag = { ...selectedFlag, category: e.target.value as "feature" | "experiment" | "killswitch" | "config" };
                        setSelectedFlag(updatedFlag);
                      }}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option>Feature</option>
                      <option>Experiment</option>
                      <option>Killswitch</option>
                      <option>Config</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Environment</label>
                    <select
                      value={selectedFlag.environment}
                      onChange={(e) => {
                        const updatedFlag = { ...selectedFlag, environment: e.target.value as "all" | "production" | "development" | "staging" };
                        setSelectedFlag(updatedFlag);
                      }}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option>Production</option>
                      <option>Staging</option>
                      <option>Development</option>
                      <option>All</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rollout Percentage</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={selectedFlag.rolloutPercentage}
                    onChange={(e) => {
                      const updatedFlag = { ...selectedFlag, rolloutPercentage: parseInt(e.target.value) };
                      setSelectedFlag(updatedFlag);
                    }}
                    className="w-full"
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
                  onClick={() => {
                    if (selectedFlag) {
                      setFlags(flags.map(flag => flag.id === selectedFlag.id ? selectedFlag : flag));
                      setShowEditModal(false);
                    }
                  }}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium"
                >
                  Save Changes
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Delete Modal */}
        {showDeleteModal && selectedFlag && (
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
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Delete Feature Flag</h3>

              <div className="space-y-4">
                <p className="text-gray-700">Are you sure you want to delete the feature flag <strong>{selectedFlag.name}</strong>?</p>
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
                  onClick={() => {
                    if (selectedFlag) {
                      setFlags(flags.filter(flag => flag.id !== selectedFlag.id));
                      setShowDeleteModal(false);
                    }
                  }}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium"
                >
                  Delete Flag
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AdminLayoutNew>
  );
}