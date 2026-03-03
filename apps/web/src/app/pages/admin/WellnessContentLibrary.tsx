import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Calendar,
  Tag,
  FileText,
  Image as ImageIcon,
  Video,
  BookOpen,
  Lightbulb,
  Activity,
  Download,
  Filter,
  MoreVertical,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  X,
  Save,
} from "lucide-react";
import { useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "motion/react";

interface ContentItem {
  id: string;
  title: string;
  type: "tip" | "article" | "activity" | "video";
  category: string;
  description: string;
  content: string;
  tags: string[];
  status: "published" | "draft" | "scheduled";
  scheduledDate?: string;
  author: string;
  views: number;
  likes: number;
  shares: number;
  createdAt: string;
  updatedAt: string;
}

export function WellnessContentLibrary() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  // Modal states
  const [viewModalContent, setViewModalContent] = useState<ContentItem | null>(null);
  const [editModalContent, setEditModalContent] = useState<ContentItem | null>(null);
  const [deleteModalContent, setDeleteModalContent] = useState<ContentItem | null>(null);

  const contentItems: ContentItem[] = [
    {
      id: "1",
      title: "5 Morning Habits for Better Mental Health",
      type: "article",
      category: "Mental Wellness",
      description: "Start your day right with these science-backed habits",
      content: "Full article content here...",
      tags: ["morning routine", "habits", "mental health"],
      status: "published",
      author: "Dr. Sarah Chen",
      views: 3456,
      likes: 289,
      shares: 45,
      createdAt: "2024-01-15",
      updatedAt: "2024-01-15",
    },
    {
      id: "2",
      title: "Quick Desk Stretch Routine",
      type: "activity",
      category: "Physical Wellness",
      description: "5-minute stretches to do at your desk",
      content: "Activity instructions...",
      tags: ["stretching", "desk work", "quick"],
      status: "published",
      author: "Emma Wilson",
      views: 2134,
      likes: 198,
      shares: 32,
      createdAt: "2024-01-14",
      updatedAt: "2024-01-16",
    },
    {
      id: "3",
      title: "Deep Breathing Benefits",
      type: "tip",
      category: "Breathing",
      description: "Why deep breathing is essential for stress management",
      content: "Tip content...",
      tags: ["breathing", "stress", "quick tip"],
      status: "published",
      author: "Dr. Michael Ross",
      views: 1876,
      likes: 156,
      shares: 28,
      createdAt: "2024-01-13",
      updatedAt: "2024-01-13",
    },
    {
      id: "4",
      title: "Meditation for Beginners",
      type: "video",
      category: "Meditation",
      description: "10-minute guided meditation introduction",
      content: "Video URL...",
      tags: ["meditation", "beginner", "guided"],
      status: "scheduled",
      scheduledDate: "2024-01-25",
      author: "Sarah Chen",
      views: 0,
      likes: 0,
      shares: 0,
      createdAt: "2024-01-17",
      updatedAt: "2024-01-17",
    },
    {
      id: "5",
      title: "Sleep Hygiene Checklist",
      type: "article",
      category: "Sleep",
      description: "Complete guide to better sleep habits",
      content: "Article content...",
      tags: ["sleep", "hygiene", "checklist"],
      status: "draft",
      author: "Emma Wilson",
      views: 0,
      likes: 0,
      shares: 0,
      createdAt: "2024-01-18",
      updatedAt: "2024-01-18",
    },
    {
      id: "6",
      title: "Gratitude Journaling Prompts",
      type: "activity",
      category: "Mindfulness",
      description: "30 daily prompts for gratitude practice",
      content: "Activity prompts...",
      tags: ["gratitude", "journaling", "mindfulness"],
      status: "published",
      author: "Dr. Michael Ross",
      views: 2987,
      likes: 245,
      shares: 67,
      createdAt: "2024-01-12",
      updatedAt: "2024-01-14",
    },
    {
      id: "7",
      title: "Managing Work Stress",
      type: "tip",
      category: "Stress Management",
      description: "Quick strategies to reduce workplace stress",
      content: "Tip content...",
      tags: ["stress", "work", "productivity"],
      status: "published",
      author: "Sarah Chen",
      views: 1654,
      likes: 134,
      shares: 23,
      createdAt: "2024-01-11",
      updatedAt: "2024-01-11",
    },
    {
      id: "8",
      title: "Anxiety Relief Techniques",
      type: "article",
      category: "Anxiety Relief",
      description: "Evidence-based methods to calm anxiety",
      content: "Article content...",
      tags: ["anxiety", "relief", "techniques"],
      status: "published",
      author: "Dr. Michael Ross",
      views: 4123,
      likes: 378,
      shares: 89,
      createdAt: "2024-01-10",
      updatedAt: "2024-01-15",
    },
  ];

  const filteredContent = contentItems.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const matchesType = selectedType === "all" || item.type === selectedType;
    const matchesStatus =
      selectedStatus === "all" || item.status === selectedStatus;
    const matchesCategory =
      selectedCategory === "all" || item.category === selectedCategory;
    return matchesSearch && matchesType && matchesStatus && matchesCategory;
  });

  const stats = [
    {
      label: "Total Content",
      value: contentItems.length.toString(),
      color: "from-purple-500 to-pink-600",
      icon: BookOpen,
    },
    {
      label: "Published",
      value: contentItems.filter((i) => i.status === "published").length.toString(),
      color: "from-green-500 to-emerald-600",
      icon: CheckCircle2,
    },
    {
      label: "Total Views",
      value: contentItems.reduce((sum, i) => sum + i.views, 0).toLocaleString(),
      color: "from-blue-500 to-cyan-600",
      icon: Eye,
    },
    {
      label: "Total Engagement",
      value: contentItems
        .reduce((sum, i) => sum + i.likes + i.shares, 0)
        .toLocaleString(),
      color: "from-orange-500 to-red-600",
      icon: Activity,
    },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "article":
        return FileText;
      case "tip":
        return Lightbulb;
      case "activity":
        return Activity;
      case "video":
        return Video;
      default:
        return BookOpen;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "article":
        return "#3b82f6";
      case "tip":
        return "#f59e0b";
      case "activity":
        return "#10b981";
      case "video":
        return "#ec4899";
      default:
        return "#8b5cf6";
    }
  };

  // Handle content actions
  const handleViewContent = (item: ContentItem) => {
    setViewModalContent(item);
  };

  const handleCopyContent = (item: ContentItem) => {
    alert(`Copied: ${item.title}\n\nThis would create a duplicate of this content that you can modify and publish as a new version.`);
  };

  const handleEditContent = (item: ContentItem) => {
    setEditModalContent(item);
  };

  const handleDeleteContent = (item: ContentItem) => {
    setDeleteModalContent(item);
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
              Wellness Content Library
            </h1>
            <p className="text-gray-600">
              Manage tips, articles, activities, and resources
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Content
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
                <input
                  type="text"
                  placeholder="Search content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Types</option>
                <option value="article">Articles</option>
                <option value="tip">Tips</option>
                <option value="activity">Activities</option>
                <option value="video">Videos</option>
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
                <option value="scheduled">Scheduled</option>
              </select>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Categories</option>
                <option value="Mental Wellness">Mental Wellness</option>
                <option value="Physical Wellness">Physical Wellness</option>
                <option value="Sleep">Sleep</option>
                <option value="Meditation">Meditation</option>
                <option value="Mindfulness">Mindfulness</option>
                <option value="Stress Management">Stress Management</option>
              </select>
            </div>
          </Card>
        </motion.div>

        {/* Content List */}
        <div className="space-y-4">
          {filteredContent.map((item, index) => {
            const TypeIcon = getTypeIcon(item.type);
            const typeColor = getTypeColor(item.type);

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="bg-white border border-gray-200 p-6 hover:shadow-lg transition-all">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${typeColor}20` }}
                    >
                      <TypeIcon className="w-6 h-6" style={{ color: typeColor }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-1">
                            {item.title}
                          </h3>
                          <p className="text-sm text-gray-600 mb-2">
                            {item.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                              item.status === "published"
                                ? "bg-green-100 text-green-700"
                                : item.status === "draft"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {item.status === "scheduled"
                              ? `Scheduled ${item.scheduledDate}`
                              : item.status}
                          </span>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                          <Tag className="w-3 h-3" />
                          {item.category}
                        </span>
                        {item.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Eye className="w-4 h-4" />
                          <span>{item.views.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <Activity className="w-4 h-4" />
                          <span>
                            {(item.likes + item.shares).toLocaleString()} interactions
                          </span>
                        </div>
                        <span className="text-gray-500">by {item.author}</span>
                        <span className="text-gray-500">
                          Updated {item.updatedAt}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewContent(item)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyContent(item)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditContent(item)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteContent(item)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredContent.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Card className="bg-white border border-gray-200 p-12">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">No content found</h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your filters or create new content
              </p>
              <Button className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Create Content
              </Button>
            </Card>
          </motion.div>
        )}

        {/* View Modal */}
        <AnimatePresence>
          {viewModalContent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setViewModalContent(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {(() => {
                        const TypeIcon = getTypeIcon(viewModalContent.type);
                        const typeColor = getTypeColor(viewModalContent.type);
                        return (
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: `${typeColor}20` }}
                          >
                            <TypeIcon className="w-6 h-6" style={{ color: typeColor }} />
                          </div>
                        );
                      })()}
                      <div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            viewModalContent.status === "published"
                              ? "bg-green-100 text-green-700"
                              : viewModalContent.status === "draft"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {viewModalContent.status}
                        </span>
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{viewModalContent.title}</h2>
                    <p className="text-gray-600">{viewModalContent.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewModalContent(null)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Content</h3>
                    <p className="text-gray-900 bg-gray-50 p-4 rounded-lg">{viewModalContent.content}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Type</h3>
                      <p className="text-gray-900 capitalize">{viewModalContent.type}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Category</h3>
                      <p className="text-gray-900">{viewModalContent.category}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Author</h3>
                      <p className="text-gray-900">{viewModalContent.author}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Created</h3>
                      <p className="text-gray-900">{viewModalContent.createdAt}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {viewModalContent.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {viewModalContent.status === "published" && (
                    <div className="border-t pt-4">
                      <h3 className="text-sm font-medium text-gray-500 mb-3">Engagement Statistics</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <p className="text-2xl font-bold text-blue-600">
                            {viewModalContent.views.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">Views</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">
                            {viewModalContent.likes.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">Likes</p>
                        </div>
                        <div className="text-center p-4 bg-orange-50 rounded-lg">
                          <p className="text-2xl font-bold text-orange-600">{viewModalContent.shares}</p>
                          <p className="text-xs text-gray-600 mt-1">Shares</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setViewModalContent(null);
                        setEditModalContent(viewModalContent);
                      }}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Content
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setViewModalContent(null)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Modal */}
        <AnimatePresence>
          {editModalContent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setEditModalContent(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <Edit className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Edit Content</h2>
                      <p className="text-sm text-gray-600">Modify {editModalContent.type} details</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditModalContent(null)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <input
                      type="text"
                      defaultValue={editModalContent.title}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                      <select 
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500" 
                        defaultValue={editModalContent.type}
                      >
                        <option value="article">Article</option>
                        <option value="tip">Tip</option>
                        <option value="activity">Activity</option>
                        <option value="video">Video</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <input
                        type="text"
                        defaultValue={editModalContent.category}
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      rows={3}
                      defaultValue={editModalContent.description}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                    <textarea
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      rows={6}
                      defaultValue={editModalContent.content}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma-separated)</label>
                    <input
                      type="text"
                      defaultValue={editModalContent.tags.join(", ")}
                      placeholder="e.g., wellness, mindfulness, stress"
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select 
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500" 
                      defaultValue={editModalContent.status}
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="scheduled">Scheduled</option>
                    </select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setEditModalContent(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        alert(`Saved changes to: ${editModalContent.title}`);
                        setEditModalContent(null);
                      }}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        alert(`Published: ${editModalContent.title}`);
                        setEditModalContent(null);
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Publish
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteModalContent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setDeleteModalContent(null)}
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
                    <h2 className="text-xl font-bold text-gray-900">Delete Content</h2>
                    <p className="text-sm text-gray-600">This action cannot be undone</p>
                  </div>
                </div>

                <p className="text-gray-700 mb-6">
                  Are you sure you want to delete <strong>"{deleteModalContent.title}"</strong>?
                  This {deleteModalContent.type} will be permanently removed from the library.
                </p>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDeleteModalContent(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => {
                      alert(`Deleted: ${deleteModalContent.title}`);
                      setDeleteModalContent(null);
                    }}
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