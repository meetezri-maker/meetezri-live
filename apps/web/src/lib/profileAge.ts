/** `profiles.age` stores either a numeric age string ("24") or an ISO date of birth ("2000-04-15"). */

const ISO_DOB = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDobString(value: string): boolean {
  return ISO_DOB.test(value.trim());
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
  if (years < 13 || years > 120) return undefined;
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
