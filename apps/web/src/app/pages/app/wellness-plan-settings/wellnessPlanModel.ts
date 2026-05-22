import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Heart,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import type {
  WellnessPlanListItem,
  WellnessPlanProfessionalSupport,
  WellnessPlanRecord,
  WellnessPlanResponse,
  WellnessPlanSectionId,
  WellnessPlanTrustedContact,
  WellnessPlanUpsertBody,
} from "@meetezri/shared";
import { WELLNESS_PLAN_SECTION_IDS } from "@meetezri/shared";

export type {
  WellnessPlanDocument,
  WellnessPlanListItem,
  WellnessPlanOnboardingDraft,
  WellnessPlanProfessionalSupport,
  WellnessPlanRecord,
  WellnessPlanResponse,
  WellnessPlanSectionId,
  WellnessPlanTrustedContact,
  WellnessPlanUpsertBody,
} from "./models";

export { WELLNESS_PLAN_SECTION_IDS } from "@meetezri/shared";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export type WellnessPlanSectionAccent = "rose" | "pink" | "magenta" | "violet" | "amber";

export type WellnessPlanLoadState = "loading" | "ready" | "error";

export type WellnessPlanSaveStatus = "idle" | "saving" | "saved";

export const WELLNESS_PLAN_AUTOSAVE_DEBOUNCE_MS = 700;

/** @deprecated Use REST API — kept for reference only */
export const WELLNESS_PLAN_SUPABASE_SELECT =
  "id, user_id, warning_signs, coping_strategies, social_distractions, trusted_contacts, professional_support, environment_safety, last_updated" as const;

// ---------------------------------------------------------------------------
// UI-only types
// ---------------------------------------------------------------------------

/** Emergency contacts shown in the wellness plan safety rail (from API). */
export interface WellnessPlanEmergencyContact {
  id: string;
  name: string;
  phone: string | null;
}

export interface WellnessPlanSectionBlueprint {
  id: WellnessPlanSectionId;
  title: string;
  description: string;
  accent: WellnessPlanSectionAccent;
  icon: LucideIcon;
  placeholder: string;
}

export interface WellnessPlanSection extends WellnessPlanSectionBlueprint {
  items: WellnessPlanListItem[];
}

/** In-memory editor state for the settings page (draft vs last saved snapshot). */
export interface WellnessPlanEditorState {
  planId: string | null;
  sections: WellnessPlanSection[];
  savedSnapshot: WellnessPlanSection[];
  loadState: WellnessPlanLoadState;
  saveStatus: WellnessPlanSaveStatus;
  isDirty: boolean;
}

export const WELLNESS_PLAN_SECTION_BLUEPRINT: WellnessPlanSectionBlueprint[] = [
  {
    id: "warning-signs",
    title: "Warning Signs",
    description: "Thoughts, feelings, or behaviors that indicate I may need support.",
    icon: AlertTriangle,
    accent: "rose",
    placeholder: "Add a warning sign...",
  },
  {
    id: "coping-strategies",
    title: "Coping Strategies",
    description: "Things I can do to help myself feel better in difficult moments.",
    icon: Heart,
    accent: "pink",
    placeholder: "Add a coping strategy...",
  },
  {
    id: "distractions",
    title: "Healthy Distractions",
    description: "Activities that help take my mind off distressing thoughts.",
    icon: Activity,
    accent: "magenta",
    placeholder: "Add a distraction...",
  },
  {
    id: "safe-people",
    title: "People I Can Contact",
    description: "People I trust and can reach out to for support.",
    icon: Users,
    accent: "violet",
    placeholder: "Add a contact person...",
  },
  {
    id: "safe-places",
    title: "Safe Places",
    description: "Places where I feel safe, calm, and supported.",
    icon: MapPin,
    accent: "amber",
    placeholder: "Add a safe place...",
  },
  {
    id: "reasons-to-live",
    title: "Reasons to Live",
    description: "Reminders of why my life is valuable and worth living.",
    icon: ShieldCheck,
    accent: "violet",
    placeholder: "Add a reason...",
  },
];

