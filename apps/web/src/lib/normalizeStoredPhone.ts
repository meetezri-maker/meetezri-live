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

/** Empty is allowed; otherwise same rules as PhoneInput (7–12 digits total including country code). */
export function isValidOptionalAppPhone(value: string | undefined | null): boolean {
  const t = (value ?? "").trim();
  if (!t) return true;
  return t.startsWith("+") && countPhoneDigits(t) >= 7 && countPhoneDigits(t) <= 12;
}
