import { motion } from "motion/react";
import { useState, useMemo, useEffect, useCallback } from "react";
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
  Calendar,
  FileText,
  Video,
  Headphones,
  Image,
  Upload,
  CheckCircle,
  Clock,
  Star,
  X,
  Save,
  Loader2,
} from "lucide-react";
import { WELLNESS_TOOL_CATEGORIES, type WellnessToolCategory } from "../../../lib/wellnessToolCategories";
import { api } from "../../../lib/api";
import {
  mergeApiBuiltinsForAdmin,
  mergeWellnessToolsForAdminDisplay,
  placeholderWellnessToolId,
  isWellnessPlaceholderId,
} from "../../../lib/mergeAdminWellnessTools";
import {
  WELLNESS_BUILTIN_TOOLS_ADMIN,
  isBuiltinWellnessListId,
  type WellnessBuiltinToolMeta,
} from "../../../lib/wellnessBuiltinToolsMetadata";

interface Content {
  id: string;
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
  isBuiltin?: boolean;
}

function mapBuiltinMetaToContent(meta: WellnessBuiltinToolMeta): Content {
  return {
    id: `builtin:${meta.id}`,
    title: meta.title,
    type: meta.category === "Exercise" ? "exercise" : "guide",
    category: meta.category,
    status: "published",
    author: "Ezri app",
    publishDate: "Built-in",
    views: 0,
    likes: 0,
    comments: 0,
    rating: 0,
    tags: [meta.category],
    excerpt: meta.description,
    isBuiltin: true,
  };
}

function mapApiToolToContent(t: Record<string, unknown>): Content {
  const category = String(t.category ?? "");
  const statusRaw = String(t.status ?? "draft").toLowerCase();
  const contentStatus: Content["status"] =
    statusRaw === "published"
      ? "published"
      : statusRaw === "scheduled"
        ? "scheduled"
        : "draft";
  const profiles = t.profiles as { full_name?: string | null } | null | undefined;
  const updated = t.updated_at ? new Date(String(t.updated_at)) : null;
  const created = t.created_at ? new Date(String(t.created_at)) : null;
  const publishDate = updated
    ? updated.toLocaleDateString()
    : created
      ? created.toLocaleDateString()
      : "—";
  const desc = t.description != null ? String(t.description) : "";
  return {
    id: String(t.id),
    title: String(t.title ?? ""),
    type: category === "Exercise" ? "exercise" : "guide",
    category,
    status: contentStatus,
    author: profiles?.full_name?.trim() || "Admin",
    publishDate,
    views: 0,
    likes: 0,
    comments: 0,
    rating: 0,
    tags: [category].filter(Boolean),
    excerpt: desc.trim() || "Wellness tool",
    thumbnail: t.image_url != null ? String(t.image_url) : undefined,
  };
}

function placeholderContent(cat: WellnessToolCategory): Content {
  return {
    id: placeholderWellnessToolId(cat),
    title: `${cat}: add a tool`,
    type: "guide",
    category: cat,
    status: "draft",
    author: "—",
    publishDate: "—",
    views: 0,
    likes: 0,
    comments: 0,
    rating: 0,
    tags: [cat],
    excerpt: "Create a wellness tool in Wellness Tools CMS or add content here.",
  };
}

