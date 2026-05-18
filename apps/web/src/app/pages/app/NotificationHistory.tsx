import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Phone,
  Shield,
} from "lucide-react";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useAuth } from "@/app/contexts/AuthContext";
import { useNotifications } from "@/app/contexts/NotificationsContext";
import { cn } from "@/lib/utils";
import {
  NOTIFICATIONS_HERO_IMG,
  emergencyBackLink,
  emergencyBannerCta,
  emergencyBannerGradient,
  emergencyCategoryPill,
  emergencyFilterPill,
  emergencyFooterStrip,
  emergencyHeroAccent,
  emergencyHeroCard,
  emergencyHeroImage,
  emergencyHeroOverlayLeft,
  emergencyHeroOverlayPurple,
  emergencyHeroOverlayWarmth,
  emergencyHeroTitle,
  emergencyIconOrb,
  emergencyNotificationCard,
  emergencyPageAtmosphere,
  emergencyPageFogMid,
  emergencyPageGlowTop,
  emergencyPageVignette,
  emergencySortSelect,
  emergencyStatusDot,
} from "@/app/pages/app/emergency-notifications/emergencyNotificationsUi";
import {
  FEED_TABS,
  belongsOnEmergencyNotificationsPage,
  countByTab,
  getCategoryIcon,
  mapNotificationToFeedItem,
  matchesFeedTab,
  sortFeedItems,
  type EmergencyFeedTab,
  type EmergencySort,
  type EmergencyVisualCategory,
} from "@/app/pages/app/emergency-notifications/emergencyNotificationModel";
import { EmergencyNotificationsRail } from "@/app/pages/app/emergency-notifications/EmergencyNotificationsRail";

function formatFeedTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return format(date, "MMM d, yyyy • h:mm a");
}

function formatQuietHours(
  enabled: boolean | undefined,
  start: string | undefined,
  end: string | undefined
): string {
  if (!enabled) return "Off";
  const s = start ?? "22:00";
  const e = end ?? "07:00";
  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const d = new Date();
    d.setHours(h ?? 22, m ?? 0, 0, 0);
    return format(d, "h:mm a");
  };
  return `${fmt(s)} – ${fmt(e)}`;
}

interface EmergencyNotificationCardProps {
  title: string;
  message: string;
  timestamp: string;
  category: EmergencyVisualCategory;
  tagLabel: string;
  index: number;
}

function EmergencyNotificationCard({
  title,
  message,
  timestamp,
  category,
  tagLabel,
  index,
}: EmergencyNotificationCardProps) {
  const Icon = getCategoryIcon(category);
  const pillCategory =
    category === "wellness" ? "safety" : category === "emergency" ? "emergency" : category;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 + index * 0.04, duration: 0.4 }}
      className={emergencyNotificationCard}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <div className={emergencyIconOrb(category === "wellness" ? "wellness" : pillCategory)}>
          <Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-lg font-light text-white sm:text-xl">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-[rgba(255,255,255,0.58)]">{message}</p>
          <p className="mt-3 text-xs text-[rgba(255,255,255,0.38)]">{formatFeedTimestamp(timestamp)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end sm:gap-2.5">
          <span className={emergencyCategoryPill(pillCategory)}>{tagLabel}</span>
          <span className={emergencyStatusDot(pillCategory)} aria-hidden />
        </div>
      </div>
    </motion.article>
  );
}