// ---------------------------------------------------------------------------
// Item helpers
// ---------------------------------------------------------------------------

export function createWellnessPlanItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `wp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createWellnessPlanListItem(
  text: string,
  id = createWellnessPlanItemId()
): WellnessPlanListItem {
  return { id, text: text.trim() };
}

export function wellnessPlanItemsToText(items: WellnessPlanListItem[]): string[] {
  return items.map((item) => item.text);
}

export function wellnessPlanTextsToItems(texts: string[]): WellnessPlanListItem[] {
  return texts.map((text) => createWellnessPlanListItem(text));
}

// ---------------------------------------------------------------------------
// Section factories & cloning
// ---------------------------------------------------------------------------

export function createEmptyWellnessPlanSections(): WellnessPlanSection[] {
  return WELLNESS_PLAN_SECTION_BLUEPRINT.map((blueprint) => ({
    ...blueprint,
    items: [],
  }));
}

export function cloneWellnessPlanSections(sections: WellnessPlanSection[]): WellnessPlanSection[] {
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({ ...item })),
  }));
}

export function createInitialWellnessPlanEditorState(): WellnessPlanEditorState {
  const empty = createEmptyWellnessPlanSections();
  return {
    planId: null,
    sections: cloneWellnessPlanSections(empty),
    savedSnapshot: cloneWellnessPlanSections(empty),
    loadState: "loading",
    saveStatus: "idle",
    isDirty: false,
  };
}

// ---------------------------------------------------------------------------
// Parsing (API / DB → UI)
// ---------------------------------------------------------------------------

export function parseWellnessPlanTrustedContacts(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    if (typeof raw[0] === "string") return raw as string[];
    return (raw as WellnessPlanTrustedContact[])
      .map((entry) => formatWellnessPlanTrustedContact(entry))
      .filter(Boolean);
  }
  return [];
}

export function formatWellnessPlanTrustedContact(contact: WellnessPlanTrustedContact): string {
  const bits = [contact.name, contact.phone, contact.relation].filter(Boolean);
  return bits.join(" — ");
}

export function parseWellnessPlanReasonsToLive(raw: unknown): string[] {
  if (raw && typeof raw === "object" && "reasons_to_live" in raw) {
    const reasons = (raw as WellnessPlanProfessionalSupport).reasons_to_live;
    if (Array.isArray(reasons) && reasons.every((item) => typeof item === "string")) {
      return reasons;
    }
  }
  return [];
}

export function wellnessPlanResponseToRecord(res: WellnessPlanResponse): WellnessPlanRecord | null {
  if (!res.id) return null;
  return {
    id: res.id,
    user_id: res.user_id,
    warning_signs: res.warning_signs,
    coping_strategies: res.coping_strategies,
    social_distractions: res.social_distractions,
    trusted_contacts: res.trusted_contacts,
    professional_support: res.professional_support,
    environment_safety: res.environment_safety,
    last_updated: res.last_updated ?? undefined,
  };
}

export function wellnessPlanResponseToSections(res: WellnessPlanResponse): WellnessPlanSection[] {
  const pseudoRow: WellnessPlanRecord = {
    id: res.id ?? "00000000-0000-4000-8000-000000000000",
    user_id: res.user_id,
    warning_signs: res.warning_signs,
    coping_strategies: res.coping_strategies,
    social_distractions: res.social_distractions,
    trusted_contacts: res.trusted_contacts,
    professional_support: res.professional_support,
    environment_safety: res.environment_safety,
    last_updated: res.last_updated ?? undefined,
  };
  return wellnessPlanRecordToSections(pseudoRow);
}

export function wellnessPlanRecordToSections(row: WellnessPlanRecord): WellnessPlanSection[] {
  const itemsBySectionId: Record<WellnessPlanSectionId, string[]> = {
    "warning-signs": row.warning_signs ?? [],
    "coping-strategies": row.coping_strategies ?? [],
    distractions: row.social_distractions ?? [],
    "safe-people": parseWellnessPlanTrustedContacts(row.trusted_contacts),
    "safe-places": row.environment_safety ?? [],
    "reasons-to-live": parseWellnessPlanReasonsToLive(row.professional_support),
  };

  return WELLNESS_PLAN_SECTION_BLUEPRINT.map((blueprint) => ({
    ...blueprint,
    items: wellnessPlanTextsToItems(itemsBySectionId[blueprint.id] ?? []),
  }));
}

export function getWellnessPlanSectionItems(
  sections: WellnessPlanSection[],
  sectionId: WellnessPlanSectionId
): WellnessPlanListItem[] {
  return sections.find((section) => section.id === sectionId)?.items ?? [];
}

/** Body for PUT /api/wellness-plan */
export function wellnessPlanSectionsToUpsertBody(sections: WellnessPlanSection[]): WellnessPlanUpsertBody {
  return {
    warning_signs: wellnessPlanItemsToText(getWellnessPlanSectionItems(sections, "warning-signs")),
    coping_strategies: wellnessPlanItemsToText(
      getWellnessPlanSectionItems(sections, "coping-strategies")
    ),
    social_distractions: wellnessPlanItemsToText(getWellnessPlanSectionItems(sections, "distractions")),
    trusted_contacts: wellnessPlanItemsToText(getWellnessPlanSectionItems(sections, "safe-people")),
    reasons_to_live: wellnessPlanItemsToText(
      getWellnessPlanSectionItems(sections, "reasons-to-live")
    ),
    environment_safety: wellnessPlanItemsToText(getWellnessPlanSectionItems(sections, "safe-places")),
  };
}

/** @deprecated Use wellnessPlanSectionsToUpsertBody — legacy Supabase payload shape */
export function wellnessPlanSectionsToUpsertPayload(userId: string, sections: WellnessPlanSection[]) {
  const body = wellnessPlanSectionsToUpsertBody(sections);
  return {
    user_id: userId,
    warning_signs: body.warning_signs,
    coping_strategies: body.coping_strategies,
    social_distractions: body.social_distractions,
    trusted_contacts: body.trusted_contacts,
    professional_support: { reasons_to_live: body.reasons_to_live },
    environment_safety: body.environment_safety,
    last_updated: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Editor operations
// ---------------------------------------------------------------------------

export function computeWellnessPlanRecoveryPercent(sections: WellnessPlanSection[]): number {
  if (sections.length === 0) return 0;
  const filled = sections.filter((section) => section.items.length > 0).length;
  return Math.round((filled / sections.length) * 100);
}

export function addWellnessPlanSectionItem(
  sections: WellnessPlanSection[],
  sectionId: WellnessPlanSectionId,
  text: string
): WellnessPlanSection[] {
  const trimmed = text.trim();
  if (!trimmed) return sections;
  const item = createWellnessPlanListItem(trimmed);
  return sections.map((section) =>
    section.id === sectionId ? { ...section, items: [...section.items, item] } : section
  );
}

export function removeWellnessPlanSectionItem(
  sections: WellnessPlanSection[],
  sectionId: WellnessPlanSectionId,
  itemId: string
): WellnessPlanSection[] {
  return sections.map((section) =>
    section.id === sectionId
      ? { ...section, items: section.items.filter((item) => item.id !== itemId) }
      : section
  );
}

export function clearWellnessPlanSections(): WellnessPlanSection[] {
  return createEmptyWellnessPlanSections();
}

export function resetWellnessPlanSectionsToSnapshot(
  savedSnapshot: WellnessPlanSection[]
): WellnessPlanSection[] {
  return cloneWellnessPlanSections(savedSnapshot);
}

export function applyWellnessPlanToEditor(
  state: WellnessPlanEditorState,
  planId: string | null,
  sections: WellnessPlanSection[]
): WellnessPlanEditorState {
  const snapshot = cloneWellnessPlanSections(sections);
  return {
    ...state,
    planId,
    sections: snapshot,
    savedSnapshot: cloneWellnessPlanSections(snapshot),
    isDirty: false,
    loadState: "ready",
  };
}
