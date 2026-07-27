import * as z from "zod";
import {
  isValidOptionalAppPhone,
  OPTIONAL_PHONE_VALIDATION_MESSAGE,
} from "@meetezri/shared";
import {
  birthIsoToAgeYears,
  isIsoDobString,
  MIN_ACCOUNT_AGE_YEARS,
  minAccountAgeMessage,
  profileAgeStorageToDisplayYears,
} from "@/lib/profileAge";
import { wellnessGoalProfileOptions } from "@/lib/wellnessGoals";

/**
 * Single source of truth for the Profile Edit modal's form: validation, default-value mapping,
 * and payload construction. The page container imports the same mapper for the read-only
 * sidebar and the profile-completion metric, so the two can never drift apart.
 */

export const goalsOptions = wellnessGoalProfileOptions;

export const triggersOptions = [
  { value: "crowds", label: "Crowds" },
  { value: "procrastination", label: "Procrastination" },
  { value: "overthinking", label: "Overthinking" },
  { value: "low-energy-days", label: "Low-energy days" },
  { value: "focus-issues", label: "Focus issues" },
  { value: "motivation-dips", label: "Motivation dips" },
  { value: "sleep-routine", label: "Sleep routine" },
  { value: "time-management", label: "Time management" },
  { value: "difficult-conversations", label: "Difficult conversations" },
  { value: "uncertainty", label: "Uncertainty" },
  { value: "workload-pressure", label: "Workload pressure" },
  { value: "decision-making", label: "Decision-making" },
  { value: "distractions", label: "Distractions" },
  { value: "confidence-dips", label: "Confidence dips" },
  { value: "social-situations", label: "Social situations" },
];

export const pronounsOptions = [
  "she/her",
  "he/him",
  "they/them",
  "she/they",
  "he/they",
  "prefer not to say",
];

const fallbackTimezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
];

export const getBrowserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

export const getAvailableTimezones = (): string[] => {
  try {
    const list = ((Intl as any).supportedValuesOf?.("timeZone") || []) as string[];
    return list.length ? list : fallbackTimezones;
  } catch {
    return fallbackTimezones;
  }
};

export const formatTimezoneOptionLabel = (timezone: string) => {
  const place = timezone.replace(/_/g, " ").replace(/\//g, ", ");
  try {
    const offsetPart = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;
    return offsetPart ? `${place} (${offsetPart})` : place;
  } catch {
    return place;
  }
};

export const toProfileGoals = (value: unknown): string[] => {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string")
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
};

/**
 * `profiles` has exactly one name column (`full_name`), so first/last are a presentation split.
 * Mirrors the existing convention in AccountSettings.tsx: first token is the first name, the
 * remainder is the last name, and they are rejoined on save.
 */
export function splitFullName(fullName?: string | null): { firstName: string; lastName: string } {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function joinFullName(firstName: string, lastName: string): string {
  return `${(firstName || "").trim()} ${(lastName || "").trim()}`.trim();
}

const phoneField = z
  .string()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || /^\+[\d\s\-().]+$/.test(v), "Select a country from the dropdown first")
  .refine((v) => !v || isValidOptionalAppPhone(v), OPTIONAL_PHONE_VALIDATION_MESSAGE);

/**
 * The schema is a factory because two rules depend on stored state rather than form state:
 * clearing an existing contact is rejected by the backend, and so is withdrawing consent while
 * contact data is still on file. Catching both here turns a 400 toast into a field error.
 */
export function createProfileEditSchema(options: { hasStoredEmergencyContact: boolean }) {
  return z
    .object({
      firstName: z.string().min(1, "First name is required"),
      lastName: z.string().optional().or(z.literal("")),
      birthday: z
        .string()
        .optional()
        .refine((v) => {
          const trimmed = (v ?? "").trim();
          if (!trimmed) return true;
          if (isIsoDobString(trimmed)) {
            const years = birthIsoToAgeYears(trimmed);
            return years !== undefined && years >= MIN_ACCOUNT_AGE_YEARS;
          }
          const asYears = Number.parseInt(trimmed, 10);
          if (Number.isFinite(asYears)) return asYears >= MIN_ACCOUNT_AGE_YEARS;
          return true;
        }, minAccountAgeMessage),
      pronouns: z.string().optional(),
      timezone: z.string().optional(),
      phone: phoneField,
      in_therapy: z.string().optional(),
      selected_goals: z.array(z.string()).optional(),
      selected_triggers: z.array(z.string()).optional(),
      emergency_contact_name: z.string().optional().or(z.literal("")),
      emergency_contact_relationship: z.string().optional().or(z.literal("")),
      emergency_contact_phone: phoneField,
      emergency_consent: z.boolean().optional(),
    })
    .superRefine((values, ctx) => {
      // `full_name` is what the API stores, so the composed value carries the backend's rule.
      const fullName = joinFullName(values.firstName, values.lastName || "");
      if (fullName.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["firstName"],
          message: "Name must be at least 2 characters",
        });
      }
      if (fullName.length > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lastName"],
          message: "Name must be 100 characters or fewer",
        });
      }

      const name = (values.emergency_contact_name || "").trim();
      const relationship = (values.emergency_contact_relationship || "").trim();
      const phone = (values.emergency_contact_phone || "").trim();
      const filled = [name, relationship, phone].filter(Boolean).length;

      if (filled === 0) {
        // The profile endpoint refuses to remove a contact; that lives on the settings page.
        if (options.hasStoredEmergencyContact) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["emergency_contact_name"],
            message:
              "Emergency contact details cannot be removed here. Remove the contact from Settings → Emergency Contacts.",
          });
        }
        return;
      }

      // Mirrors the backend's all-or-nothing rule so partial input fails per field, not as a toast.
      if (!name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["emergency_contact_name"],
          message: "Emergency contact name is required",
        });
      }
      if (!relationship) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["emergency_contact_relationship"],
          message: "Emergency contact relationship is required",
        });
      }
      if (!phone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["emergency_contact_phone"],
          message: "Emergency contact phone is required",
        });
      }
      if (values.emergency_consent !== true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["emergency_consent"],
          message: "Please confirm emergency contact consent before saving",
        });
      }
    });
}

