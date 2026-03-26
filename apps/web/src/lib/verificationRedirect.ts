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

type ResolveWebBaseUrlSource =
  | "DEV_FORCE_LOCAL"
  | "VITE_WEB_BASE_URL"
  | "window.location.origin"
  | "fallback";

export function resolveWebBaseUrlFromInputs(inputs: {
  dev: boolean;
  envBaseUrl?: string | null;
  windowOrigin?: string | null;
}): {
  baseUrl: string;
  isLocal: boolean;
  source: ResolveWebBaseUrlSource;
} {
  const envBase = safeGetOrigin(inputs.envBaseUrl ?? undefined);
  const envIsLocal = envBase ? isLocalOrigin(envBase) : false;
  const windowOrigin = safeGetOrigin(inputs.windowOrigin ?? "") || "";

  // In local development, always prioritize the current browser origin.
  // This avoids any stale or mismatched env var forcing production URLs.
  if (inputs.dev) {
    if (windowOrigin) {
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

export function resolveWebBaseUrl(): {
  baseUrl: string;
  isLocal: boolean;
  source: ResolveWebBaseUrlSource;
} {
  const envBaseUrl = import.meta.env.VITE_WEB_BASE_URL as string | undefined;
  const windowOrigin =
    typeof window !== "undefined" ? window.location.origin : undefined;
  return resolveWebBaseUrlFromInputs({
    dev: !!import.meta.env.DEV,
    envBaseUrl,
    windowOrigin,
  });
}

export function resolveExpectedPostVerificationTargetPath(
  signupType: SignupType
): string {
  // IMPORTANT: Keep paid onboarding entry unchanged.
  // Trial verification links should land on the in-app profile page
  // (this does not alter onboarding order/guards; it only changes the post-email click landing route).
  return signupType === "trial" ? "/app/user-profile" : "/onboarding/welcome";
}

export function resolveVerificationRedirectForFlow(signupType: SignupType): {
  emailRedirectTo: string;
  targetPath: string;
  baseUrl: string;
  isLocal: boolean;
  source: string;
} {
  // Trial-only hardening:
  // In practice, "local" dev often runs on LAN IPs / custom hosts (not just localhost),
  // and we must ensure trial verification links always come back to *the same origin
  // the user is currently using*.
  //
  // Paid verification redirects are generated server-side and already behave correctly;
  // this change only affects the TRIAL client-side redirect resolver.
  const trialWindowOrigin =
    signupType === "trial" && typeof window !== "undefined"
      ? safeGetOrigin(window.location.origin)
      : null;

  const resolved = resolveWebBaseUrl();
  const baseUrl = trialWindowOrigin || resolved.baseUrl;
  const isLocal = trialWindowOrigin ? isLocalOrigin(baseUrl) : resolved.isLocal;
  const source = trialWindowOrigin
    ? "window.location.origin(trial_override)"
    : resolved.source;

  const targetPath = resolveExpectedPostVerificationTargetPath(signupType);
  // Use exact final route URLs per flow so Supabase sends users directly.
  const emailRedirectTo = `${baseUrl}${targetPath}`;
  return { emailRedirectTo, targetPath, baseUrl, isLocal, source };
}

