/**
 * Values saved without "+" (legacy/plain digits) get a leading "+" so PhoneInput
 * can match a country prefix and enforce digit limits consistently.
 */
export function normalizeStoredPhoneForInput(raw: string | undefined | null): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (t.startsWith("+")) return t;
  const digits = t.replace(/\D/g, "");
  if (!digits) return "";
  return `+${digits}`;
}

export function countPhoneDigits(value: string): number {
  return (value.match(/\d/g) || []).length;
}

export const MIN_PHONE_DIGITS = 7;
export const MAX_PHONE_DIGITS = 15;

/** Empty is allowed; otherwise require +country code and 7–15 digits total (E.164). */
export function isValidOptionalAppPhone(value: string | undefined | null): boolean {
  const t = (value ?? "").trim();
  if (!t) return true;
  const n = countPhoneDigits(t);
  return t.startsWith("+") && n >= MIN_PHONE_DIGITS && n <= MAX_PHONE_DIGITS;
}
