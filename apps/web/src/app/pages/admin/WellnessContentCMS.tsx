import { motion } from "motion/react";
import { useState } from "react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { AnimatePresence } from "motion/react";
import {
  BookOpen,
  Plus,
  Edit,
  Trash2,
  Eye,
  Search,
  Filter,
  Calendar,
  User,
  Tag,
  FileText,
  Video,
  Headphones,
  Image,
  Download,
  Upload,
  CheckCircle,
  Clock,
  TrendingUp,
  Star,
  MessageSquare,
  X,
  Save,
} from "lucide-react";

interface Content {
  id: number;
  title: string;
  type: "article" | "video" | "audio" | "exercise" | "guide";
  category: string;
  status: "published" | "draft" | "scheduled";
  author: string;
  publishDate: string;
  views: number;
  likes: number;
  comments: number;
  rating: number;
  tags: string[];
  thumbnail?: string;
  excerpt: string;
}

export function WellnessContentCMS() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  // Modal states
  const [viewModalContent, setViewModalContent] = useState<Content | null>(null);
  const [deleteModalContent, setDeleteModalContent] = useState<Content | null>(null);
  const [editModalContent, setEditModalContent] = useState<Content | null>(null);

  // Handle content actions
  const handleViewContent = (item: Content) => {
    setViewModalContent(item);
  };

  const handleEditContent = (item: Content) => {
    setEditModalContent(item);
  };

  const handleDeleteContent = (item: Content) => {
    setDeleteModalContent(item);
  };

  const handlePublishDraft = (item: Content) => {
    alert(`Publishing: ${item.title}\n\nThis draft will be published and become available to all users.`);
  };

  const content: Content[] = [
    {
      id: 1,
      title: "Understanding Anxiety: A Complete Guide",
      type: "article",
      category: "Anxiety Management",
      status: "published",
      author: "Dr. Emily Chen",
      publishDate: "Dec 28, 2024",
      views: 12456,
      likes: 1234,
      comments: 89,
      rating: 4.8,
      tags: ["anxiety", "mental-health", "coping-strategies"],
      excerpt: "A comprehensive guide to understanding and managing anxiety in daily life...",
    },
    {
      id: 2,
      title: "5-Minute Mindfulness Meditation",
      type: "audio",
      category: "Meditation",
      status: "published",
      author: "Sarah Williams",
      publishDate: "Dec 27, 2024",
      views: 8923,
      likes: 892,
      comments: 45,
      rating: 4.9,
      tags: ["meditation", "mindfulness", "breathing"],
      excerpt: "A quick guided meditation to help you center yourself and find calm...",
    },
    {
      id: 3,
      title: "Breathing Techniques for Stress Relief",
      type: "video",
      category: "Stress Management",
      status: "published",
      author: "Marcus Johnson",
      publishDate: "Dec 26, 2024",
      views: 15678,
      likes: 1567,
      comments: 123,
      rating: 4.7,
      tags: ["breathing", "stress-relief", "wellness"],
      excerpt: "Learn effective breathing techniques to reduce stress and anxiety instantly...",
    },
    {
      id: 4,
      title: "Progressive Muscle Relaxation Exercise",
      type: "exercise",
      category: "Relaxation",
      status: "published",
      author: "Dr. Sarah Williams",
      publishDate: "Dec 25, 2024",
      views: 6734,
      likes: 673,
      comments: 34,
      rating: 4.6,
      tags: ["relaxation", "exercise", "tension-relief"],
      excerpt: "A step-by-step guide to progressive muscle relaxation for deep relaxation...",
    },
    {
      id: 5,
      title: "Sleep Hygiene: Your Guide to Better Rest",
      type: "guide",
      category: "Sleep Health",
      status: "published",
      author: "Dr. Michael Brown",
      publishDate: "Dec 24, 2024",
      views: 11234,
      likes: 1123,
      comments: 67,
      rating: 4.9,
      tags: ["sleep", "health", "wellness"],
      excerpt: "Discover the science-backed strategies for improving your sleep quality...",
    },
    {
      id: 6,
      title: "Dealing with Workplace Stress",
      type: "article",
      category: "Stress Management",
      status: "draft",
      author: "Emily Chen",
      publishDate: "Not published",
      views: 0,
      likes: 0,
      comments: 0,
      rating: 0,
      tags: ["workplace", "stress", "productivity"],
      excerpt: "Practical strategies for managing stress in professional environments...",
    },
    {
      id: 7,
      title: "Morning Yoga for Mental Clarity",
      type: "video",
      category: "Exercise",
      status: "scheduled",
      author: "Luna Martinez",
      publishDate: "Jan 1, 2025",
      views: 0,
      likes: 0,
      comments: 0,
      rating: 0,
      tags: ["yoga", "morning-routine", "exercise"],
      excerpt: "Start your day with this gentle yoga flow designed to clear your mind...",
    },
    {
      id: 8,
      title: "Journaling for Mental Health",
      type: "guide",
      category: "Self-Care",
      status: "published",
      author: "Dr. Emily Chen",
      publishDate: "Dec 23, 2024",
      views: 9456,
      likes: 945,
      comments: 56,
      rating: 4.8,
      tags: ["journaling", "self-care", "mental-health"],
      excerpt: "Learn how journaling can improve your mental health and emotional well-being...",
    },
  ];

  const filteredContent = content.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = filterType === "all" || item.type === filterType;
    const matchesStatus = filterStatus === "all" || item.status === filterStatus;
    const matchesCategory = filterCategory === "all" || item.category === filterCategory;
    return matchesSearch && matchesType && matchesStatus && matchesCategory;
  });

  const stats = {
    total: content.length,
    published: content.filter((c) => c.status === "published").length,
    draft: content.filter((c) => c.status === "draft").length,
    scheduled: content.filter((c) => c.status === "scheduled").length,
    totalViews: content.reduce((sum, c) => sum + c.views, 0),
    avgRating: (content.filter(c => c.rating > 0).reduce((sum, c) => sum + c.rating, 0) / content.filter(c => c.rating > 0).length).toFixed(1),
  };

  const categories = [
    "Anxiety Management",
    "Stress Management",
    "Meditation",
    "Sleep Health",
    "Exercise",
    "Self-Care",
    "Relaxation",
    "Depression Support",
    "Mindfulness",
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "article":
        return FileText;
      case "video":
        return Video;
      case "audio":
        return Headphones;
      case "exercise":
        return Star;
      case "guide":
        return BookOpen;
      default:
        return FileText;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "article":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "video":
        return "bg-red-100 text-red-700 border-red-300";
      case "audio":
        return "bg-purple-100 text-purple-700 border-purple-300";
      case "exercise":
        return "bg-green-100 text-green-700 border-green-300";
      case "guide":
        return "bg-orange-100 text-orange-700 border-orange-300";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-700 border-green-300";
      case "draft":
        return "bg-gray-100 text-gray-700 border-gray-300";
      case "scheduled":
        return "bg-blue-100 text-blue-700 border-blue-300";
      default:
        return "bg-gray-100 text-gray-700";
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
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Wellness Content CMS</h1>
                <p className="text-muted-foreground">
                  Manage articles, videos, exercises, and wellness resources
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Import
              </Button>
              <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4" />
                Create Content
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Content</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Published</p>
                  <p className="text-2xl font-bold text-green-600">{stats.published}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Draft</p>
                  <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
                </div>
                <Edit className="w-8 h-8 text-gray-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Scheduled</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.scheduled}</p>
                </div>
                <Clock className="w-8 h-8 text-blue-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Views</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {(stats.totalViews / 1000).toFixed(1)}K
                  </p>
                </div>
                <Eye className="w-8 h-8 text-purple-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Avg Rating</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.avgRating}</p>
                </div>
                <Star className="w-8 h-8 text-yellow-500" />
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search content..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    className="px-3 py-2 border rounded-lg"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <option value="all">All Types</option>
                    <option value="article">Articles</option>
                    <option value="video">Videos</option>
                    <option value="audio">Audio</option>
                    <option value="exercise">Exercises</option>
                    <option value="guide">Guides</option>
                  </select>
                  <select
                    className="px-3 py-2 border rounded-lg"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <select
                    className="px-3 py-2 border rounded-lg"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredContent.map((item, index) => {
            const TypeIcon = getTypeIcon(item.type);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.05 }}
              >
                <Card className="p-6 hover:shadow-lg transition-shadow">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-lg">{item.title}</h3>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border inline-flex items-center gap-1 ${getTypeColor(item.type)}`}>
                          <TypeIcon className="w-3 h-3" />
                          {item.type}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleViewContent(item)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEditContent(item)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Excerpt */}
                  <p className="text-sm text-muted-foreground mb-4">{item.excerpt}</p>

                  {/* Meta Info */}
                  <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Category</p>
                      <p className="font-medium">{item.category}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Author</p>
                      <p className="font-medium">{item.author}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Published</p>
                      <p className="font-medium">{item.publishDate}</p>
                    </div>
                    {item.rating > 0 && (
                      <div>
                        <p className="text-muted-foreground mb-1">Rating</p>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-medium">{item.rating}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {item.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {/* Stats */}
                  {item.status === "published" && (
                    <div className="border-t pt-4 mb-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-lg font-bold text-blue-600">{item.views.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Views</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-pink-600">{item.likes.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Likes</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-purple-600">{item.comments}</p>
                          <p className="text-xs text-muted-foreground">Comments</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditContent(item)}>
                      Edit Content
                    </Button>
                    {item.status === "draft" && (
                      <Button size="sm" className="flex-1" onClick={() => handlePublishDraft(item)}>
                        Publish
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleDeleteContent(item)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
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
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-bold text-xl mb-2">No Content Found</h3>
            <p className="text-muted-foreground mb-4">
              No content matches the current filters
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Content
            </Button>
          </motion.div>
        )}

        {/* Create Modal Placeholder */}
        <AnimatePresence>
          {showCreateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowCreateModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Create New Content</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateModal(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Content Title</label>
                    <Input placeholder="Enter content title..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Type</label>
                      <select className="w-full px-3 py-2 border rounded-lg">
                        <option>Article</option>
                        <option>Video</option>
                        <option>Audio</option>
                        <option>Exercise</option>
                        <option>Guide</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Category</label>
                      <select className="w-full px-3 py-2 border rounded-lg">
                        {categories.map((cat) => (
                          <option key={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Excerpt</label>
                    <textarea
                      className="w-full p-3 border rounded-lg"
                      rows={3}
                      placeholder="Brief description..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Content Body</label>
                    <textarea
                      className="w-full p-3 border rounded-lg"
                      rows={8}
                      placeholder="Enter your content..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Tags</label>
                    <Input placeholder="e.g., anxiety, meditation, wellness" />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>
                      Cancel
                    </Button>
                    <Button variant="outline" className="flex-1">
                      Save as Draft
                    </Button>
                    <Button className="flex-1">
                      Publish
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
                    <div className="flex items-center gap-2 mb-3">
                      {(() => {
                        const TypeIcon = getTypeIcon(viewModalContent.type);
                        return (
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border inline-flex items-center gap-1 ${getTypeColor(viewModalContent.type)}`}>
                            <TypeIcon className="w-3 h-3" />
                            {viewModalContent.type}
                          </span>
                        );
                      })()}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(viewModalContent.status)}`}>
                        {viewModalContent.status}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{viewModalContent.title}</h2>
                    <p className="text-gray-600">{viewModalContent.excerpt}</p>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Category</h3>
                      <p className="text-gray-900">{viewModalContent.category}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Author</h3>
                      <p className="text-gray-900">{viewModalContent.author}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Published Date</h3>
                      <p className="text-gray-900">{viewModalContent.publishDate}</p>
                    </div>
                    {viewModalContent.rating > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Rating</h3>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-gray-900 font-medium">{viewModalContent.rating}</span>
                        </div>
                      </div>
                    )}
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
                        <div className="text-center p-4 bg-pink-50 rounded-lg">
                          <p className="text-2xl font-bold text-pink-600">
                            {viewModalContent.likes.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">Likes</p>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <p className="text-2xl font-bold text-purple-600">{viewModalContent.comments}</p>
                          <p className="text-xs text-gray-600 mt-1">Comments</p>
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
                      <p className="text-sm text-gray-600">Modify {editModalContent.type} content and settings</p>
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
                    <Input defaultValue={editModalContent.title} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                      <select className="w-full px-3 py-2 border rounded-lg" defaultValue={editModalContent.type}>
                        <option value="article">Article</option>
                        <option value="video">Video</option>
                        <option value="audio">Audio</option>
                        <option value="exercise">Exercise</option>
                        <option value="guide">Guide</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <select className="w-full px-3 py-2 border rounded-lg" defaultValue={editModalContent.category}>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Excerpt</label>
                    <textarea
                      className="w-full p-3 border rounded-lg"
                      rows={3}
                      defaultValue={editModalContent.excerpt}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                    <Input defaultValue={editModalContent.tags.join(", ")} placeholder="e.g., anxiety, meditation, wellness" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select className="w-full px-3 py-2 border rounded-lg" defaultValue={editModalContent.status}>
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
                      Save Draft
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => {
                        alert(`Published: ${editModalContent.title}`);
                        setEditModalContent(null);
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
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
                  This {deleteModalContent.type} will be permanently removed from your library.
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