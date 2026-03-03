import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  Copy,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Upload,
  Heart,
  Brain,
  Zap,
  Moon,
  Sun,
  Wind,
  Sparkles,
  Target,
  X,
  Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { api } from "../../../lib/api";
import { formatDistanceToNow } from "date-fns";

interface WellnessTool {
  id: string;
  title: string;
  category: string;
  description: string;
  duration: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  status: "published" | "draft" | "archived";
  icon: any;
  iconColor: string;
  usageCount: number;
  rating: number;
  lastUpdated: string;
  createdBy: string;
}

const iconMap: Record<string, any> = {
  Wind,
  Brain,
  Moon,
  Target,
  Heart,
  Sparkles,
  Sun,
  Zap,
};

export function WellnessToolsCMS() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [wellnessTools, setWellnessTools] = useState<WellnessTool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal states
  const [viewModalTool, setViewModalTool] = useState<WellnessTool | null>(null);
  const [deleteModalTool, setDeleteModalTool] = useState<WellnessTool | null>(null);

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      setIsLoading(true);
      const tools = await api.wellness.getAll();
      const mappedTools: WellnessTool[] = tools.map((t: any) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        description: t.description || "",
        duration: t.duration_minutes || 0,
        difficulty: (t.difficulty as any) || "Beginner",
        status: (t.status as any) || "draft",
        icon: iconMap[t.icon || "Sparkles"] || Sparkles,
        iconColor: "#8b5cf6", // Default purple for now, could be dynamic
        usageCount: t.usage_count || 0,
        rating: Number(t.rating) || 0,
        lastUpdated: formatDistanceToNow(new Date(t.updated_at), { addSuffix: true }),
        createdBy: t.profiles?.full_name || "Admin",
      }));
      setWellnessTools(mappedTools);
    } catch (error) {
      console.error("Failed to fetch wellness tools:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const categories = [
    "All Categories",
    "Breathing",
    "Meditation",
    "Sleep",
    "Anxiety Relief",
    "Stress Management",
    "Mindfulness",
    "Energy Boost",
  ];

  const filteredTools = wellnessTools.filter((tool) => {
    const matchesSearch =
      tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" ||
      selectedCategory === "All Categories" ||
      tool.category === selectedCategory;
    const matchesStatus =
      selectedStatus === "all" || tool.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const stats = [
    {
      label: "Total Tools",
      value: wellnessTools.length.toString(),
      color: "from-blue-500 to-cyan-600",
      icon: Sparkles,
    },
    {
      label: "Published",
      value: wellnessTools.filter((t) => t.status === "published").length.toString(),
      color: "from-green-500 to-emerald-600",
      icon: CheckCircle2,
    },
    {
      label: "Draft",
      value: wellnessTools.filter((t) => t.status === "draft").length.toString(),
      color: "from-orange-500 to-amber-600",
      icon: Clock,
    },
    {
      label: "Total Usage",
      value: wellnessTools
        .reduce((sum, t) => sum + t.usageCount, 0)
        .toLocaleString(),
      color: "from-purple-500 to-pink-600",
      icon: Heart,
    },
  ];

  const handleSelectTool = (id: string) => {
    setSelectedTools((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedTools.length === filteredTools.length) {
      setSelectedTools([]);
    } else {
      setSelectedTools(filteredTools.map((t) => t.id));
    }
  };

  const handleBulkAction = async (action: string) => {
    console.log(`Bulk action: ${action} for tools:`, selectedTools);
    try {
      if (action === "delete") {
        if (!confirm(`Are you sure you want to delete ${selectedTools.length} tools?`)) return;
        await Promise.all(selectedTools.map(id => api.wellness.delete(id)));
        alert(`Successfully deleted ${selectedTools.length} tools`);
      } else if (action === "publish") {
        await Promise.all(selectedTools.map(id => api.wellness.update(id, { status: "published" })));
        alert(`Successfully published ${selectedTools.length} tools`);
      } else if (action === "archive") {
        await Promise.all(selectedTools.map(id => api.wellness.update(id, { status: "archived" })));
        alert(`Successfully archived ${selectedTools.length} tools`);
      }
      await fetchTools();
      setSelectedTools([]);
    } catch (error) {
      console.error("Bulk action failed:", error);
      alert("Failed to perform bulk action");
    }
  };

  // Handle individual tool actions
  const handleViewTool = (tool: WellnessTool) => {
    setViewModalTool(tool);
  };

  const handleCopyTool = (tool: WellnessTool) => {
    alert(`Copied: ${tool.title}\n\nThis would create a duplicate of this tool that you can modify and publish as a new version.`);
  };

  const handleDeleteTool = (tool: WellnessTool) => {
    setDeleteModalTool(tool);
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalTool) return;
    try {
      await api.wellness.delete(deleteModalTool.id);
      await fetchTools();
      setDeleteModalTool(null);
      alert("Tool deleted successfully");
    } catch (error) {
      console.error("Failed to delete tool:", error);
      alert("Failed to delete tool");
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
              Wellness Tools CMS
            </h1>
            <p className="text-gray-600">
              Manage your library of wellness tools and exercises
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button
              onClick={() => navigate("/admin/wellness-tool-editor")}
              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Tool
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

        {/* Filters & Search */}
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
                <input
                  type="text"
                  placeholder="Search wellness tools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Categories</option>
                {categories.slice(1).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>

              {/* View Mode */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-3 py-2 rounded-lg transition-all ${
                    viewMode === "grid"
                      ? "bg-purple-500 text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-2 rounded-lg transition-all ${
                    viewMode === "list"
                      ? "bg-purple-500 text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  List
                </button>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedTools.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 pt-4 border-t border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <p className="text-gray-900 font-medium">
                      {selectedTools.length} selected
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkAction("publish")}
                      className="border-gray-300 text-gray-700 hover:bg-gray-100"
                    >
                      Publish
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkAction("archive")}
                      className="border-gray-300 text-gray-700 hover:bg-gray-100"
                    >
                      Archive
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkAction("delete")}
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedTools([])}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Clear Selection
                  </Button>
                </div>
              </motion.div>
            )}
          </Card>
        </motion.div>

        {/* Tools Grid/List */}
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "space-y-4"
          }
        >
          {isLoading && filteredTools.length === 0 ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            filteredTools.map((tool, index) => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className={`bg-white border border-gray-200 p-6 hover:shadow-lg transition-all ${
                    selectedTools.includes(tool.id) ? "ring-2 ring-purple-500" : ""
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedTools.includes(tool.id)}
                        onChange={() => handleSelectTool(tool.id)}
                        className="w-4 h-4 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                      />
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${tool.iconColor}20` }}
                      >
                        <tool.icon
                          className="w-6 h-6"
                          style={{ color: tool.iconColor }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          tool.status === "published"
                            ? "bg-green-100 text-green-700"
                            : tool.status === "draft"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {tool.status}
                      </span>
                      <button className="p-1 hover:bg-gray-100 rounded-lg transition-all">
                        <MoreVertical className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-2">{tool.title}</h3>
                  <p className="text-sm text-gray-600 mb-4">{tool.description}</p>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Category</p>
                      <p className="text-sm text-gray-900 font-medium">{tool.category}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Duration</p>
                      <p className="text-sm text-gray-900 font-medium">
                        {tool.duration} min
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Difficulty</p>
                      <p className="text-sm text-gray-900 font-medium">{tool.difficulty}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Usage</p>
                      <p className="text-sm text-gray-900 font-medium">
                        {tool.usageCount.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {tool.status === "published" && (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Heart
                            key={i}
                            className={`w-3 h-3 ${
                              i < Math.floor(tool.rating)
                                ? "fill-pink-500 text-pink-500"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-600">{tool.rating}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-500">Last updated</p>
                      <p className="text-xs text-gray-600">{tool.lastUpdated}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewTool(tool)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyTool(tool)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          navigate(`/admin/wellness-tool-editor?id=${tool.id}`)
                        }
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteTool(tool)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        {/* Empty State */}
        {filteredTools.length === 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Card className="bg-white border border-gray-200 p-12">
              <Sparkles className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                No tools found
              </h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your filters or create a new wellness tool
              </p>
              <Button
                onClick={() => navigate("/admin/wellness-tool-editor")}
                className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Tool
              </Button>
            </Card>
          </motion.div>
        )}

        {/* View Modal */}
        <AnimatePresence>
          {viewModalTool && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setViewModalTool(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-16 h-16 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${viewModalTool.iconColor}20` }}
                    >
                      <viewModalTool.icon
                        className="w-8 h-8"
                        style={{ color: viewModalTool.iconColor }}
                      />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{viewModalTool.title}</h2>
                      <span
                        className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${
                          viewModalTool.status === "published"
                            ? "bg-green-100 text-green-700"
                            : viewModalTool.status === "draft"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {viewModalTool.status}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewModalTool(null)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
                    <p className="text-gray-900">{viewModalTool.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Category</h3>
                      <p className="text-gray-900">{viewModalTool.category}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Duration</h3>
                      <p className="text-gray-900">{viewModalTool.duration} minutes</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Difficulty</h3>
                      <p className="text-gray-900">{viewModalTool.difficulty}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Created By</h3>
                      <p className="text-gray-900">{viewModalTool.createdBy}</p>
                    </div>
                  </div>

                  {viewModalTool.status === "published" && (
                    <div className="border-t pt-4">
                      <h3 className="text-sm font-medium text-gray-500 mb-3">Usage Statistics</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <p className="text-2xl font-bold text-blue-600">
                            {viewModalTool.usageCount.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">Total Uses</p>
                        </div>
                        <div className="text-center p-4 bg-yellow-50 rounded-lg">
                          <p className="text-2xl font-bold text-yellow-600">{viewModalTool.rating}</p>
                          <p className="text-xs text-gray-600 mt-1">Avg Rating</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">{viewModalTool.lastUpdated}</p>
                          <p className="text-xs text-gray-600 mt-1">Last Updated</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setViewModalTool(null);
                        navigate(`/admin/wellness-tool-editor?id=${viewModalTool.id}`);
                      }}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Tool
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setViewModalTool(null)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteModalTool && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setDeleteModalTool(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-md w-full"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Delete Tool</h2>
                    <p className="text-sm text-gray-600">This action cannot be undone</p>
                  </div>
                </div>

                <p className="text-gray-700 mb-6">
                  Are you sure you want to delete <strong>"{deleteModalTool.title}"</strong>?
                  This wellness tool will be permanently removed from your library.
                </p>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDeleteModalTool(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    onClick={handleConfirmDelete}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayoutNew>
  );
}
