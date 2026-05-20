import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Video,
  Award,
  MessageSquare,
  Calendar,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Heart,
  Flame,
  BookOpen,
  Shield,
  Users,
  CreditCard,
  Sparkles,
  Headphones,
} from "lucide-react";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useNotifications } from "@/app/contexts/NotificationsContext";
import type { Notification } from "@/app/contexts/NotificationsContext";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { AdminPaginationBar } from "@/app/components/admin/AdminPaginationBar";
import { cn } from "@/lib/utils";
import {
  NOTIFICATIONS_HERO_IMG,
  notificationsActionPill,
  notificationsBackLink,
  notificationsBtnGhost,
  notificationsFilterPill,
  notificationsGlassCard,
  notificationsGroupLabel,
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
  notificationsPriorityCard,
  notificationsSearchInput,
  notificationsTimelinePanel,
  notificationsTimelineRow,
} from "@/app/pages/app/notifications-settings/notificationsSettingsUi";
import {
  getActionPill,
  getNotificationCategory,
  groupNotifications,
  matchesCategory,
  matchesSearch,
  pickPriorityMoments,
  type NotificationCategory,
  type TimelineGroup,
} from "@/app/pages/app/notifications-settings/notificationGrouping";
import { NotificationsWellnessRail } from "@/app/pages/app/notifications-settings/NotificationsWellnessRail";

const DEFAULT_PAGE_SIZE = 20;

const CATEGORY_FILTERS: { id: NotificationCategory; icon: LucideIcon }[] = [
  { id: "All", icon: Bell },
  { id: "Wellness", icon: Heart },
  { id: "Streaks", icon: Flame },
  { id: "Journal", icon: BookOpen },
  { id: "Support", icon: Headphones },
  { id: "Community", icon: Users },
  { id: "Security", icon: Shield },
  { id: "Billing", icon: CreditCard },
  { id: "Achievements", icon: Sparkles },
];

const TIMELINE_ORDER: TimelineGroup[] = ["TODAY", "YESTERDAY", "EARLIER THIS WEEK"];

const PRIORITY_META: Record<
  string,
  { tone: "pink" | "amber" | "violet"; icon: LucideIcon; fallbackTitle: string; fallbackMessage: string }
> = {
  Wellness: {
    tone: "pink",
    icon: Heart,
    fallbackTitle: "Time for your mood check-in",
    fallbackMessage: "How are you feeling today? Your check-in helps you track your progress.",
  },
  Streaks: {
    tone: "amber",
    icon: Flame,
    fallbackTitle: "Protect your 7-day streak",
    fallbackMessage: "A short session today will keep your streak alive.",
  },
  Journal: {
    tone: "violet",
    icon: BookOpen,
    fallbackTitle: "Your journal is waiting for you",
    fallbackMessage: "Write freely. Reflect deeply. You've got this.",
  },
};

