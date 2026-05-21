import { Skeleton } from "@/app/components/ui/skeleton";
import { AdminPaginationBar } from "@/app/components/admin/AdminPaginationBar";
import { useAuth } from "@/app/contexts/AuthContext";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Activity,
  RefreshCw,
  BookOpen,
  Video,
  Zap,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queries";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import { MOOD_CHECKIN_IMAGES } from "@/lib/solace/moodCheckInImages";
import { cn } from "@/lib/utils";
import {
  notificationsBackLink,
  notificationsBtnGhost,
  notificationsGlassCard,
  notificationsHeroAccent,
  notificationsHeroCard,
  notificationsHeroImage,
  notificationsHeroOverlayLeft,
  notificationsHeroOverlayPurple,
  notificationsHeroOverlayWarmth,
  notificationsHeroTitle,
  notificationsIconChip,
  notificationsPageAtmosphere,
  notificationsPageFogMid,
  notificationsPageGlowTop,
  notificationsPageVignette,
  notificationsTimelinePanel,
  notificationsTimelineRow,
} from "@/app/pages/app/notifications-settings/notificationsSettingsUi";

const ACTIVITY_HISTORY_LIMIT = 100;
const DEFAULT_PAGE_SIZE = 10;

interface RecentActivityItem {
  id: string;
  type: string;
  text: string;
  created_at: string;
  mood?: string;
}

const MOOD_EMOJIS: Record<string, string> = {
  happy: "😊",
  calm: "😌",
  excited: "🤩",
  energetic: "⚡",
  nervous: "😬",
  anxious: "😰",
  sad: "😢",
  angry: "😡",
  overwhelmed: "😰",
  hopeful: "🤩",
  tired: "😌",
  heavy: "😢",
  grateful: "😊",
  numb: "😐",
};

function normalizeActivityRows(raw: unknown): RecentActivityItem[] {
  if (Array.isArray(raw)) return raw as RecentActivityItem[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)) {
    return (raw as { items: RecentActivityItem[] }).items;
  }
  return [];
}

function getEmoji(type: string, mood?: string) {
  if (type === "mood" && mood) {
    const normalized = String(mood).trim().toLowerCase();
    return MOOD_EMOJIS[normalized] ?? "😐";
  }
  if (type === "journal") return "📓";
  if (type === "session") return "🎥";
  if (type === "event") return "⚡";
  return "📝";
}

function activityVisual(type: string): {
  icon: LucideIcon;
  tone: "pink" | "cyan" | "violet" | "amber";
  useEmoji?: boolean;
} {
  if (type === "mood") return { icon: TrendingUp, tone: "pink", useEmoji: true };
  if (type === "journal") return { icon: BookOpen, tone: "violet" };
  if (type === "session") return { icon: Video, tone: "cyan" };
  if (type === "event") return { icon: Zap, tone: "amber" };
  return { icon: Activity, tone: "violet" };
}

