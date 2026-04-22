import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { AppLayout } from "@/app/components/AppLayout";
import {
  FileText,
  Search,
  Star,
  Clock,
  BookOpen,
  Heart,
  TrendingUp,
  ArrowLeft,
  Loader2,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { AnimatedCard } from "@/app/components/AnimatedCard";
import { Link, useNavigate } from "react-router-dom";
import {
  WELLNESS_TOOL_CATEGORIES,
  WELLNESS_CATEGORY_GRADIENT,
  isWellnessToolCategory,
} from "@/lib/wellnessToolCategories";
import { WELLNESS_CATEGORY_ICONS } from "@/lib/wellnessCategoryIcons";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { WELLNESS_BUILTIN_TOOLS_ADMIN } from "@/lib/wellnessBuiltinToolsMetadata";
import type { LucideIcon } from "lucide-react";

interface Article {
  id: string;
  source: "api" | "builtin";
  title: string;
  description: string;
  category: string;
  duration: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  rating: number;
  views: number;
  isFavorite: boolean;
  tags: string[];
  contentUrl?: string | null;
}

// NOTE: Built-in articles must use IDs that `ResourceArticlePage` can resolve (`builtin:<id>`),
// so we take them directly from `WELLNESS_BUILTIN_TOOLS_ADMIN`.

function categoryVisuals(category: string): { gradient: string; Icon: LucideIcon } {
  if (isWellnessToolCategory(category)) {
    return {
      gradient: WELLNESS_CATEGORY_GRADIENT[category],
      Icon: WELLNESS_CATEGORY_ICONS[category],
    };
  }
  return { gradient: "from-slate-500 to-slate-700", Icon: Sparkles };
}

export function Resources() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadArticles = async () => {
      try {
        setLoading(true);
        const toolsRes = await api.wellness.getAll();

        const toolList = Array.isArray(toolsRes) ? toolsRes : [];
        const publishedTools = toolList.filter((t: any) => !t.status || t.status === "published");

        const builtins: Article[] = WELLNESS_BUILTIN_TOOLS_ADMIN.map((t) => ({
          id: `builtin:${t.id}`,
          source: "builtin",
          title: t.title,
          description: t.description,
          category: t.category,
          duration: t.duration,
          difficulty: "beginner",
          rating: 0,
          views: 0,
          isFavorite: false,
          tags: [t.category],
          contentUrl: null,
        }));

        const apiItems: Article[] = publishedTools.map((t: any) => ({
          id: t.id,
          source: "api",
          title: t.title || "Untitled",
          description: t.description || "Wellness content",
          category: t.category || "General",
          duration:
            typeof t.duration_seconds === "number" && t.duration_seconds > 0
              ? `${Math.max(1, Math.round(t.duration_seconds / 60))} min read`
              : t.duration_minutes
                ? `${t.duration_minutes} min read`
                : "—",
          difficulty:
            String(t.difficulty || "Beginner").toLowerCase() === "advanced"
              ? "advanced"
              : String(t.difficulty || "Beginner").toLowerCase() === "intermediate"
                ? "intermediate"
                : "beginner",
          rating: Number(t.rating) || 0,
          views: Number(t.usage_count) || 0,
          isFavorite: Boolean(t.is_favorite),
          tags: [t.category].filter(Boolean),
          contentUrl: t.content_url || null,
        }));

        // Keep built-in reading articles always visible, then add API items.
        setArticles([...builtins, ...apiItems]);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load articles");
      } finally {
        setLoading(false);
      }
    };

    void loadArticles();
  }, []);

  const filteredArticles = useMemo(
    () =>
      articles.filter((article) => {
        const matchesCategory = selectedCategory === "all" || article.category === selectedCategory;
        const matchesSearch =
          searchQuery === "" ||
          article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          article.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          article.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
      }),
    [articles, searchQuery, selectedCategory]
  );

  const getDifficultyColor = (difficulty: string) => {
    const colors = {
      beginner: "text-emerald-800 bg-emerald-100 dark:text-emerald-200 dark:bg-emerald-950/60",
      intermediate: "text-amber-800 bg-amber-100 dark:text-amber-200 dark:bg-amber-950/60",
      advanced: "text-rose-800 bg-rose-100 dark:text-rose-200 dark:bg-rose-950/60",
    };
    return colors[difficulty as keyof typeof colors] || colors.beginner;
  };

  const handleToggleFavorite = async (article: Article) => {
    if (article.source !== "api") {
      toast.info("Favorite articles from your care team in Wellness Tools.");
      return;
    }
    try {
      await api.wellness.toggleFavorite(article.id);
      setArticles((prev) =>
        prev.map((a) => (a.id === article.id ? { ...a, isFavorite: !a.isFavorite } : a))
      );
    } catch {
      toast.error("Failed to update favorite");
    }
  };

  const handleOpenArticle = (article: Article) => {
    navigate(`/app/settings/resources/article/${encodeURIComponent(article.id)}`);
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-violet-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-violet-950/20 transition-colors duration-300">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 dark:bg-slate-950/60 backdrop-blur-sm">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-violet-600 dark:text-violet-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Loading articles</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Preparing your reading library…</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <Link
            to="/app/settings"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 mb-6 transition-colors font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Link>

          <header className="mb-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-100/90 dark:bg-violet-950/80 px-3 py-1 text-xs font-semibold text-violet-800 dark:text-violet-200 mb-4">
              <FileText className="h-3.5 w-3.5" />
              Articles
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
              Reading library
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-base max-w-2xl leading-relaxed">
              Short reads and guided reflections from Ezri and your care team—articles only, organized by topic.
            </p>
          </header>

          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                placeholder="Search articles…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-900 transition-all"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="sm:w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-900 transition-all"
            >
              <option value="all">All categories</option>
              {WELLNESS_TOOL_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
              <option value="General">General</option>
            </select>
          </div>

          {!loading && filteredArticles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/40 px-6 py-16 text-center">
              <BookOpen className="h-10 w-10 text-violet-500 mx-auto mb-4" />
              <p className="text-lg font-semibold text-slate-900 dark:text-white">No articles match</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-md mx-auto">
                Try another category or clear your search.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-4 py-2 text-sm font-semibold text-white dark:text-slate-900"
              >
                Reset filters
              </button>
            </div>
          ) : !loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
              {filteredArticles.map((article, index) => {
                const { gradient, Icon: CategoryIcon } = categoryVisuals(article.category);
                const showRating = article.rating > 0;
                const showViews = article.source === "api" && article.views > 0;

                return (
                  <AnimatedCard key={article.id} delay={index * 0.04}>
                    <motion.div
                      whileHover={{ y: -2 }}
                      className="h-full flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden hover:border-violet-300/80 dark:hover:border-violet-800 hover:shadow-lg hover:shadow-violet-500/5 transition-all"
                    >
                      <div
                        className={`relative h-40 bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}
                      >
                        <CategoryIcon
                          className="h-16 w-16 text-white/90 drop-shadow-lg"
                          strokeWidth={1.25}
                          aria-hidden
                        />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)] opacity-80 dark:opacity-30" />
                        <div className="absolute top-3 right-3">
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.06 }}
                            whileTap={{ scale: 0.94 }}
                            className={`p-2 rounded-xl transition-all backdrop-blur-md ${
                              article.isFavorite
                                ? "bg-white text-rose-600 shadow"
                                : "bg-black/20 text-white hover:bg-black/30"
                            }`}
                            onClick={() => void handleToggleFavorite(article)}
                            aria-label={article.isFavorite ? "Remove favorite" : "Add favorite"}
                          >
                            <Heart className="w-5 h-5" fill={article.isFavorite ? "currentColor" : "none"} />
                          </motion.button>
                        </div>
                        <div className="absolute top-3 left-3 flex flex-col gap-2">
                          <div className="bg-white/95 dark:bg-slate-950/90 backdrop-blur-md px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                            <FileText className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">Article</span>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-black/25 text-white w-fit">
                            {article.source === "builtin" ? "Ezri" : "Your team"}
                          </span>
                        </div>
                      </div>

                      <div className="p-5 flex flex-col flex-1">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
                            {article.title}
                          </h2>
                          {showRating ? (
                            <div className="flex items-center gap-0.5 text-amber-500 shrink-0">
                              <Star className="w-4 h-4" fill="currentColor" />
                              <span className="text-xs font-bold tabular-nums">{article.rating.toFixed(1)}</span>
                            </div>
                          ) : null}
                        </div>

                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 flex-1">
                          {article.description}
                        </p>

                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-4 text-xs text-slate-500 dark:text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {article.duration}
                          </span>
                          {showViews ? (
                            <span className="inline-flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5" />
                              {article.views.toLocaleString()} opens
                            </span>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-200 font-medium">
                            {article.category}
                          </span>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-md font-medium capitalize ${getDifficultyColor(article.difficulty)}`}
                          >
                            {article.difficulty}
                          </span>
                        </div>

                        <div className="flex gap-2 mt-5">
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-violet-500/20"
                            onClick={() => handleOpenArticle(article)}
                          >
                            <BookOpen className="w-4 h-4" />
                            Read
                          </motion.button>
                          {article.contentUrl ? (
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                              onClick={() =>
                                window.open(article.contentUrl!, "_blank", "noopener,noreferrer")
                              }
                              aria-label="Open in new tab"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </motion.button>
                          ) : null}
                        </div>
                      </div>
                    </motion.div>
                  </AnimatedCard>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