export function NotificationHistory() {
  const { notifications: allNotifications, isLoading } = useNotifications();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<EmergencyFeedTab>("all");
  const [sort, setSort] = useState<EmergencySort>("recent");

  const prefs = profile?.notification_preferences;
  const inAppEnabled = true;
  const emailEnabled = prefs?.emailEnabled ?? true;
  const pushEnabled = prefs?.pushEnabled ?? true;
  const quietHoursLabel = formatQuietHours(
    prefs?.quietHoursEnabled,
    prefs?.quietStart,
    prefs?.quietEnd
  );

  const feedItems = useMemo(
    () =>
      allNotifications
        .filter(belongsOnEmergencyNotificationsPage)
        .map(mapNotificationToFeedItem),
    [allNotifications]
  );

  const tabCounts = useMemo(() => countByTab(feedItems), [feedItems]);

  const visibleItems = useMemo(() => {
    const filtered = feedItems.filter((item) => matchesFeedTab(item, activeTab));
    return sortFeedItems(filtered, sort);
  }, [feedItems, activeTab, sort]);

  const hasNotices = feedItems.length > 0;

  if (isLoading) {
    return (
      <div className={emergencyPageAtmosphere}>
        <motion.div className={emergencyPageGlowTop} aria-hidden />
        <motion.div className={emergencyPageVignette} aria-hidden />
        <div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9">
          <Skeleton className="h-[min(300px,38vh)] w-full rounded-[2rem] bg-white/5" />
          <div className="mt-6 space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[120px] w-full rounded-[1.375rem] bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={emergencyPageAtmosphere}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className={emergencyPageGlowTop} aria-hidden />
      <motion.div className={emergencyPageFogMid} aria-hidden />
      <motion.div className={emergencyPageVignette} aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9">
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] xl:items-start xl:gap-10">
          <div className="min-w-0 space-y-8">
            <Link to="/app/settings" className={emergencyBackLink}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to Settings
            </Link>

            <motion.div
              className="flex items-start gap-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/10 shadow-[0_0_32px_-6px_rgba(236,72,153,0.5)]">
                <Bell className="h-6 w-6 text-fuchsia-200" aria-hidden />
              </div>
              <div>
                <h1 className={cn(emergencyHeroTitle, "text-[clamp(1.75rem,3.5vw,2.5rem)]")}>
                  <span className={emergencyHeroAccent}>Emergency Notifications</span>
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-[rgba(255,255,255,0.55)] sm:text-[15px]">
                  Notices flagged as emergency or safety notifications.
                </p>
              </div>
            </motion.div>

            <motion.section
              className={emergencyHeroCard}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <img
                src={NOTIFICATIONS_HERO_IMG}
                alt=""
                className={emergencyHeroImage}
                width={1600}
                height={900}
              />
              <div className={emergencyHeroOverlayLeft} aria-hidden />
              <div className={emergencyHeroOverlayPurple} aria-hidden />
              <div className={emergencyHeroOverlayWarmth} aria-hidden />

              <div className="relative flex min-h-[min(280px,36vh)] flex-col justify-between p-6 sm:min-h-[300px] sm:p-8 lg:min-h-[280px] lg:flex-row lg:items-center lg:gap-10">
                <div className="max-w-lg flex-1">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-fuchsia-400/30 bg-fuchsia-500/15 shadow-[0_0_40px_-8px_rgba(236,72,153,0.55)]">
                    <Bell className="h-7 w-7 text-fuchsia-200" aria-hidden />
                  </div>
                  {hasNotices ? (
                    <>
                      <h2 className="font-serif text-2xl font-light text-white sm:text-3xl">
                        {feedItems.length} safety {feedItems.length === 1 ? "notice" : "notices"}
                      </h2>
                      <p className="mt-3 text-sm leading-relaxed text-[rgba(255,255,255,0.62)]">
                        These messages were sent with your emotional safety in mind. Take your time reading them.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="font-serif text-2xl font-light text-white sm:text-3xl">
                        No emergency notices yet
                      </h2>
                      <p className="mt-3 text-sm leading-relaxed text-[rgba(255,255,255,0.62)]">
                        When our team sends you a safety-related in-app notice, it will appear here.
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-[rgba(255,255,255,0.45)]">
                        For all other alerts, open Notifications.
                      </p>
                    </>
                  )}
                  {!hasNotices ? (
                    <Link
                      to="/app/settings/notifications"
                      className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-fuchsia-300/90 transition-colors hover:text-fuchsia-200"
                    >
                      Open Notifications
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </Link>
                  ) : null}
                </div>
              </div>
            </motion.section>

            <section className="space-y-5" aria-label="Emergency notification filters">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {FEED_TABS.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveTab(id)}
                      className={emergencyFilterPill(activeTab === id)}
                    >
                      {label} ({tabCounts[id]})
                    </button>
                  ))}
                </div>
                <label className="relative shrink-0">
                  <span className="sr-only">Sort notifications</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as EmergencySort)}
                    className={emergencySortSelect}
                  >
                    <option value="recent">Most Recent</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </label>
              </div>

              <div className="space-y-4">
                {visibleItems.length === 0 ? (
                  <motion.div
                    className={cn(emergencyNotificationCard, "text-center py-12")}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Bell className="mx-auto h-10 w-10 text-violet-300/35" aria-hidden />
                    <p className="mt-4 font-serif text-lg font-light text-white/80">
                      No notices in this category
                    </p>
                    <p className="mt-2 text-sm text-[rgba(255,255,255,0.45)]">
                      When something arrives here, you&apos;ll see it in this calm space.
                    </p>
                  </motion.div>
                ) : (
                  visibleItems.map((item, index) => (
                    <EmergencyNotificationCard
                      key={item.id}
                      title={item.title}
                      message={item.message}
                      timestamp={item.timestamp}
                      category={item.category}
                      tagLabel={item.tagLabel}
                      index={index}
                    />
                  ))
                )}
              </div>
            </section>

            <section className={emergencyBannerGradient} aria-labelledby="emergency-resources-banner">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                    <Phone className="h-6 w-6 text-white" aria-hidden />
                  </div>
                  <div>
                    <h2
                      id="emergency-resources-banner"
                      className="font-serif text-xl font-light text-white sm:text-2xl"
                    >
                      Helpful Resources — Available 24/7
                    </h2>
                    <p className="mt-2 text-sm text-white/85">
                      You are not alone. Support is always available.
                    </p>
                  </div>
                </div>
                <Link to="/app/emergency-resources" className={emergencyBannerCta}>
                  Emergency Resources
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </Link>
              </div>
            </section>

            <div className={emergencyFooterStrip}>
              <div className="flex items-start gap-2.5 text-xs leading-relaxed text-[rgba(255,255,255,0.48)]">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-violet-300/60" aria-hidden />
                <p>
                  If this is an emergency, please contact your local emergency services or a trusted
                  contact immediately.
                </p>
              </div>
              <Link
                to="/app/settings/notifications"
                className="shrink-0 text-xs font-medium text-fuchsia-300/80 transition-colors hover:text-fuchsia-200"
              >
                Manage Notification Preferences →
              </Link>
            </div>
          </div>

          <EmergencyNotificationsRail
            inAppEnabled={inAppEnabled}
            emailEnabled={emailEnabled}
            pushEnabled={pushEnabled}
            quietHoursLabel={quietHoursLabel}
          />
        </div>
      </div>
    </motion.div>
  );
}
