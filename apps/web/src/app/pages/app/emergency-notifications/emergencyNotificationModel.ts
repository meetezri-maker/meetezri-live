import type { LucideIcon } from "lucide-react";
import { Bell, Heart, Settings, Shield, UserPlus, Wind } from "lucide-react";
import type { Notification } from "@/app/contexts/NotificationsContext";

export type EmergencyFeedTab = "all" | "emergency" | "safety" | "system";
export type EmergencyVisualCategory = "emergency" | "safety" | "system" | "wellness";
export type EmergencySort = "recent" | "oldest";

export interface EmergencyFeedItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  category: EmergencyVisualCategory;
  tagLabel: string;
}

function asMetadataRecord(metadata: Notification["metadata"]): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object") return null;
  return metadata as Record<string, unknown>;
}

/** Admin safety / emergency in-app notices for this sanctuary screen. */
export function belongsOnEmergencyNotificationsPage(n: Notification): boolean {
  const md = asMetadataRecord(n.metadata);
  if (md?.manual_admin_broadcast === true) {
    const cat = md.notification_category;
    return cat === "emergency" || cat === "safety" || cat === "system";
  }
  const cat = md?.notification_category;
  if (cat === "emergency" || cat === "safety" || cat === "system") return true;
  if (n.type === "safety" || n.type === "alert" || n.type === "crisis") return true;
  return false;
}

export function getVisualCategory(n: Notification): EmergencyVisualCategory {
  const md = asMetadataRecord(n.metadata);
  const cat = md?.notification_category;
  if (cat === "emergency") return "emergency";
  if (cat === "safety" || n.type === "safety" || n.type === "alert") return "safety";
  if (cat === "system" || n.type === "system") return "system";
  if (md?.manual_admin_broadcast === true) return "emergency";
  if (n.type === "achievement" || n.type === "mood") return "wellness";
  return "system";
}

export function getTagLabel(category: EmergencyVisualCategory): string {
  switch (category) {
    case "emergency":
      return "EMERGENCY";
    case "safety":
      return "SAFETY UPDATE";
    case "wellness":
      return "SAFETY UPDATE";
    case "system":
    default:
      return "SYSTEM ALERT";
  }
}

export function mapNotificationToFeedItem(n: Notification): EmergencyFeedItem {
  const category = getVisualCategory(n);
  return {
    id: n.id,
    title: (n.title && n.title.trim()) || "Safety notice",
    message: (n.message && n.message.trim()) || "A safety-related update is available in the app.",
    timestamp: n.created_at,
    category,
    tagLabel: getTagLabel(category),
  };
}

export function matchesFeedTab(item: EmergencyFeedItem, tab: EmergencyFeedTab): boolean {
  if (tab === "all") return true;
  if (tab === "emergency") return item.category === "emergency";
  if (tab === "safety") return item.category === "safety" || item.category === "wellness";
  return item.category === "system";
}

export function sortFeedItems(items: EmergencyFeedItem[], sort: EmergencySort): EmergencyFeedItem[] {
  const copy = [...items];
  copy.sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return sort === "recent" ? tb - ta : ta - tb;
  });
  return copy;
}

export function countByTab(items: EmergencyFeedItem[]): Record<EmergencyFeedTab, number> {
  return {
    all: items.length,
    emergency: items.filter((i) => matchesFeedTab(i, "emergency")).length,
    safety: items.filter((i) => matchesFeedTab(i, "safety")).length,
    system: items.filter((i) => matchesFeedTab(i, "system")).length,
  };
}

const ICON_BY_CATEGORY: Record<EmergencyVisualCategory, LucideIcon> = {
  emergency: UserPlus,
  safety: Shield,
  wellness: Heart,
  system: Settings,
};

export function getCategoryIcon(category: EmergencyVisualCategory): LucideIcon {
  return ICON_BY_CATEGORY[category] ?? Bell;
}

export const FEED_TABS: { id: EmergencyFeedTab; label: string }[] = [
  { id: "all", label: "All Notifications" },
  { id: "emergency", label: "Emergency Alerts" },
  { id: "safety", label: "Safety Updates" },
  { id: "system", label: "System Alerts" },
];

export const RESOURCE_LINKS = [
  {
    to: "/app/emergency-resources",
    title: "Emergency Resources",
    subtitle: "24/7 crisis lines and immediate support",
    tone: "rose" as const,
    icon: Bell,
  },
  {
    to: "/app/settings/emergency-contacts",
    title: "Trusted Contacts",
    subtitle: "People you trust in difficult moments",
    tone: "amber" as const,
    icon: UserPlus,
  },
  {
    to: "/app/settings/wellness-plan",
    title: "Safety Plan",
    subtitle: "Your personalized coping strategies",
    tone: "blue" as const,
    icon: Shield,
  },
  {
    to: "/app/session-lobby",
    title: "Talk to Someone",
    subtitle: "Connect with compassionate support",
    tone: "emerald" as const,
    icon: Heart,
  },
  {
    to: "/app/wellness-tools",
    title: "Guided Breathing",
    subtitle: "Calm your nervous system gently",
    tone: "cyan" as const,
    icon: Wind,
  },
];
