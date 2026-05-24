import { format, isValid, parse, parseISO } from "date-fns";

/** `profiles.age` stores either a numeric age string ("24") or an ISO date of birth ("2000-04-15"). */

export const MIN_ACCOUNT_AGE_YEARS = 18;

export const minAccountAgeMessage = `You must be at least ${MIN_ACCOUNT_AGE_YEARS} years old to use Solace.`;

const ISO_DOB = /^\d{4}-\d{2}-\d{2}$/;

const DOB_INPUT_FORMATS = [
  "MM/dd/yyyy",
  "M/d/yyyy",
  "yyyy-MM-dd",
  "MMM d, yyyy",
  "MM-dd-yyyy",
] as const;

export function isBirthDateAllowed(birth: Date, minAgeYears: number): boolean {
  const max = new Date();
  max.setHours(12, 0, 0, 0);
  max.setFullYear(max.getFullYear() - minAgeYears);
  const normalized = new Date(birth);
  normalized.setHours(12, 0, 0, 0);
  return normalized.getTime() <= max.getTime();
}

/** Parse typed DOB (keyboard) into ISO `YYYY-MM-DD`, empty, or invalid. */
export function parseDateOfBirthInput(
  raw: string,
  minAgeYears = 13
): { iso: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return { iso: "" };

  if (isIsoDobString(trimmed)) {
    const birth = parseISO(trimmed);
    if (!isValid(birth) || !isBirthDateAllowed(birth, minAgeYears)) return null;
    return { iso: trimmed };
  }

  for (const pattern of DOB_INPUT_FORMATS) {
    const birth = parse(trimmed, pattern, new Date());
    if (isValid(birth) && isBirthDateAllowed(birth, minAgeYears)) {
      return { iso: format(birth, "yyyy-MM-dd") };
    }
  }

  return null;
}

/** Display string for DOB text input while editing. */
export function formatDateOfBirthForInput(iso: string): string {
  if (!isIsoDobString(iso)) return "";
  const birth = parseISO(iso);
  if (!isValid(birth)) return "";
  return format(birth, "MM/dd/yyyy");
}
export function isIsoDobString(value: string): boolean {
  return ISO_DOB.test(value.trim());
}

/** True when ISO DOB meets minimum age; empty string is allowed. */
export function isIsoDobMeetingMinAge(
  iso: string,
  minAgeYears = MIN_ACCOUNT_AGE_YEARS
): boolean {
  const trimmed = iso?.trim() ?? "";
  if (!trimmed) return true;
  if (!isIsoDobString(trimmed)) return true;
  const birth = parseISO(trimmed);
  if (!isValid(birth)) return false;
  return isBirthDateAllowed(birth, minAgeYears);
}

/** Latest allowed birth date (user must be at least `minAgeYears` old). */
export function maxBirthDateForMinAge(minAgeYears = MIN_ACCOUNT_AGE_YEARS): Date {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setFullYear(date.getFullYear() - minAgeYears);
  return date;
}

export function birthIsoToAgeYears(iso: string): number | undefined {
  const trimmed = iso?.trim() ?? "";
  if (!ISO_DOB.test(trimmed)) return undefined;
  const birth = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return undefined;
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  const md = today.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) {
    years -= 1;
  }
  if (!Number.isFinite(years)) return undefined;
  if (years < 0) return undefined;
  return years;
}

/** Value for `<input type="date" />` (YYYY-MM-DD) when DOB is stored; otherwise "". */
export function profileAgeStorageToDateInput(age: string | null | undefined): string {
  if (!age || typeof age !== "string") return "";
  const t = age.trim();
  return ISO_DOB.test(t) ? t : "";
}

/** Value for "Age" numeric field on User Profile when storage is ISO or plain digits. */
export function profileAgeStorageToDisplayYears(age: string | null | undefined): string {
  if (!age || typeof age !== "string") return "";
  const t = age.trim();
  if (ISO_DOB.test(t)) {
    const y = birthIsoToAgeYears(t);
    return y !== undefined ? String(y) : "";
  }
  return t;
}

/** Human-readable age for profile / settings rails (e.g. "24 years old"). */
export function profileAgeDisplayLabel(age: string | null | undefined): string {
  const years = profileAgeStorageToDisplayYears(age);
  if (!years) return "";
  const n = Number.parseInt(years, 10);
  if (!Number.isFinite(n) || n < 0) return "";
  return `${n} years old`;
}
