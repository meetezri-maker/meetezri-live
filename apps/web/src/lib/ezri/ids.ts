const ANON_USERID_STORAGE_KEY = "ezri_userid";

function generateId(prefix: string): string {
  // Prefer crypto.randomUUID when available (modern browsers).
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${uuid}`;
}

export function getOrCreateEzriUserid(authUserId?: string | null): string {
  const trimmed = (authUserId ?? "").trim();
  if (trimmed) return trimmed;

  if (typeof window === "undefined") return generateId("anon");

  try {
    const existing = window.localStorage.getItem(ANON_USERID_STORAGE_KEY);
    if (existing && existing.trim()) return existing.trim();
    const next = generateId("anon");
    window.localStorage.setItem(ANON_USERID_STORAGE_KEY, next);
    return next;
  } catch {
    return generateId("anon");
  }
}

export function createNewEzriSessionId(): string {
  return generateId("session");
}

