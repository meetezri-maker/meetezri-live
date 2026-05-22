import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Search,
  Star,
  Clock,
  BookOpen,
  Heart,
  TrendingUp,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Link, useNavigate } from "react-router-dom";
import { WELLNESS_TOOL_CATEGORIES } from "@/lib/wellnessToolCategories";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  categoryVisualsForReading,
  fetchReadingLibraryArticles,
  type ReadingLibraryArticle,
} from "@/lib/readingLibraryArticles";
import { SolaceSelect } from "@/app/solace";
import {
  RESOURCES_HERO_IMG,
  formatCategoryLabel,
  getDifficultyPillClass,
  getResourceCardAtmosphere,
  resourcesBackLink,
  resourcesCardShell,
  resourcesExternalBtn,
  resourcesFavoriteBtn,
  resourcesHeroCard,
  resourcesHeroGlowPurple,
  resourcesHeroGlowWarmth,
  resourcesHeroImage,
  resourcesHeroOverlay,
  resourcesHeroSubtitle,
  resourcesHeroTitle,
  resourcesPageAtmosphere,
  resourcesPageFogMid,
  resourcesPageGlowTop,
  resourcesPageVignette,
  resourcesReadBtn,
  resourcesSearchInput,
} from "@/app/pages/app/resources-library/resourcesLibraryUi";

type Article = ReadingLibraryArticle;

const RESOURCE_CARD_SKELETON_COUNT = 6;