export type ProfileEditFormValues = z.infer<ReturnType<typeof createProfileEditSchema>>;

export type ProfileFormDefaults = ProfileEditFormValues & {
  /** Display-only. Never an editable field and never part of a payload. */
  emailDisplay: string;
  /** Raw `profiles.age` so the sidebar can render years-or-DOB exactly as stored. */
  ageStorage: string | null;
};

export function hasStoredEmergencyContact(profile: any): boolean {
  return Boolean(
    (profile?.emergency_contact_name || "").trim() ||
      (profile?.emergency_contact_relationship || "").trim() ||
      (profile?.emergency_contact_phone || "").trim()
  );
}

/**
 * Maps a `GET /users/me` payload onto form values. Deliberately reproduces the previous
 * behaviour field for field (ISO-DOB passthrough, browser-timezone fallback, "Not specified"
 * therapist default, array-or-CSV goals) so profile completion keeps its existing result.
 */
export function buildProfileFormDefaults(
  profile: any,
  authEmail?: string | null
): ProfileFormDefaults {
  const { firstName, lastName } = splitFullName(profile?.full_name);
  const storedAge = profile?.age ?? "";

  return {
    firstName,
    lastName,
    // Auth is the source of truth for the address the member actually signs in with.
    emailDisplay: authEmail || profile?.email || "",
    birthday: isIsoDobString(storedAge)
      ? String(storedAge).trim()
      : profileAgeStorageToDisplayYears(profile?.age),
    ageStorage: profile?.age ?? null,
    pronouns: profile?.pronouns || "",
    timezone: profile?.timezone || getBrowserTimezone(),
    phone: profile?.phone || "",
    in_therapy: profile?.in_therapy || "Not specified",
    selected_goals: toProfileGoals(profile?.selected_goals),
    selected_triggers: toProfileGoals(profile?.selected_triggers),
    emergency_contact_name: profile?.emergency_contact_name || "",
    emergency_contact_relationship: profile?.emergency_contact_relationship || "",
    emergency_contact_phone: profile?.emergency_contact_phone || "",
    emergency_consent:
      profile?.emergency_consent === true || hasStoredEmergencyContact(profile),
  };
}

type DirtyMap = Partial<Record<keyof ProfileEditFormValues, unknown>>;