export function Notifications() {
  const { notifications: allNotifications, unreadCount, markAsRead, markAllAsRead, isLoading } =
    useNotifications();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>("All");
  const [quietMode, setQuietMode] = useState(false);

  const filteredNotifications = useMemo(
    () =>
      allNotifications.filter(
        (n) => matchesCategory(n, activeCategory) && matchesSearch(n, searchQuery)
      ),
    [allNotifications, activeCategory, searchQuery]
  );

  const total = filteredNotifications.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const paginatedNotifications = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredNotifications.slice(start, start + pageSize);
  }, [filteredNotifications, safePage, pageSize]);

  const priorityMoments = useMemo(
    () => pickPriorityMoments(filteredNotifications),
    [filteredNotifications]
  );

  const groupedTimeline = useMemo(
    () => groupNotifications(paginatedNotifications),
    [paginatedNotifications]
  );

  const readCount = useMemo(
    () => allNotifications.filter((n) => n.is_read === true).length,
    [allNotifications]
  );

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  useEffect(() => {
    setPage(1);
  }, [activeCategory, searchQuery, pageSize]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [safePage, pageSize]);

  const getRelativeTime = (value: string | null | undefined) => {
    if (!value) return "Just now";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Just now";
    return formatDistanceToNow(date, { addSuffix: true });
  };

  const getNotificationStyle = (type: string) => {
    switch (type) {
      case "mood":
        return { icon: TrendingUp, tone: "pink" as const };
      case "session":
        return { icon: Video, tone: "cyan" as const };
      case "achievement":
        return { icon: Award, tone: "blue" as const };
      case "reminder":
        return { icon: Calendar, tone: "violet" as const };
      case "message":
        return { icon: MessageSquare, tone: "emerald" as const };
      case "safety":
      case "alert":
        return { icon: AlertTriangle, tone: "amber" as const };
      case "system":
      default:
        return { icon: Bell, tone: "violet" as const };
    }
  };

  const renderTimelineRow = (notification: Notification) => {
    const style = getNotificationStyle(notification.type);
    const Icon = style.icon;
    const actionPill = getActionPill(notification);

    return (
      <div
        key={notification.id}
        className={notificationsTimelineRow}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!notification.is_read) markAsRead(notification.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !notification.is_read) markAsRead(notification.id);
        }}
      >
        <motion.div className={notificationsIconChip(style.tone)}>
          <Icon className="h-4 w-4" aria-hidden />
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn(
                "text-sm font-semibold",
                notification.is_read ? "text-[rgba(255,255,255,0.45)]" : "text-white"
              )}
            >
              {notification.title}
            </h3>
            {actionPill ? (
              <span className={notificationsActionPill(actionPill.tone)}>{actionPill.label}</span>
            ) : null}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-[rgba(255,255,255,0.42)]">{notification.message}</p>
          <p className="mt-1 text-[10px] text-[rgba(255,255,255,0.32)]">{getRelativeTime(notification.created_at)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!notification.is_read ? (
            <span className="h-2 w-2 rounded-full bg-pink-400 shadow-[0_0_10px_2px_rgba(236,72,153,0.45)]" />
          ) : null}
          {!notification.is_read ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                markAsRead(notification.id);
              }}
              className="rounded-lg p-1.5 text-violet-300/70 transition-colors hover:bg-violet-500/15 hover:text-violet-200"
              title="Mark as read"
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
          ) : null}
          <ChevronRight className="h-4 w-4 text-[rgba(255,255,255,0.25)]" aria-hidden />
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={notificationsPageAtmosphere}>
        <div className={notificationsPageGlowTop} aria-hidden />
        <div className={notificationsPageVignette} aria-hidden />
        <div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9">
          <Skeleton className="h-[300px] w-full rounded-[2rem] bg-white/5" />
          <div className="mt-6 space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[88px] w-full rounded-3xl bg-white/5" />
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

      <div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
          <div className="min-w-0 space-y-6">
            <section className={notificationsHeroCard}>
              <img src={NOTIFICATIONS_HERO_IMG} alt="" className={notificationsHeroImage} />
              <div className={notificationsHeroOverlayLeft} aria-hidden />
              <div className={notificationsHeroOverlayPurple} aria-hidden />
              <div className={notificationsHeroOverlayWarmth} aria-hidden />

              <div className="relative flex h-full min-h-[280px] flex-col justify-between p-6 sm:min-h-[300px] sm:p-8 lg:min-h-[320px] lg:flex-row lg:items-center lg:gap-8">
                <div className="max-w-xl flex-1">
                  <Link to="/app/settings" className={notificationsBackLink}>
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    Back to Settings
                  </Link>
                  <h1 className={cn(notificationsHeroTitle, "mt-5")}>
                    <span className={notificationsHeroAccent}>Notifications</span>
                  </h1>
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-[rgba(255,255,255,0.62)] sm:text-[15px]">
                    Stay connected to your wellbeing journey.
                  </p>
                  <p className="mt-3 max-w-lg text-xs leading-relaxed text-[rgba(255,255,255,0.48)]">
                    We&apos;ll keep you gently informed about what matters most on your path to healing and growth.
                  </p>
                </div>

                <motion.div
                  className="flex shrink-0 justify-center lg:justify-end"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="relative flex h-[200px] w-[200px] items-center justify-center sm:h-[210px] sm:w-[210px]">
                    <div
                      className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.28)_0%,rgba(139,92,246,0.12)_45%,transparent_70%)] blur-md"
                      aria-hidden
                    />
                    <div className="relative flex h-full w-full flex-col items-center justify-center rounded-full border border-fuchsia-300/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.09)_0%,rgba(15,16,36,0.78)_100%)] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_52px_-8px_rgba(192,132,252,0.55)] backdrop-blur-md">
                      <Bell className="h-7 w-7 text-violet-200/90" aria-hidden />
                      <p className="mt-2 text-3xl font-semibold text-white">{unreadCount}</p>
                      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-fuchsia-200/70">
                        Unread moments
                      </p>
                      <p className="mt-2 max-w-[150px] text-[10px] leading-snug text-[rgba(255,255,255,0.5)]">
                        You&apos;re doing better than you think.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </section>

            <section className="space-y-4">
              <motion.div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {CATEGORY_FILTERS.map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveCategory(id)}
                    className={notificationsFilterPill(activeCategory === id)}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {id}
                  </button>
                ))}
              </motion.div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgba(255,255,255,0.35)]" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search notifications..."
                    className={notificationsSearchInput}
                    aria-label="Search notifications"
                  />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {unreadCount > 0 ? (
                    <button type="button" onClick={markAllAsRead} className={notificationsBtnGhost}>
                      <CheckCircle2 className="h-4 w-4" />
                      Mark all as read
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-[rgba(255,255,255,0.55)] hover:border-violet-400/25 hover:text-white"
                    aria-label="Filter settings"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>

            {priorityMoments.length > 0 ? (
              <section>
                <p className={cn(notificationsGroupLabel, "mb-3 text-cyan-300/55")}>Priority moments</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {priorityMoments.map((n) => {
                    const cat = getNotificationCategory(n);
                    const meta = PRIORITY_META[cat] ?? PRIORITY_META.Wellness;
                    const PriorityIcon = meta.icon;
                    return (
                      <article
                        key={n.id}
                        className={notificationsPriorityCard(meta.tone)}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (!n.is_read) markAsRead(n.id);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className={notificationsIconChip(meta.tone === "pink" ? "pink" : meta.tone === "amber" ? "amber" : "violet")}>
                            <PriorityIcon className="h-4 w-4" aria-hidden />
                          </div>
                          <ChevronRight className="h-4 w-4 text-[rgba(255,255,255,0.3)]" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">{n.title || meta.fallbackTitle}</h3>
                          <p className="mt-2 text-xs leading-relaxed text-[rgba(255,255,255,0.48)]">
                            {n.message || meta.fallbackMessage}
                          </p>
                          <p className="mt-3 text-[10px] text-[rgba(255,255,255,0.35)]">
                            {getRelativeTime(n.created_at)}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="space-y-5">
              {paginatedNotifications.length === 0 ? (
                <div className={cn(notificationsGlassCard, "px-6 py-14 text-center")}>
                  <Bell className="mx-auto h-12 w-12 text-violet-300/30" />
                  <h3 className="mt-4 font-serif text-xl text-white">No notifications</h3>
                  <p className="mt-2 text-sm text-[rgba(255,255,255,0.45)]">
                    You&apos;re all caught up! Check back later for updates.
                  </p>
                </div>
              ) : (
                TIMELINE_ORDER.map((group) => {
                  const items = groupedTimeline[group];
                  if (items.length === 0) return null;
                  return (
                    <div key={group}>
                      <p className={cn(notificationsGroupLabel, "mb-3")}>{group}</p>
                      <div className={notificationsTimelinePanel}>{items.map(renderTimelineRow)}</div>
                    </div>
                  );
                })
              )}
            </section>

            {total > 0 ? (
              <div className={cn(notificationsGlassCard, "overflow-hidden p-0")}>
                <AdminPaginationBar
                  variant="solace"
                  total={total}
                  page={safePage}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                  selectId="notifications-page-size"
                  pageSizeOptions={[10, 20, 50]}
                />
              </div>
            ) : null}
          </div>

          <NotificationsWellnessRail
            unreadCount={unreadCount}
            readCount={readCount}
            quietMode={quietMode}
            onQuietModeChange={setQuietMode}
          />
        </div>
      </div>
    </motion.div>
  );
}
