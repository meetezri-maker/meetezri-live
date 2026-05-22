import {
  isToday,
  isYesterday,
  subDays,
  isAfter,
  startOfDay,
} from "date-fns";
import type { Notification } from "@/app/contexts/NotificationsContext";

export type NotificationCategory =
  | "All"
  | "Wellness"
  | "Streaks"
  | "Journal"
  | "Support"
  | "Community"
  | "Security"
  | "Billing"
  | "Achievements";

export type TimelineGroup = "TODAY" | "YESTERDAY" | "EARLIER THIS WEEK";

export function getNotificationCategory(n: Notification): NotificationCategory {
  const type = (n.type || "").toLowerCase();
  const md = n.metadata as Record<string, unknown> | null | undefined;
  const streakType = md?.streakType as string | undefined;
  const reminderKind = md?.reminderKind as string | undefined;

  if (type === "achievement") return "Achievements";
  if (type === "safety" || type === "alert" || type === "security") return "Security";
  if (type === "message") return "Support";
  if (type === "community") return "Community";
  if (type === "billing") return "Billing";
  if (type === "mood" || type === "session") return "Wellness";
  if (type === "reminder") {
    if (streakType === "journal" || reminderKind === "journal") return "Journal";
    if (streakType === "mood" || reminderKind === "streak-risk") return "Streaks";
    return "Wellness";
  }
  if (type === "journal") return "Journal";
  return "Wellness";
}

export function matchesCategory(n: Notification, category: NotificationCategory): boolean {
  if (category === "All") return true;
  return getNotificationCategory(n) === category;
}

/** Security, safety, and support notifications shown when quiet mode is on. */
export function isEssentialNotification(n: Notification): boolean {
  const category = getNotificationCategory(n);
  if (category === "Security" || category === "Support") return true;

  const type = (n.type || "").toLowerCase();
  if (type === "safety" || type === "alert") return true;

  const metadata = n.metadata as Record<string, unknown> | null | undefined;
  if (metadata?.priority === "critical" || metadata?.crisis === true) return true;

  return false;
}

export function matchesQuietMode(n: Notification, quietMode: boolean): boolean {
  if (!quietMode) return true;
  return isEssentialNotification(n);
}

export function matchesSearch(n: Notification, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const title = (n.title || "").toLowerCase();
  const message = (n.message || "").toLowerCase();
  return title.includes(q) || message.includes(q);
}

export function getTimelineGroup(createdAt: string): TimelineGroup {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "EARLIER THIS WEEK";
  if (isToday(date)) return "TODAY";
  if (isYesterday(date)) return "YESTERDAY";
  const weekAgo = startOfDay(subDays(new Date(), 7));
  if (isAfter(date, weekAgo)) return "EARLIER THIS WEEK";
  return "EARLIER THIS WEEK";
}

export function groupNotifications(items: Notification[]): Record<TimelineGroup, Notification[]> {
  const groups: Record<TimelineGroup, Notification[]> = {
    TODAY: [],
    YESTERDAY: [],
    "EARLIER THIS WEEK": [],
  };
  for (const item of items) {
    groups[getTimelineGroup(item.created_at)].push(item);
  }
  return groups;
}

export function pickPriorityMoments(items: Notification[]): Notification[] {
  const unread = items.filter((n) => !n.is_read);
  const picks: Notification[] = [];
  const find = (pred: (n: Notification) => boolean) => unread.find((n) => pred(n) && !picks.includes(n));

  const mood = find((n) => n.type === "mood" || getNotificationCategory(n) === "Wellness");
  if (mood) picks.push(mood);
  const streak = find((n) => getNotificationCategory(n) === "Streaks");
  if (streak) picks.push(streak);
  const journal = find((n) => getNotificationCategory(n) === "Journal");
  if (journal) picks.push(journal);

  for (const n of unread) {
    if (picks.length >= 3) break;
    if (!picks.includes(n)) picks.push(n);
  }
  return picks.slice(0, 3);
}

export function getActionPill(n: Notification): { label: string; tone: "cyan" | "green" | "amber" | "blue" | "teal" } | null {
  const cat = getNotificationCategory(n);
  const title = (n.title || "").toLowerCase();
  if (title.includes("streak")) return { label: "Streak saved", tone: "cyan" };
  if (cat === "Support") return { label: "Support", tone: "green" };
  if (cat === "Security") return { label: "Review", tone: "amber" };
  if (cat === "Achievements") return { label: "Achievement", tone: "blue" };
  if (cat === "Community") return { label: "Community", tone: "teal" };
  return null;
}
