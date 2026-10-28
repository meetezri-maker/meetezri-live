/**
 * Wellness Plan printing (browser print / Save as PDF): the snapshot a print is made from.
 *
 * A snapshot is taken when printing is prepared (Print Plan, Save as PDF, Export Plan (PDF) or the
 * browser's own Ctrl+P), so the printed copy can't mix values or save labels that change while the
 * print dialog opens. It only ever holds the signed-in account's data.
 *
 * Save label — nothing is saved or flushed for printing. "Saved plan" is used only when the printed
 * content equals the last content the server confirmed for this same account (the plan as loaded,
 * or exactly what a successful save or clear sent). The editor's own saved flag is not enough: an
 * older autosave finishing can mark newer edits as saved. Everything else is "Current draft":
 *   - "saving":  an autosave request is in flight;
 *   - "unsaved": edits not yet saved (still waiting to autosave, or the last save failed);
 *   - "not-saved": matches what was loaded, but the account has no saved plan yet;
 *   - "unconfirmed": differs from (or can't be compared with) confirmed saved content.
 * No last-saved time is shown: the editor doesn't track one.
 */
import {
  wellnessPlanSectionsToUpsertBody,
  type WellnessPlanLoadState,
  type WellnessPlanSaveStatus,
  type WellnessPlanSection,
  type WellnessPlanUpsertBody,
} from "./wellnessPlanModel";

/** Content the server confirmed as saved for an account. */
export interface WellnessPlanConfirmedContent {
  userId: string;
  body: WellnessPlanUpsertBody;
}

export type WellnessPlanPrintStatus = "saved" | "not-saved" | "saving" | "unsaved" | "unconfirmed";

export interface WellnessPlanPrintContact {
  id: string;
  name: string;
  phone: string | null;
}

export interface WellnessPlanPrintResource {
  name: string;
  phone: string;
}

export interface WellnessPlanPrintSnapshot {
  userId: string;
  printedAt: { text: string; timeZone: string };
  /** null when the plan hasn't loaded for this account (nothing from the plan is printed). */
  plan: {
    status: WellnessPlanPrintStatus;
    sections: Array<{ id: string; title: string; description: string; items: Array<{ id: string; text: string }> }>;
    recoveryPercent: number;
  } | null;
  /** null while contacts are still loading. */
  contacts: WellnessPlanPrintContact[] | null;
  resources: WellnessPlanPrintResource[];
}

export interface WellnessPlanPrintInput {
  userId: string | null | undefined;
  /** Account the loaded plan belongs to (set when the plan loads successfully). */
  planOwnerId: string | null;
  /** The saved plan's id; null when the account has never saved a plan. */
  planId: string | null;
  /** Last content the server confirmed for an account; null when unknown. */
  confirmed: WellnessPlanConfirmedContent | null;
  loadState: WellnessPlanLoadState;
  saveStatus: WellnessPlanSaveStatus;
  isDirty: boolean;
  sections: WellnessPlanSection[];
  recoveryPercent: number;
  /** Raw emergency-contact rows from the API (each carries its `user_id`). */
  contacts: Array<{ id: string; name: string; phone: string | null; user_id?: string | null }>;
  contactsLoading: boolean;
  resources: Array<{ name: string; phone?: string | null } | null | undefined>;
  now?: Date;
}

export function wellnessPlanPrintStatus(
  i: Pick<
    WellnessPlanPrintInput,
    "userId" | "planOwnerId" | "planId" | "confirmed" | "loadState" | "saveStatus" | "isDirty" | "sections"
  >
): WellnessPlanPrintStatus {
  if (i.saveStatus === "saving") return "saving";
  if (i.isDirty) return "unsaved";
  const sameAccount = i.loadState === "ready" && !!i.userId && i.planOwnerId === i.userId && i.confirmed?.userId === i.userId;
  const matches =
    sameAccount && JSON.stringify(wellnessPlanSectionsToUpsertBody(i.sections)) === JSON.stringify(i.confirmed!.body);
  if (!matches) return "unconfirmed";
  return i.planId ? "saved" : "not-saved";
}

export const WELLNESS_PLAN_PRINT_STATUS_TEXT: Record<WellnessPlanPrintStatus, { label: string; detail: string | null }> = {
  saved: { label: "Saved plan", detail: "Matches the plan saved to your account when this was printed." },
  "not-saved": { label: "Current draft", detail: "No wellness plan had been saved to your account when this was printed." },
  saving: {
    label: "Current draft",
    detail: "Changes were still being saved when this was printed, so it may differ from the plan saved to your account.",
  },
  unsaved: {
    label: "Current draft",
    detail: "Includes changes that hadn't been saved to your account when this was printed (they were waiting to save, or saving failed), so it may differ from your saved plan.",
  },
  unconfirmed: {
    label: "Current draft",
    detail: "This copy couldn't be confirmed as matching the plan saved to your account, so it may include changes that haven't been saved.",
  },
};

export function formatWellnessPlanPrintedAt(now: Date): { text: string; timeZone: string } {
  let timeZone = "device time";
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || timeZone;
  } catch {
    // keep the fallback label
  }
  const text = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return { text, timeZone };
}

/** The print snapshot, or null when there is no signed-in account. */
export function buildWellnessPlanPrintSnapshot(i: WellnessPlanPrintInput): WellnessPlanPrintSnapshot | null {
  if (!i.userId) return null;
  const planReady = i.loadState === "ready" && i.planOwnerId === i.userId;
  return {
    userId: i.userId,
    printedAt: formatWellnessPlanPrintedAt(i.now ?? new Date()),
    plan: planReady
      ? {
          status: wellnessPlanPrintStatus(i),
          sections: i.sections.map((s) => ({
            id: s.id,
            title: s.title,
            description: s.description,
            items: s.items.map((item) => ({ id: item.id, text: item.text })),
          })),
          recoveryPercent: i.recoveryPercent,
        }
      : null,
    // Only this account's contacts (the contacts cache is not keyed by account).
    contacts: i.contactsLoading
      ? null
      : i.contacts
          .filter((c) => c.user_id === i.userId)
          .map((c) => ({ id: c.id, name: c.name, phone: c.phone })),
    resources: i.resources
      .filter((r): r is { name: string; phone: string } => !!r && !!r.phone)
      .map((r) => ({ name: r.name, phone: r.phone })),
  };
}