export function RecentActivityHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const {
    data: activityRaw,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.activity.recent(user?.id, ACTIVITY_HISTORY_LIMIT),
    queryFn: () => api.getRecentActivity(ACTIVITY_HISTORY_LIMIT),
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchOnMount: "always",
  });

  const items = useMemo(() => normalizeActivityRows(activityRaw), [activityRaw]);

  const mapped = useMemo(
    () =>
      items.map((row) => ({
        ...row,
        emoji: getEmoji(row.type, row.mood),
        relativeTime: formatDistanceToNow(new Date(row.created_at), { addSuffix: true }),
      })),
    [items]
  );

  const totalPages = Math.max(1, Math.ceil(mapped.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const atHistoryCap = mapped.length >= ACTIVITY_HISTORY_LIMIT;

  useEffect(() => {
    if (currentPage !== safePage) setCurrentPage(safePage);
  }, [currentPage, safePage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  const startIndex = (safePage - 1) * pageSize;
  const currentPageItems = mapped.slice(startIndex, startIndex + pageSize);

  const handleRefresh = () => {
    api.bustRecentActivityCache();
    void queryClient.invalidateQueries({
      queryKey: queryKeys.activity.recentForUser(user?.id),
    });
    void refetch();
  };

  const paginationDark = cn(
    notificationsGlassCard,
    "overflow-hidden p-0",
    "[&_button]:border-white/10 [&_button]:bg-[rgba(12,14,30,0.9)] [&_button]:text-white/80",
    "[&_select]:border-white/10 [&_select]:bg-[rgba(12,14,30,0.9)] [&_select]:text-violet-200",
    "[&_span]:text-[rgba(255,255,255,0.55)]"
  );

  if (isLoading) {
    return (
      <div className={notificationsPageAtmosphere}>
        <div className={notificationsPageGlowTop} aria-hidden />
        <div className={notificationsPageVignette} aria-hidden />
        <div className="relative z-10 mx-auto w-full max-w-[1100px] px-4 py-7 sm:px-7 sm:py-9">
          <Skeleton className="h-[260px] w-full rounded-[2rem] bg-white/5" />
          <div className="mt-6 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-3xl bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={notificationsPageAtmosphere}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className={notificationsPageGlowTop} aria-hidden />
      <motion.div className={notificationsPageFogMid} aria-hidden />
      <motion.div className={notificationsPageVignette} aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-[1100px] px-4 py-7 sm:px-7 sm:py-9">
        <section className={notificationsHeroCard}>
          <img
            src={MOOD_CHECKIN_IMAGES.heroBanner}
            alt=""
            className={notificationsHeroImage}
            loading="eager"
            decoding="async"
          />
          <div className={notificationsHeroOverlayLeft} aria-hidden />
          <div className={notificationsHeroOverlayPurple} aria-hidden />
          <div className={notificationsHeroOverlayWarmth} aria-hidden />

          <div className="relative flex min-h-[240px] flex-col justify-between p-6 sm:min-h-[260px] sm:p-8 lg:flex-row lg:items-end lg:gap-6">
            <div className="max-w-xl flex-1">
              <Link to="/app/dashboard" className={notificationsBackLink}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to Dashboard
              </Link>
              <h1 className={cn(notificationsHeroTitle, "mt-5")}>
                <span className={notificationsHeroAccent}>Recent Activity</span> History
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-[rgba(255,255,255,0.62)] sm:text-[15px]">
                Full timeline of your latest check-ins, journals, sessions, and app activity.
              </p>
            </div>

            <div className="mt-6 flex shrink-0 flex-wrap items-center gap-3 lg:mt-0 lg:justify-end">
              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/35 px-4 py-3 backdrop-blur-md">
                <div className={notificationsIconChip("violet")}>
                  <Activity className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums text-white">{mapped.length}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-violet-200/70">
                    {atHistoryCap ? "Latest loaded" : "Activities shown"}
                  </p>
                  {atHistoryCap ? (
                    <p className="mt-0.5 text-[10px] text-[rgba(255,255,255,0.42)]">Up to {ACTIVITY_HISTORY_LIMIT} most recent</p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isFetching}
                className={notificationsBtnGhost}
              >
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden />
                Refresh
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6">
          {isError ? (
            <div className={cn(notificationsGlassCard, "px-6 py-14 text-center")}>
              <p className="text-sm text-[rgba(255,255,255,0.55)]">Could not load activity history.</p>
              <button type="button" onClick={handleRefresh} className={cn(notificationsBtnGhost, "mt-4")}>
                Try again
              </button>
            </div>
          ) : mapped.length === 0 ? (
            <div className={cn(notificationsGlassCard, "px-6 py-14 text-center")}>
              <Activity className="mx-auto h-12 w-12 text-violet-300/30" aria-hidden />
              <h2 className="mt-4 font-serif text-xl text-white">No activity yet</h2>
              <p className="mt-2 text-sm text-[rgba(255,255,255,0.45)]">
                Start a mood check-in, journal entry, or session to see your activity history here.
              </p>
            </div>
          ) : (
            <>
              <div className={notificationsTimelinePanel}>
                {currentPageItems.map((entry) => {
                  const visual = activityVisual(entry.type);
                  const Icon = visual.icon;
                  return (
                    <div key={entry.id} className={notificationsTimelineRow}>
                      {visual.useEmoji ? (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 shadow-[0_0_18px_-6px_rgba(236,72,153,0.45)]">
                          <FluentEmoji emoji={entry.emoji} size={22} />
                        </div>
                      ) : (
                        <div className={notificationsIconChip(visual.tone)}>
                          <Icon className="h-4 w-4" aria-hidden />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">{entry.text}</p>
                        <p className="mt-0.5 text-[10px] text-[rgba(255,255,255,0.38)]">{entry.relativeTime}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={cn(paginationDark, "mt-4")}>
                <AdminPaginationBar
                  total={mapped.length}
                  page={safePage}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  selectId="recent-activity-page-size"
                  pageSizeOptions={[10, 25, 50, 100]}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </motion.div>
  );
}