/**
 * Builds the PATCH body from the fields the user actually touched.
 *
 * Two rules are load-bearing:
 *   - `email` is never produced, under any circumstance.
 *   - `emergency_consent` always accompanies emergency contact fields, because the backend
 *     treats the contact as one logical unit.
 */
export function buildProfilePatch(
  values: ProfileEditFormValues,
  defaults: ProfileFormDefaults,
  dirtyFields: DirtyMap
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (dirtyFields.firstName || dirtyFields.lastName) {
    const nextFullName = joinFullName(values.firstName, values.lastName || "");
    const currentFullName = joinFullName(defaults.firstName, defaults.lastName || "");
    if (nextFullName !== currentFullName) patch.full_name = nextFullName;
  }

  if (dirtyFields.birthday) patch.age = (values.birthday ?? "").trim();

  // Pronouns can change through a select or a free-text fallback; comparing values avoids a
  // known dirty-tracking quirk with that pairing.
  const nextPronouns = (values.pronouns || "").trim();
  if (nextPronouns !== (defaults.pronouns || "").trim()) patch.pronouns = nextPronouns;

  if (dirtyFields.timezone) patch.timezone = values.timezone;
  if (dirtyFields.phone) patch.phone = values.phone;
  if (dirtyFields.in_therapy) patch.in_therapy = values.in_therapy;
  if (dirtyFields.selected_goals) patch.selected_goals = values.selected_goals || [];
  if (dirtyFields.selected_triggers) patch.selected_triggers = values.selected_triggers || [];

  const contactDirty = Boolean(
    dirtyFields.emergency_contact_name ||
      dirtyFields.emergency_contact_relationship ||
      dirtyFields.emergency_contact_phone
  );

  if (contactDirty) {
    patch.emergency_contact_name = values.emergency_contact_name || "";
    patch.emergency_contact_relationship = values.emergency_contact_relationship || "";
    patch.emergency_contact_phone = values.emergency_contact_phone || "";
    patch.emergency_consent = values.emergency_consent === true;
  } else if (dirtyFields.emergency_consent) {
    patch.emergency_consent = values.emergency_consent === true;
  }

  return patch;
}

/** The fields the completion metric scores, unchanged from the pre-modal implementation. */
const COMPLETION_FIELDS: {
  key: keyof ProfileFormDefaults | "name";
  label: string;
  type?: "string" | "array";
  treatNotSpecifiedAsEmpty?: boolean;
}[] = [
  { key: "name", label: "Name", type: "string" },
  { key: "phone", label: "Phone", type: "string" },
  { key: "birthday", label: "Birthday", type: "string" },
  { key: "timezone", label: "Location", type: "string" },
  { key: "pronouns", label: "Pronouns", type: "string" },
  { key: "in_therapy", label: "In therapy", type: "string", treatNotSpecifiedAsEmpty: true },
  { key: "emergency_contact_name", label: "Emergency contact name", type: "string" },
  { key: "emergency_contact_phone", label: "Emergency contact phone", type: "string" },
  {
    key: "emergency_contact_relationship",
    label: "Emergency contact relationship",
    type: "string",
  },
  { key: "selected_goals", label: "Wellness goals", type: "array" },
  { key: "selected_triggers", label: "Content triggers", type: "array" },
];

export function computeProfileCompletion(defaults: ProfileFormDefaults) {
  let completed = 0;
  const missingFields: { label: string; key: string }[] = [];

  COMPLETION_FIELDS.forEach((field) => {
    const value =
      field.key === "name"
        ? joinFullName(defaults.firstName, defaults.lastName || "")
        : (defaults as any)[field.key];

    let filled = false;
    if (field.type === "array") {
      filled = Array.isArray(value) && value.length > 0;
    } else {
      const str = (value ?? "").toString().trim();
      filled =
        field.treatNotSpecifiedAsEmpty && str.toLowerCase() === "not specified"
          ? false
          : str.length > 0;
    }

    if (filled) completed++;
    else missingFields.push({ label: field.label, key: String(field.key) });
  });

  const percent = Math.round((completed / COMPLETION_FIELDS.length) * 100);
  return { percent, missingFields, isComplete: percent === 100 };
}
