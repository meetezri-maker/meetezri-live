type SignupType = "trial" | "plan";

function safeGetOrigin(urlOrOrigin?: string | null): string | null {
  if (!urlOrOrigin) return null;
  try {
    return new URL(urlOrOrigin).origin;
  } catch {
    // If the string is already an origin-like value.
    return urlOrOrigin;
  }
}

function isLocalOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    const host = u.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    // Fallback for malformed values.
    return (
      origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      origin.includes("::1")
    );
  }
}

export function resolveWebBaseUrl(): {
  baseUrl: string;
  isLocal: boolean;
  source: "DEV_FORCE_LOCAL" | "VITE_WEB_BASE_URL" | "window.location.origin" | "fallback";
} {
  const envBase = safeGetOrigin(import.meta.env.VITE_WEB_BASE_URL as
    | string
    | undefined);
  const envIsLocal = envBase ? isLocalOrigin(envBase) : false;
  const windowOrigin =
    typeof window !== "undefined" ? window.location.origin : "";

  // In local development, always prioritize the current browser origin.
  // This avoids any stale or mismatched env var forcing production URLs.
  if (import.meta.env.DEV) {
    if (windowOrigin && isLocalOrigin(windowOrigin)) {
      return {
        baseUrl: windowOrigin,
        isLocal: true,
        source: "DEV_FORCE_LOCAL",
      };
    }
    return {
      baseUrl: "http://localhost:5173",
      isLocal: true,
      source: "DEV_FORCE_LOCAL",
    };
  }

  if (envBase && envIsLocal) {
    return { baseUrl: envBase, isLocal: true, source: "VITE_WEB_BASE_URL" };
  }
  if (windowOrigin && isLocalOrigin(windowOrigin)) {
    return {
      baseUrl: windowOrigin,
      isLocal: true,
      source: "window.location.origin",
    };
  }

  // Non-local: prefer env base url if present, else fall back to current origin.
  if (envBase) {
    return { baseUrl: envBase, isLocal: false, source: "VITE_WEB_BASE_URL" };
  }
  if (windowOrigin) {
    return {
      baseUrl: windowOrigin,
      isLocal: false,
      source: "window.location.origin",
    };
  }

  // Final fallback for development/test.
  return { baseUrl: "http://localhost:5173", isLocal: true, source: "fallback" };
}

export function resolveExpectedPostVerificationTargetPath(
  signupType: SignupType
): string {
  return signupType === "trial" ? "/onboarding/profile-setup" : "/onboarding/welcome";
}

export function resolveVerificationRedirectForFlow(signupType: SignupType): {
  emailRedirectTo: string;
  targetPath: string;
  baseUrl: string;
  isLocal: boolean;
  source: string;
} {
  const { baseUrl, isLocal, source } = resolveWebBaseUrl();
  const targetPath = resolveExpectedPostVerificationTargetPath(signupType);
  // Use exact final route URLs per flow so Supabase sends users directly.
  const emailRedirectTo = `${baseUrl}${targetPath}`;
  return { emailRedirectTo, targetPath, baseUrl, isLocal, source };
}

