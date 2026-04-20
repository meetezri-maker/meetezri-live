import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { AppLayout } from "@/app/components/AppLayout";
import {
  BookOpen,
  Video,
  Headphones,
  FileText,
  Search,
  Star,
  Clock,
  Play,
  Download,
  Bookmark,
  Heart,
  TrendingUp,
  Award,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { AnimatedCard } from "@/app/components/AnimatedCard";
import { Link } from "react-router-dom";
import { WELLNESS_TOOL_CATEGORIES } from "@/lib/wellnessToolCategories";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { WELLNESS_BUILTIN_TOOLS_ADMIN } from "@/lib/wellnessBuiltinToolsMetadata";
import { mergeApiBuiltinsForAdmin } from "@/lib/mergeAdminWellnessTools";

interface Resource {
  id: string;
  source: "api" | "builtin";
  title: string;
  description: string;
  type: "article" | "video" | "audio" | "exercise";
  category: string;
  duration: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  rating: number;
  views: number;
  thumbnail: string;
  isFavorite: boolean;
  tags: string[];
  contentUrl?: string | null;
}

export function Resources() {
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [resourcesData, setResourcesData] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalResources: 0,
    favorites: 0,
    completed: 0,
    hoursSpent: 0,
  });

  const mapBuiltinType = (category: string): Resource["type"] => {
    if (category === "Exercise") return "exercise";
    if (category === "Sleep Health" || category === "Relaxation") return "audio";
    return "article";
  };

  const mapApiType = (category: string): Resource["type"] => {
    if (category === "Exercise") return "exercise";
    if (category === "Sleep Health" || category === "Relaxation") return "audio";
    return "article";
  };

  useEffect(() => {
    const loadResources = async () => {
      try {
        setLoading(true);
        const [toolsRes, progressRes, statsRes] = await Promise.all([
          api.wellness.getAll(),
          api.wellness.getProgress(),
          api.wellness.getStats(),
        ]);

        const toolList = Array.isArray(toolsRes) ? toolsRes : [];
        const publishedTools = toolList.filter((t: any) => !t.status || t.status === "published");

        const builtins: Resource[] = WELLNESS_BUILTIN_TOOLS_ADMIN.map((t) => ({
          id: `builtin:${t.id}`,
          source: "builtin",
          title: t.title,
          description: t.description,
          type: mapBuiltinType(t.category),
          category: t.category,
          duration: t.duration,
          difficulty: "beginner",
          rating: 0,
          views: 0,
          thumbnail: "🧠",
          isFavorite: false,
          tags: [t.category],
          contentUrl: null,
        }));

        const apiItems: Resource[] = publishedTools.map((t: any) => ({
          id: t.id,
          source: "api",
          title: t.title || "Untitled",
          description: t.description || "Wellness content",
          type: mapApiType(t.category || ""),
          category: t.category || "General",
          duration:
            typeof t.duration_seconds === "number" && t.duration_seconds > 0
              ? `${Math.max(1, Math.round(t.duration_seconds / 60))} min`
              : t.duration_minutes
                ? `${t.duration_minutes} min`
                : "—",
          difficulty:
            String(t.difficulty || "Beginner").toLowerCase() === "advanced"
              ? "advanced"
              : String(t.difficulty || "Beginner").toLowerCase() === "intermediate"
                ? "intermediate"
                : "beginner",
          rating: Number(t.rating) || 0,
          views: Number(t.usage_count) || 0,
          thumbnail: "📘",
          isFavorite: Boolean(t.is_favorite),
          tags: [t.category].filter(Boolean),
          contentUrl: t.content_url || null,
        }));

        const merged = mergeApiBuiltinsForAdmin(builtins, apiItems);
        setResourcesData(merged);

        const progressList = Array.isArray(progressRes) ? progressRes : [];
        const apiStats = (statsRes || {}) as Record<string, unknown>;
        setStats({
          totalResources: merged.length,
          favorites: merged.filter((r) => r.isFavorite).length,
          completed: progressList.length,
          hoursSpent: Math.max(
            0,
            Math.round((Number(apiStats.totalDurationSeconds || 0) / 3600) * 10) / 10
          ),
        });
      } catch (error) {
        console.error(error);
        toast.error("Failed to load resources");
      } finally {
        setLoading(false);
      }
    };

    void loadResources();
  }, []);

  const types = [
    { id: "all", label: "All Resources", icon: BookOpen },
    { id: "article", label: "Articles", icon: FileText },
    { id: "video", label: "Videos", icon: Video },
    { id: "audio", label: "Audio", icon: Headphones },
    { id: "exercise", label: "Exercises", icon: Award },
  ];

  const categories = ["All Categories", ...WELLNESS_TOOL_CATEGORIES];

  const filteredResources = useMemo(
    () =>
      resourcesData.filter((resource) => {
        const matchesType = selectedType === "all" || resource.type === selectedType;
        const matchesCategory =
          selectedCategory === "all" ||
          selectedCategory === "All Categories" ||
          resource.category === selectedCategory;
        const matchesSearch =
          searchQuery === "" ||
          resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          resource.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          resource.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

        return matchesType && matchesCategory && matchesSearch;
      }),
    [resourcesData, searchQuery, selectedCategory, selectedType]
  );

  const getTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      article: FileText,
      video: Video,
      audio: Headphones,
      exercise: Award,
    };
    return icons[type as keyof typeof icons] || BookOpen;
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors = {
      beginner: "text-green-700 bg-green-100",
      intermediate: "text-yellow-700 bg-yellow-100",
      advanced: "text-red-700 bg-red-100",
    };
    return colors[difficulty as keyof typeof colors] || colors.beginner;
  };

  const handleToggleFavorite = async (resource: Resource) => {
    if (resource.source !== "api") {
      toast.info("Built-in resources are always available");
      return;
    }
    try {
      await api.wellness.toggleFavorite(resource.id);
      setResourcesData((prev) =>
        prev.map((r) => (r.id === resource.id ? { ...r, isFavorite: !r.isFavorite } : r))
      );
    } catch {
      toast.error("Failed to update favorite");
    }
  };

  const handleStartResource = async (resource: Resource) => {
    if (resource.source === "api") {
      try {
        await api.wellness.startSession(resource.id);
      } catch {
        toast.error("Could not start session");
      }
    }
    if (resource.contentUrl) {
      window.open(resource.contentUrl, "_blank", "noopener,noreferrer");
    } else {
      toast.success(`Started: ${resource.title}`);
    }
  };

  const handleBookmarkResource = (resource: Resource) => {
    void handleToggleFavorite(resource);
  };

  const handleDownloadResource = (resource: Resource) => {
    if (resource.contentUrl) {
      window.open(resource.contentUrl, "_blank", "noopener,noreferrer");
      return;
    }
    toast.info("Download is available for linked resources only");
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading && (
            <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading resources...
            </div>
          )}

          <div className="mb-8">
            <Link 
              to="/app/settings" 
              className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200 mb-6 transition-colors font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Settings
            </Link>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Resources Library</h1>
                <p className="text-gray-600 dark:text-slate-400">Curated content for your wellness journey</p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <AnimatedCard delay={0.1}>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalResources}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Total Resources</p>
                </div>
              </AnimatedCard>

              <AnimatedCard delay={0.15}>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <Heart className="w-6 h-6 text-red-600 dark:text-red-400" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.favorites}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Favorites</p>
                </div>
              </AnimatedCard>

              <AnimatedCard delay={0.2}>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <Award className="w-6 h-6 text-green-600 dark:text-green-400" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completed}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Completed</p>
                </div>
              </AnimatedCard>

              <AnimatedCard delay={0.25}>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.hoursSpent}h</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Time Spent</p>
                </div>
              </AnimatedCard>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 space-y-4">
            {/* Type Filters */}
            <div className="flex flex-wrap gap-2">
              {types.map((type) => {
                const Icon = type.icon;
                const isActive = selectedType === type.id;
                return (
                  <motion.button
                    key={type.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedType(type.id)}
                    className={`px-4 py-2 rounded-xl flex items-center gap-2 font-semibold transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                        : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-800 hover:border-purple-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {type.label}
                  </motion.button>
                );
              })}
            </div>

            {/* Search & Category */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="w-5 h-5 text-gray-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 transition-all"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 transition-all"
              >
                {categories.map((category) => (
                  <option key={category} value={category} className="bg-white dark:bg-slate-900">
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Resources Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResources.map((resource, index) => {
              const TypeIcon = getTypeIcon(resource.type);
              
              return (
                <AnimatedCard key={resource.id} delay={index * 0.05}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden hover:border-purple-400 hover:shadow-lg transition-all"
                  >
                    {/* Thumbnail */}
                    <div className="relative h-48 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center">
                      <span className="text-6xl">{resource.thumbnail}</span>
                      <div className="absolute top-4 right-4">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className={`p-2 rounded-lg transition-all ${
                            resource.isFavorite
                              ? 'bg-red-500 text-white'
                              : 'bg-white/80 dark:bg-slate-900/80 text-gray-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900 hover:text-red-500'
                          }`}
                          onClick={() => void handleToggleFavorite(resource)}
                        >
                          <Heart className="w-5 h-5" fill={resource.isFavorite ? 'currentColor' : 'none'} />
                        </motion.button>
                      </div>
                      <div className="absolute top-4 left-4">
                        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl px-3 py-1 rounded-lg flex items-center gap-2 shadow-sm">
                          <TypeIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span className="text-sm font-semibold text-purple-900 dark:text-purple-300 capitalize">{resource.type}</span>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white pr-2 line-clamp-2">{resource.title}</h3>
                        <div className="flex items-center gap-1 text-yellow-500">
                          <Star className="w-4 h-4" fill="currentColor" />
                          <span className="text-sm font-semibold">{resource.rating}</span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-4 line-clamp-2">{resource.description}</p>

                      {/* Meta Info */}
                      <div className="flex items-center justify-between mb-4 text-sm text-gray-500 dark:text-slate-500">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{resource.duration}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          <span>{resource.views.toLocaleString()} views</span>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {resource.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg">
                            {tag}
                          </span>
                        ))}
                        <span className={`text-xs px-2 py-1 rounded-lg ${getDifficultyColor(resource.difficulty)}`}>
                          {resource.difficulty}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl text-white font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                          onClick={() => handleStartResource(resource)}
                        >
                          <Play className="w-4 h-4" />
                          Start
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-4 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
                          onClick={() => handleBookmarkResource(resource)}
                        >
                          <Bookmark className="w-5 h-5" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-4 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
                          onClick={() => handleDownloadResource(resource)}
                        >
                          <Download className="w-5 h-5" />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                </AnimatedCard>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}