function ResourcesSkeleton() {
  return (
    <motion.div
      className={resourcesPageAtmosphere}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      aria-busy="true"
      aria-label="Loading reading library"
    >
      <motion.div
        className={resourcesPageGlowTop}
        aria-hidden
        animate={{ opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className={resourcesPageFogMid} aria-hidden />
      <motion.div
        className={resourcesPageVignette}
        aria-hidden
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[min(100%,1400px)] px-4 pb-10 pt-5 sm:px-6 sm:pb-12 lg:px-8 lg:pt-6">
        <Skeleton className="min-h-[220px] w-full rounded-[1.75rem] bg-white/[0.06] sm:min-h-[260px] lg:min-h-[300px]" />

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-11 min-h-[44px] w-full flex-1 rounded-full bg-white/[0.06]" />
          <Skeleton className="h-11 min-h-[44px] w-full rounded-full bg-white/[0.06] sm:w-52" />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 pb-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {Array.from({ length: RESOURCE_CARD_SKELETON_COUNT }).map((_, i) => (
            <div
              key={i}
              className="flex h-full flex-col overflow-hidden rounded-[1.4rem] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(16,16,36,0.6)_0%,rgba(9,9,22,0.75)_100%)]"
            >
              <Skeleton className="h-[148px] w-full rounded-none bg-white/[0.06]" />
              <div className="flex flex-1 flex-col gap-3 p-4 sm:p-[1.125rem]">
                <Skeleton className="h-5 w-[80%] rounded-md bg-white/[0.06]" />
                <Skeleton className="h-4 w-full rounded-md bg-white/[0.06]" />
                <Skeleton className="h-4 w-full rounded-md bg-white/[0.06]" />
                <Skeleton className="h-4 w-2/3 rounded-md bg-white/[0.06]" />
                <div className="mt-1 flex gap-2">
                  <Skeleton className="h-3.5 w-16 rounded-md bg-white/[0.06]" />
                  <Skeleton className="h-3.5 w-20 rounded-md bg-white/[0.06]" />
                  <Skeleton className="h-5 w-14 rounded-md bg-white/[0.06]" />
                </div>
                <Skeleton className="mt-2 h-11 w-full rounded-xl bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>

        <footer className="pt-2 text-center">
          <Skeleton className="mx-auto h-4 w-56 rounded-md bg-white/[0.06]" />
          <Skeleton className="mx-auto mt-2 h-3 w-72 rounded-md bg-white/[0.06]" />
        </footer>
      </div>
    </motion.div>
  );
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
        const list = await fetchReadingLibraryArticles();
        setArticles(list);
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

  if (loading) {
    return <ResourcesSkeleton />;
  }

  return (
    <motion.div
      className={resourcesPageAtmosphere}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className={resourcesPageGlowTop}
        aria-hidden
        animate={{ opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className={resourcesPageFogMid} aria-hidden />
      <motion.div
        className={resourcesPageVignette}
        aria-hidden
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[min(100%,1400px)] px-4 pb-10 pt-5 sm:px-6 sm:pb-12 lg:px-8 lg:pt-6">
        {/* 1. Cinematic hero */}
        <section className={resourcesHeroCard} aria-labelledby="reading-library-title">
          <img
            src={RESOURCES_HERO_IMG}
            alt=""
            className={resourcesHeroImage}
            width={1600}
            height={640}
          />
          <motion.div
            className={resourcesHeroOverlay}
            aria-hidden
            animate={{ opacity: [0.92, 1, 0.92] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className={resourcesHeroGlowPurple}
            aria-hidden
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className={resourcesHeroGlowWarmth}
            aria-hidden
            animate={{ opacity: [0.65, 0.95, 0.65] }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          />
          <div
            className="pointer-events-none absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.45)]"
            aria-hidden
          />

          <div className="relative z-10 flex min-h-[220px] flex-col justify-end p-6 sm:min-h-[260px] sm:p-8 lg:min-h-[300px] lg:p-10">
            <Link to="/app/settings" className={resourcesBackLink}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to Resources
            </Link>
            <h1 id="reading-library-title" className={cn(resourcesHeroTitle, "mt-4")}>
              Reading Library
            </h1>
            <p className={resourcesHeroSubtitle}>
              Browse and explore all resources for self-growth, healing, and transformation.
            </p>
          </div>
        </section>

        {/* 2. Search + filter row */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <motion.div
            className="relative flex-1"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.35 }}
          >
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[rgba(255,255,255,0.38)]"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={resourcesSearchInput}
              aria-label="Search resources"
            />
          </motion.div>

          <motion.div
            className="flex shrink-0 gap-2 sm:w-auto"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.35 }}
          >
            <SolaceSelect
              value={selectedCategory}
              onValueChange={setSelectedCategory}
              ariaLabel="Filter by category"
              variant="default"
              triggerClassName="min-h-[44px] w-full rounded-full sm:w-52"
              options={[
                { value: "all", label: "All categories" },
                ...WELLNESS_TOOL_CATEGORIES.map((category) => ({
                  value: category,
                  label: category,
                })),
                { value: "General", label: "General" },
              ]}
            />
          </motion.div>
        </div>

        {/* 3. Resource grid */}
        {filteredArticles.length === 0 ? (
          <motion.div
            className="mt-8 rounded-[1.4rem] border border-dashed border-white/[0.12] bg-[linear-gradient(180deg,rgba(16,16,36,0.6)_0%,rgba(9,9,22,0.75)_100%)] px-6 py-16 text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <BookOpen className="mx-auto mb-4 h-10 w-10 text-violet-300/80" aria-hidden />
            <p className="text-lg font-semibold text-white">No resources match</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-[rgba(255,255,255,0.48)]">
              Try another category or clear your search.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
              className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/15 px-5 py-2 text-sm font-semibold text-violet-100 transition-colors hover:bg-violet-500/25"
            >
              Reset filters
            </button>
          </motion.div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-5 pb-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {filteredArticles.map((article, index) => {
              const { Icon: CategoryIcon } = categoryVisualsForReading(article.category);
              const atmosphere = getResourceCardAtmosphere(article.category);
              const showRating = article.rating > 0;
              const showViews = article.source === "api" && article.views > 0;
              const extraTags = article.tags.filter(
                (tag) => tag.toLowerCase() !== article.category.toLowerCase()
              );

              return (
                <motion.article
                  key={article.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                  className={resourcesCardShell}
                >
                  {/* Top visual atmosphere */}
                  <motion.div
                    className={cn("relative h-[148px] overflow-hidden", atmosphere.visualBg)}
                    whileHover={{ scale: 1.01 }}
                    transition={{ duration: 0.35 }}
                  >
                    <div className={cn("absolute inset-0", atmosphere.radialGlow)} aria-hidden />
                    <motion.div
                      className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.08),transparent_55%)]"
                      aria-hidden
                      animate={{ opacity: [0.5, 0.85, 0.5] }}
                      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    />

                    <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                      <span
                        className={cn(
                          "w-fit rounded-lg border px-2.5 py-1 text-[10px] font-bold tracking-[0.14em]",
                          atmosphere.pillClass
                        )}
                      >
                        {formatCategoryLabel(article.category)}
                      </span>
                      {extraTags.length > 0
                        ? extraTags.slice(0, 1).map((tag) => (
                            <span
                              key={tag}
                              className="w-fit rounded-lg border border-white/10 bg-black/30 px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] text-white/70 uppercase"
                            >
                              {tag}
                            </span>
                          ))
                        : null}
                    </div>

                    <div className="absolute top-3 right-3">
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.94 }}
                        className={resourcesFavoriteBtn(article.isFavorite)}
                        onClick={() => void handleToggleFavorite(article)}
                        aria-label={article.isFavorite ? "Remove favorite" : "Add favorite"}
                      >
                        <Heart
                          className="h-4 w-4"
                          fill={article.isFavorite ? "currentColor" : "none"}
                          strokeWidth={1.75}
                        />
                      </motion.button>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center">
                      <CategoryIcon
                        className={cn("h-[4.25rem] w-[4.25rem]", atmosphere.iconClass)}
                        strokeWidth={1.15}
                        aria-hidden
                      />
                    </div>
                  </motion.div>

                  {/* Card body */}
                  <div className="flex flex-1 flex-col p-4 sm:p-[1.125rem]">
                    <motion.div
                      className="mb-2 flex items-start justify-between gap-2"
                      initial={false}
                      whileHover={{ x: 1 }}
                      transition={{ duration: 0.25 }}
                    >
                      <h2 className="line-clamp-2 text-[0.95rem] font-bold leading-snug text-white">
                        {article.title}
                      </h2>
                      {showRating ? (
                        <div className="flex shrink-0 items-center gap-0.5 text-amber-300/90">
                          <Star className="h-3.5 w-3.5" fill="currentColor" aria-hidden />
                          <span className="text-xs font-bold tabular-nums">{article.rating.toFixed(1)}</span>
                        </div>
                      ) : null}
                    </motion.div>

                    <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-[rgba(255,255,255,0.48)]">
                      {article.description}
                    </p>

                    <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[rgba(255,255,255,0.42)]">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {article.duration}
                      </span>
                      {showViews ? (
                        <span className="inline-flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                          {article.views.toLocaleString()} opens
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[10px] font-semibold capitalize",
                          getDifficultyPillClass(article.difficulty)
                        )}
                      >
                        {article.difficulty}
                      </span>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={resourcesReadBtn}
                        onClick={() => handleOpenArticle(article)}
                      >
                        <BookOpen className="h-4 w-4" aria-hidden />
                        Read
                      </motion.button>
                      {article.contentUrl ? (
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={resourcesExternalBtn}
                          onClick={() =>
                            window.open(article.contentUrl!, "_blank", "noopener,noreferrer")
                          }
                          aria-label="Open in new tab"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </motion.button>
                      ) : null}
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}

        {/* 4. Footer */}
        <footer className="pt-2 text-center">
          <p className="text-sm text-[rgba(255,255,255,0.42)]">Made with care for your wellbeing</p>
          <p className="mt-1 text-xs text-[rgba(255,255,255,0.32)]">
            Solace v1.0.0 • © 2026 •{" "}
            <Link to="/privacy" className="underline-offset-2 hover:text-violet-300/80 hover:underline">
              Privacy
            </Link>{" "}
            •{" "}
            <Link to="/terms" className="underline-offset-2 hover:text-violet-300/80 hover:underline">
              Terms
            </Link>
          </p>
        </footer>
      </div>
    </motion.div>
  );
}