export function WellnessContentCMS() {
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [viewModalContent, setViewModalContent] = useState<Content | null>(null);
  const [deleteModalContent, setDeleteModalContent] = useState<Content | null>(null);
  const [editModalContent, setEditModalContent] = useState<Content | null>(null);

  const [createForm, setCreateForm] = useState<{
    title: string;
    type: Content["type"];
    category: WellnessToolCategory;
    excerpt: string;
    body: string;
    tags: string;
  }>({
    title: "",
    type: "guide",
    category: WELLNESS_TOOL_CATEGORIES[0],
    excerpt: "",
    body: "",
    tags: "",
  });

  const [editForm, setEditForm] = useState<{
    title: string;
    type: Content["type"];
    category: WellnessToolCategory;
    excerpt: string;
    tags: string;
    status: Content["status"];
  }>({
    title: "",
    type: "guide",
    category: WELLNESS_TOOL_CATEGORIES[0],
    excerpt: "",
    tags: "",
    status: "draft",
  });

  const loadContent = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const builtins = WELLNESS_BUILTIN_TOOLS_ADMIN.map(mapBuiltinMetaToContent);
    try {
      const raw = (await api.wellness.getAll()) as Record<string, unknown>[];
      const apiRows = Array.isArray(raw) ? raw.map(mapApiToolToContent) : [];
      const merged = mergeApiBuiltinsForAdmin(builtins, apiRows);
      const withPlaceholders = mergeWellnessToolsForAdminDisplay(merged, placeholderContent);
      setContent(withPlaceholders);
    } catch (e) {
      console.error(e);
      setLoadError("Could not load CMS tools from the server. Showing built-in catalog only.");
      const merged = mergeApiBuiltinsForAdmin(builtins, []);
      setContent(mergeWellnessToolsForAdminDisplay(merged, placeholderContent));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  useEffect(() => {
    if (editModalContent) {
      const cat = (WELLNESS_TOOL_CATEGORIES as readonly string[]).includes(editModalContent.category)
        ? (editModalContent.category as WellnessToolCategory)
        : WELLNESS_TOOL_CATEGORIES[0];
      setEditForm({
        title: editModalContent.title,
        type: editModalContent.type,
        category: cat,
        excerpt: editModalContent.excerpt,
        tags: editModalContent.tags.join(", "),
        status: editModalContent.status,
      });
    }
  }, [editModalContent]);

  const handleViewContent = (item: Content) => {
    setViewModalContent(item);
  };

  const handleEditContent = (item: Content) => {
    if (item.isBuiltin || isBuiltinWellnessListId(item.id)) {
      alert(
        "Built-in tools ship with the app. To change copy or metadata for users, edit catalog code or add a parallel CMS tool in Wellness Tools CMS."
      );
      return;
    }
    if (isWellnessPlaceholderId(item.id)) {
      alert("This row is a placeholder. Create a real wellness tool first (Create Content or Wellness Tools CMS).");
      return;
    }
    setEditModalContent(item);
  };

  const handleDeleteContent = (item: Content) => {
    setDeleteModalContent(item);
  };

  const handlePublishDraft = async (item: Content) => {
    if (item.isBuiltin || isBuiltinWellnessListId(item.id) || isWellnessPlaceholderId(item.id)) {
      alert("Only CMS-backed tools can be published from here.");
      return;
    }
    setSaving(true);
    try {
      await api.wellness.update(item.id, { status: "published" });
      await loadContent();
    } catch (e) {
      console.error(e);
      alert("Failed to publish. Check that you are signed in as admin.");
    } finally {
      setSaving(false);
    }
  };

  const confirmCreate = async (publish: boolean) => {
    if (!createForm.title.trim()) {
      alert("Please enter a title.");
      return;
    }
    setSaving(true);
    try {
      await api.wellness.create({
        title: createForm.title.trim(),
        category: createForm.category,
        description: createForm.excerpt.trim() || undefined,
        content: createForm.body.trim() || undefined,
        duration_minutes: createForm.type === "exercise" ? 10 : 5,
        status: publish ? "published" : "draft",
        difficulty: "Beginner",
        is_premium: false,
        icon: "Heart",
      });
      setShowCreateModal(false);
      setCreateForm({
        title: "",
        type: "guide",
        category: WELLNESS_TOOL_CATEGORIES[0],
        excerpt: "",
        body: "",
        tags: "",
      });
      await loadContent();
    } catch (e) {
      console.error(e);
      alert("Failed to create content. Check admin session and required fields.");
    } finally {
      setSaving(false);
    }
  };

  const confirmEditSave = async (publish: boolean) => {
    if (!editModalContent) return;
    if (editModalContent.isBuiltin || isBuiltinWellnessListId(editModalContent.id)) {
      alert("Built-in content cannot be updated via this form.");
      setEditModalContent(null);
      return;
    }
    if (isWellnessPlaceholderId(editModalContent.id)) {
      alert("Cannot save edits to a placeholder row.");
      setEditModalContent(null);
      return;
    }
    setSaving(true);
    try {
      const apiStatus =
        publish || editForm.status === "published"
          ? "published"
          : editForm.status === "scheduled"
            ? "draft"
            : "draft";
      await api.wellness.update(editModalContent.id, {
        title: editForm.title.trim(),
        category: editForm.category as WellnessToolCategory,
        description: editForm.excerpt.trim() || undefined,
        status: apiStatus,
      });
      setEditModalContent(null);
      await loadContent();
    } catch (e) {
      console.error(e);
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteModalContent) return;
    const item = deleteModalContent;
    if (item.isBuiltin || isBuiltinWellnessListId(item.id)) {
      alert("Built-in content cannot be deleted.");
      setDeleteModalContent(null);
      return;
    }
    if (isWellnessPlaceholderId(item.id)) {
      alert("Remove placeholders by adding real tools; placeholders are not stored.");
      setDeleteModalContent(null);
      return;
    }
    setSaving(true);
    try {
      await api.wellness.delete(item.id);
      setDeleteModalContent(null);
      await loadContent();
    } catch (e) {
      console.error(e);
      alert("Failed to delete.");
    } finally {
      setSaving(false);
    }
  };

  const filteredContent = content.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = filterType === "all" || item.type === filterType;
    const matchesStatus = filterStatus === "all" || item.status === filterStatus;
    const matchesCategory = filterCategory === "all" || item.category === filterCategory;
    return matchesSearch && matchesType && matchesStatus && matchesCategory;
  });

  const stats = useMemo(() => {
    const rated = content.filter((c) => c.rating > 0);
    const avgRating =
      rated.length === 0 ? "0" : (rated.reduce((sum, c) => sum + c.rating, 0) / rated.length).toFixed(1);
    return {
      total: content.length,
      published: content.filter((c) => c.status === "published").length,
      draft: content.filter((c) => c.status === "draft").length,
      scheduled: content.filter((c) => c.status === "scheduled").length,
      totalViews: content.reduce((sum, c) => sum + c.views, 0),
      avgRating,
    };
  }, [content]);

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
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center shadow-lg">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Wellness Content CMS</h1>
                <p className="text-muted-foreground">
                  Manage articles, videos, exercises, and wellness resources (synced with wellness tools API)
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => void loadContent()}
                disabled={loading || saving}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Refresh
              </Button>
              <Button className="gap-2" onClick={() => setShowCreateModal(true)} disabled={saving}>
                <Plus className="w-4 h-4" />
                Create Content
              </Button>
            </div>
          </div>
          {loadError && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
              {loadError}
            </p>
          )}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
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

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
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

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
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

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Views</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {stats.totalViews >= 1000
                      ? `${(stats.totalViews / 1000).toFixed(1)}K`
                      : stats.totalViews.toLocaleString()}
                  </p>
                </div>
                <Eye className="w-8 h-8 text-purple-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
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

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
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
                <div className="flex gap-2 flex-wrap">
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
                    {WELLNESS_TOOL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
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

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin mb-3" />
            <p>Loading wellness content…</p>
          </div>
        ) : (
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
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-bold text-lg">{item.title}</h3>
                          {item.isBuiltin && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              Built-in
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium border inline-flex items-center gap-1 ${getTypeColor(item.type)}`}
                          >
                            <TypeIcon className="w-3 h-3" />
                            {item.type}
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(item.status)}`}
                          >
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

                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{item.excerpt}</p>

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

                    <div className="flex flex-wrap gap-2 mb-4">
                      {item.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          #{tag}
                        </span>
                      ))}
                    </div>

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

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 min-w-[120px]"
                        onClick={() => handleEditContent(item)}
                      >
                        Edit Content
                      </Button>
                      {item.status === "draft" && !item.isBuiltin && !isWellnessPlaceholderId(item.id) && (
                        <Button
                          size="sm"
                          className="flex-1 min-w-[120px]"
                          disabled={saving}
                          onClick={() => void handlePublishDraft(item)}
                        >
                          Publish
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteContent(item)}
                        disabled={item.isBuiltin || isBuiltinWellnessListId(item.id) || isWellnessPlaceholderId(item.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {!loading && filteredContent.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-bold text-xl mb-2">No Content Found</h3>
            <p className="text-muted-foreground mb-4">
              {content.length === 0
                ? "No content yet. Create an item to get started."
                : "No content matches the current filters."}
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Content
            </Button>
          </motion.div>
        )}

        <AnimatePresence>
          {showCreateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => !saving && setShowCreateModal(false)}
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
                  <Button variant="ghost" size="sm" onClick={() => !saving && setShowCreateModal(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Content Title</label>
                    <Input
                      placeholder="Enter content title..."
                      value={createForm.title}
                      onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Type</label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={createForm.type}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, type: e.target.value as Content["type"] })
                        }
                      >
                        <option value="article">Article</option>
                        <option value="video">Video</option>
                        <option value="audio">Audio</option>
                        <option value="exercise">Exercise</option>
                        <option value="guide">Guide</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Category</label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={createForm.category}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            category: e.target.value as WellnessToolCategory,
                          })
                        }
                      >
                        {WELLNESS_TOOL_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
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
                      value={createForm.excerpt}
                      onChange={(e) => setCreateForm({ ...createForm, excerpt: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Content Body</label>
                    <textarea
                      className="w-full p-3 border rounded-lg"
                      rows={8}
                      placeholder="Optional script or notes (stored on the tool)..."
                      value={createForm.body}
                      onChange={(e) => setCreateForm({ ...createForm, body: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Tags</label>
                    <Input
                      placeholder="e.g., anxiety, meditation, wellness"
                      value={createForm.tags}
                      onChange={(e) => setCreateForm({ ...createForm, tags: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2 pt-4 flex-wrap">
                    <Button variant="outline" className="flex-1 min-w-[100px]" disabled={saving} onClick={() => setShowCreateModal(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 min-w-[100px]"
                      disabled={saving}
                      onClick={() => void confirmCreate(false)}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Save as Draft
                    </Button>
                    <Button className="flex-1 min-w-[100px]" disabled={saving} onClick={() => void confirmCreate(true)}>
                      Publish
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {(() => {
                        const TypeIcon = getTypeIcon(viewModalContent.type);
                        return (
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium border inline-flex items-center gap-1 ${getTypeColor(viewModalContent.type)}`}
                          >
                            <TypeIcon className="w-3 h-3" />
                            {viewModalContent.type}
                          </span>
                        );
                      })()}
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(viewModalContent.status)}`}
                      >
                        {viewModalContent.status}
                      </span>
                      {viewModalContent.isBuiltin && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100">Built-in</span>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{viewModalContent.title}</h2>
                    <p className="text-gray-600">{viewModalContent.excerpt}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setViewModalContent(null)}>
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
                        <span key={i} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
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
                        const cur = viewModalContent;
                        setViewModalContent(null);
                        handleEditContent(cur);
                      }}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Content
                    </Button>
                    <Button variant="outline" onClick={() => setViewModalContent(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {editModalContent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => !saving && setEditModalContent(null)}
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
                      <p className="text-sm text-gray-600">Updates the linked wellness tool in the API</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => !saving && setEditModalContent(null)}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <Input
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={editForm.type}
                        onChange={(e) =>
                          setEditForm({ ...editForm, type: e.target.value as Content["type"] })
                        }
                      >
                        <option value="article">Article</option>
                        <option value="video">Video</option>
                        <option value="audio">Audio</option>
                        <option value="exercise">Exercise</option>
                        <option value="guide">Guide</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={editForm.category}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            category: e.target.value as WellnessToolCategory,
                          })
                        }
                      >
                        {WELLNESS_TOOL_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Excerpt</label>
                    <textarea
                      className="w-full p-3 border rounded-lg"
                      rows={3}
                      value={editForm.excerpt}
                      onChange={(e) => setEditForm({ ...editForm, excerpt: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                    <Input
                      value={editForm.tags}
                      onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                      placeholder="e.g., anxiety, meditation, wellness"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg"
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value as Content["status"] })}
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="scheduled">Scheduled</option>
                    </select>
                  </div>

                  <div className="flex gap-3 pt-4 flex-wrap">
                    <Button
                      variant="outline"
                      className="flex-1 min-w-[100px]"
                      disabled={saving}
                      onClick={() => setEditModalContent(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 min-w-[100px]"
                      disabled={saving}
                      onClick={() => void confirmEditSave(false)}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Draft
                    </Button>
                    <Button className="flex-1 min-w-[100px]" disabled={saving} onClick={() => void confirmEditSave(true)}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Publish
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {deleteModalContent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => !saving && setDeleteModalContent(null)}
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
                    <p className="text-sm text-gray-600">This removes the wellness tool from the API</p>
                  </div>
                </div>

                <p className="text-gray-700 mb-6">
                  Are you sure you want to delete <strong>&quot;{deleteModalContent.title}&quot;</strong>?
                </p>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" disabled={saving} onClick={() => setDeleteModalContent(null)}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    disabled={
                      saving ||
                      deleteModalContent.isBuiltin ||
                      isBuiltinWellnessListId(deleteModalContent.id) ||
                      isWellnessPlaceholderId(deleteModalContent.id)
                    }
                    onClick={() => void confirmDelete()}
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
