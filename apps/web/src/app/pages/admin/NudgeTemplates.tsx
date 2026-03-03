import { motion, AnimatePresence } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Copy,
  Eye,
  Filter,
  Bell,
  MessageSquare,
  Heart,
  Calendar,
  Target,
  Zap,
  Clock,
  CheckCircle2,
  Star,
  TrendingUp,
  X,
  Save,
  BarChart3,
  Send,
  AlertCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

interface NudgeTemplate {
  id: string;
  name: string;
  category: string;
  type: "push" | "email" | "in-app" | "sms";
  title: string;
  message: string;
  variables: string[];
  icon: any;
  iconColor: string;
  usage: number;
  rating: number;
  status: "active" | "draft" | "archived";
  createdBy: string;
  lastUsed: string;
}

export function NudgeTemplates() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  
  // Modal states
  const [viewModalTemplate, setViewModalTemplate] = useState<NudgeTemplate | null>(null);
  const [editModalTemplate, setEditModalTemplate] = useState<NudgeTemplate | null>(null);
  const [deleteModalTemplate, setDeleteModalTemplate] = useState<NudgeTemplate | null>(null);
  const [analyticsModalTemplate, setAnalyticsModalTemplate] = useState<NudgeTemplate | null>(null);
  const [templates, setTemplates] = useState<NudgeTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const mapApiTemplate = (t: any): NudgeTemplate => {
    const baseIcon = (() => {
      if (t.name?.includes("Mood") || t.category === "Engagement") return Heart;
      if (t.name?.includes("Breath") || t.category === "Wellness") return Zap;
      if (t.name?.includes("Sleep")) return Clock;
      if (t.name?.includes("Session") || t.name?.includes("Reminder")) return Calendar;
      if (t.category === "Progress") return TrendingUp;
      if (t.category === "Achievement") return Star;
      if (t.category === "Retention") return MessageSquare;
      return Bell;
    })();

    const iconColor =
      t.iconColor ||
      (t.category === "Engagement"
        ? "#ec4899"
        : t.category === "Wellness"
        ? "#10b981"
        : t.category === "Progress"
        ? "#3b82f6"
        : t.category === "Achievement"
        ? "#f59e0b"
        : t.category === "Retention"
        ? "#06b6d4"
        : "#6366f1");

    const createdAt = t.created_at ? new Date(t.created_at) : null;
    const lastUsed =
      t.last_used != null
        ? new Date(t.last_used).toLocaleString()
        : "Never";

    return {
      id: t.id,
      name: t.name,
      category: t.category,
      type: t.type as NudgeTemplate["type"],
      title: t.title,
      message: t.message,
      variables: Array.isArray(t.variables) ? t.variables : [],
      icon: baseIcon,
      iconColor,
      usage: typeof t.usage === "number" ? t.usage : 0,
      rating:
        typeof t.rating === "number"
          ? t.rating
          : typeof t.rating === "string"
          ? parseFloat(t.rating)
          : 0,
      status: (t.status as NudgeTemplate["status"]) || "active",
      createdBy: t.profiles?.full_name || "System",
      lastUsed,
    };
  };

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setIsLoading(true);
        const data = await api.admin.getNudgeTemplates();
        const mapped: NudgeTemplate[] = Array.isArray(data)
          ? data.map((t: any) => mapApiTemplate(t))
          : [];
        setTemplates(mapped);
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplates();
  }, []);

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || template.category === selectedCategory;
    const matchesType = selectedType === "all" || template.type === selectedType;
    const matchesStatus =
      selectedStatus === "all" || template.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesType && matchesStatus;
  });

  const stats = [
    {
      label: "Total Templates",
      value: templates.length.toString(),
      color: "from-purple-500 to-pink-600",
      icon: Bell,
    },
    {
      label: "Active Templates",
      value: templates.filter((t) => t.status === "active").length.toString(),
      color: "from-green-500 to-emerald-600",
      icon: CheckCircle2,
    },
    {
      label: "Total Usage",
      value:
        templates.length === 0
          ? "0"
          : templates.reduce((sum, t) => sum + t.usage, 0).toLocaleString(),
      color: "from-blue-500 to-cyan-600",
      icon: TrendingUp,
    },
    {
      label: "Avg Rating",
      value:
        templates.length === 0
          ? "0.0"
          : (
              templates.reduce((sum, t) => sum + t.rating, 0) / templates.length
            ).toFixed(1),
      color: "from-orange-500 to-amber-600",
      icon: Star,
    },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "push":
        return "📱";
      case "email":
        return "📧";
      case "in-app":
        return "💬";
      case "sms":
        return "💬";
      default:
        return "📢";
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
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Nudge Templates</h1>
            <p className="text-gray-600">
              Pre-built notification templates with personalization
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <Filter className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Button
              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
              onClick={() => {
                const base = {
                  name: "New Template",
                  category: "Engagement",
                  type: "push" as const,
                  title: "New nudge title",
                  message: "Write your message here...",
                  variables: [] as string[],
                  status: "draft",
                };
                api.admin
                  .createNudgeTemplate(base)
                  .then((created: any) => {
                    setTemplates((prev) => [mapApiTemplate(created), ...prev]);
                  });
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </div>
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
                      <p className="text-3xl font-bold text-gray-900">
                        {isLoading && stat.label === "Total Templates" ? "..." : stat.value}
                      </p>
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

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white border border-gray-200 p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Categories</option>
                <option value="Engagement">Engagement</option>
                <option value="Wellness">Wellness</option>
                <option value="Progress">Progress</option>
                <option value="Achievement">Achievement</option>
                <option value="Retention">Retention</option>
              </select>

              {/* Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Types</option>
                <option value="push">Push Notification</option>
                <option value="email">Email</option>
                <option value="in-app">In-App</option>
                <option value="sms">SMS</option>
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </Card>
        </motion.div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredTemplates.map((template, index) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-white border border-gray-200 p-6 hover:shadow-lg transition-all">
                {/* Header */}
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${template.iconColor}20` }}
                  >
                    <template.icon
                      className="w-6 h-6"
                      style={{ color: template.iconColor }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold text-gray-900">
                        {template.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getTypeIcon(template.type)}</span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap border ${
                            template.status === "active"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : template.status === "draft"
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : "bg-gray-50 text-gray-700 border-gray-200"
                          }`}
                        >
                          {template.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{template.category}</p>
                  </div>
                </div>

                {/* Template Preview */}
                <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                  <p className="text-sm font-semibold text-gray-900 mb-2">
                    {template.title}
                  </p>
                  <p className="text-sm text-gray-700">{template.message}</p>
                </div>

                {/* Variables */}
                {template.variables.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-600 mb-2">Variables:</p>
                    <div className="flex flex-wrap gap-2">
                      {template.variables.map((variable) => (
                        <span
                          key={variable}
                          className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded text-xs font-mono"
                        >
                          {`{{${variable}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <p className="text-xs text-gray-600">Usage</p>
                    <p className="text-sm text-gray-900 font-medium">
                      {template.usage.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Rating</p>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                      <p className="text-sm text-gray-900 font-medium">
                        {template.rating}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Last Used</p>
                    <p className="text-sm text-gray-900 font-medium">
                      {template.lastUsed}
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <span className="text-xs text-gray-600">
                    by {template.createdBy}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-gray-600 hover:text-gray-900"
                      onClick={() => setViewModalTemplate(template)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-gray-600 hover:text-gray-900"
                      onClick={() => {
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(template.message);
                        }
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-gray-600 hover:text-gray-900"
                      onClick={() => setAnalyticsModalTemplate(template)}
                    >
                      <BarChart3 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-blue-600 hover:text-blue-700"
                      onClick={() => setEditModalTemplate(template)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setDeleteModalTemplate(template)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {filteredTemplates.length === 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Card className="bg-white border border-gray-200 p-12">
              <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                No templates found
              </h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your filters or create a new template
              </p>
              <Button className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            </Card>
          </motion.div>
        )}

        {/* View Modal */}
        <AnimatePresence>
          {viewModalTemplate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setViewModalTemplate(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${viewModalTemplate.iconColor}20` }}
                    >
                      <viewModalTemplate.icon
                        className="w-6 h-6"
                        style={{ color: viewModalTemplate.iconColor }}
                      />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">View Template</h2>
                      <span
                        className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium border ${
                          viewModalTemplate.status === "active"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : viewModalTemplate.status === "draft"
                            ? "bg-orange-50 text-orange-700 border-orange-200"
                            : "bg-gray-50 text-gray-700 border-gray-200"
                        }`}
                      >
                        {viewModalTemplate.status}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setViewModalTemplate(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Template Name</label>
                    <p className="text-lg font-semibold text-gray-900">{viewModalTemplate.name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">Category</label>
                      <p className="font-medium text-gray-900">{viewModalTemplate.category}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">Type</label>
                      <p className="font-medium text-gray-900">{getTypeIcon(viewModalTemplate.type)} {viewModalTemplate.type}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Title</label>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="font-semibold text-gray-900">{viewModalTemplate.title}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Message</label>
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-gray-900">{viewModalTemplate.message}</p>
                    </div>
                  </div>

                  {viewModalTemplate.variables.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">Variables</label>
                      <div className="flex flex-wrap gap-2">
                        {viewModalTemplate.variables.map((variable) => (
                          <span
                            key={variable}
                            className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-mono"
                          >
                            {`{{${variable}}}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-600 mb-3">Performance</label>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-2xl font-bold text-blue-600">{viewModalTemplate.usage.toLocaleString()}</p>
                        <p className="text-xs text-gray-600">Usage</p>
                      </div>
                      <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <p className="text-2xl font-bold text-yellow-600">{viewModalTemplate.rating}</p>
                        <p className="text-xs text-gray-600">Rating</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm font-bold text-gray-900">{viewModalTemplate.lastUsed}</p>
                        <p className="text-xs text-gray-600">Last Used</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-600">Created by <span className="font-medium text-gray-900">{viewModalTemplate.createdBy}</span></p>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setViewModalTemplate(null)}>
                      Close
                    </Button>
                    <Button className="flex-1" onClick={() => {
                      setEditModalTemplate(viewModalTemplate);
                      setViewModalTemplate(null);
                    }}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Template
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Modal */}
        <AnimatePresence>
          {editModalTemplate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setEditModalTemplate(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Edit Template</h2>
                  <Button variant="ghost" size="sm" onClick={() => setEditModalTemplate(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">Template Name</label>
                            <Input
                              defaultValue={editModalTemplate.name}
                              onChange={(e) =>
                                setEditModalTemplate({ ...editModalTemplate, name: e.target.value })
                              }
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium mb-2">Category</label>
                              <select
                                className="w-full px-3 py-2 border rounded-lg"
                                defaultValue={editModalTemplate.category}
                                onChange={(e) =>
                                  setEditModalTemplate({
                                    ...editModalTemplate,
                                    category: e.target.value,
                                  })
                                }
                              >
                                <option value="Engagement">Engagement</option>
                                <option value="Wellness">Wellness</option>
                                <option value="Progress">Progress</option>
                                <option value="Achievement">Achievement</option>
                                <option value="Retention">Retention</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Type</label>
                              <select
                                className="w-full px-3 py-2 border rounded-lg"
                                defaultValue={editModalTemplate.type}
                                onChange={(e) =>
                                  setEditModalTemplate({
                                    ...editModalTemplate,
                                    type: e.target.value as NudgeTemplate["type"],
                                  })
                                }
                              >
                                <option value="push">Push Notification</option>
                                <option value="email">Email</option>
                                <option value="in-app">In-App</option>
                                <option value="sms">SMS</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">Title</label>
                            <Input
                              defaultValue={editModalTemplate.title}
                              onChange={(e) =>
                                setEditModalTemplate({
                                  ...editModalTemplate,
                                  title: e.target.value,
                                })
                              }
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">Message</label>
                            <textarea
                              className="w-full p-3 border rounded-lg"
                              rows={4}
                              defaultValue={editModalTemplate.message}
                              onChange={(e) =>
                                setEditModalTemplate({
                                  ...editModalTemplate,
                                  message: e.target.value,
                                })
                              }
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Variables (comma separated)
                            </label>
                            <Input
                              defaultValue={editModalTemplate.variables.join(", ")}
                              placeholder="name, sessions, etc."
                              onChange={(e) =>
                                setEditModalTemplate({
                                  ...editModalTemplate,
                                  variables: e.target.value
                                    .split(",")
                                    .map((v) => v.trim())
                                    .filter(Boolean),
                                })
                              }
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">Status</label>
                            <select
                              className="w-full px-3 py-2 border rounded-lg"
                              defaultValue={editModalTemplate.status}
                              onChange={(e) =>
                                setEditModalTemplate({
                                  ...editModalTemplate,
                                  status: e.target.value as NudgeTemplate["status"],
                                })
                              }
                            >
                              <option value="active">Active</option>
                              <option value="draft">Draft</option>
                              <option value="archived">Archived</option>
                            </select>
                          </div>

                          <div className="flex gap-2 pt-4">
                            <Button
                              variant="outline"
                              className="flex-1"
                              onClick={() => setEditModalTemplate(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              className="flex-1"
                              onClick={async () => {
                                if (!editModalTemplate) return;
                                const payload = {
                                  name: editModalTemplate.name,
                                  category: editModalTemplate.category,
                                  type: editModalTemplate.type,
                                  title: editModalTemplate.title,
                                  message: editModalTemplate.message,
                                  variables: editModalTemplate.variables,
                                  status: editModalTemplate.status,
                                };
                                const updated = await api.admin.updateNudgeTemplate(
                                  editModalTemplate.id,
                                  payload
                                );
                                setTemplates((prev) =>
                                  prev.map((t) =>
                                    t.id === editModalTemplate.id
                                      ? mapApiTemplate({ ...updated })
                                      : t
                                  )
                                );
                                setEditModalTemplate(null);
                              }}
                            >
                              <Save className="w-4 h-4 mr-2" />
                              Save Changes
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

        {/* Analytics Modal */}
        <AnimatePresence>
          {analyticsModalTemplate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setAnalyticsModalTemplate(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Template Analytics: {analyticsModalTemplate.name}</h2>
                  <Button variant="ghost" size="sm" onClick={() => setAnalyticsModalTemplate(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <Send className="w-5 h-5 text-blue-600" />
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                      </div>
                      <p className="text-3xl font-bold text-blue-600">{analyticsModalTemplate.usage.toLocaleString()}</p>
                      <p className="text-sm text-gray-600">Total Usage</p>
                    </div>

                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="flex items-center justify-between mb-2">
                        <Star className="w-5 h-5 text-yellow-600" />
                        <TrendingUp className="w-4 h-4 text-yellow-600" />
                      </div>
                      <p className="text-3xl font-bold text-yellow-600">{analyticsModalTemplate.rating}</p>
                      <p className="text-sm text-gray-600">Avg Rating</p>
                    </div>

                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center justify-between mb-2">
                        <Target className="w-5 h-5 text-purple-600" />
                        <CheckCircle2 className="w-4 h-4 text-purple-600" />
                      </div>
                      <p className="text-3xl font-bold text-purple-600">{analyticsModalTemplate.status}</p>
                      <p className="text-sm text-gray-600">Status</p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="border-t pt-4">
                    <h3 className="font-bold text-lg mb-3">Template Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-600 mb-1">Category</p>
                        <p className="font-medium text-gray-900">{analyticsModalTemplate.category}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-600 mb-1">Type</p>
                        <p className="font-medium text-gray-900">{getTypeIcon(analyticsModalTemplate.type)} {analyticsModalTemplate.type}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-600 mb-1">Created By</p>
                        <p className="font-medium text-gray-900">{analyticsModalTemplate.createdBy}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-600 mb-1">Last Used</p>
                        <p className="font-medium text-gray-900">{analyticsModalTemplate.lastUsed}</p>
                      </div>
                    </div>
                  </div>

                  {/* Variables */}
                  {analyticsModalTemplate.variables.length > 0 && (
                    <div className="border-t pt-4">
                      <h3 className="font-bold text-lg mb-3">Variables Used</h3>
                      <div className="flex flex-wrap gap-2">
                        {analyticsModalTemplate.variables.map((variable) => (
                          <span
                            key={variable}
                            className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-mono"
                          >
                            {`{{${variable}}}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setAnalyticsModalTemplate(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Modal */}
        <AnimatePresence>
          {deleteModalTemplate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setDeleteModalTemplate(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-md w-full"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-red-600">Delete Template</h2>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteModalTemplate(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900 mb-1">Are you sure you want to delete this template?</p>
                        <p className="text-sm text-gray-600">
                          This action cannot be undone. The template "{deleteModalTemplate.name}" will be permanently deleted.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">Template Performance:</p>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div>
                        <p className="font-bold text-gray-900">{deleteModalTemplate.usage.toLocaleString()}</p>
                        <p className="text-xs text-gray-600">Total Usage</p>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{deleteModalTemplate.rating}</p>
                        <p className="text-xs text-gray-600">Rating</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setDeleteModalTemplate(null)}>
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      onClick={async () => {
                        if (!deleteModalTemplate) return;
                        await api.admin.deleteNudgeTemplate(deleteModalTemplate.id);
                        setTemplates((prev) =>
                          prev.filter((t) => t.id !== deleteModalTemplate.id)
                        );
                        setDeleteModalTemplate(null);
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayoutNew>
  );
}
