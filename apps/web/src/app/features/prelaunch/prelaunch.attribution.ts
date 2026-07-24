/**
 * Campaign attribution for the pre-launch landing page.
 *
 * Captured once on load and kept in sessionStorage so it survives the visitor
 * scrolling the page and opening the signup modal much later in the same visit.
 * Nothing persists beyond the session — no cross-session tracking is introduced.
 */

const STORAGE_KEY = "solace.prelaunch.attribution";

/** Server caps these too; clipping here keeps the request small and predictable. */
const VALUE_MAX_LENGTH = 255;
const URL_MAX_LENGTH = 2048;

export interface PrelaunchAttribution {
  source: string;
  campaign: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrer: string | null;
  landingPage: string | null;
}

export const PRELAUNCH_SOURCE = "prelaunch_landing_page";
export const PRELAUNCH_CONSENT_SOURCE = "prelaunch_founding_member_form";

export const EMPTY_ATTRIBUTION: PrelaunchAttribution = {
  source: PRELAUNCH_SOURCE,
  campaign: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null,
  referrer: null,
  landingPage: null,
};

function clean(value: string | null | undefined, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function readStored(): PrelaunchAttribution | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PrelaunchAttribution>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      ...EMPTY_ATTRIBUTION,
      ...parsed,
      source: clean(parsed.source, VALUE_MAX_LENGTH) ?? PRELAUNCH_SOURCE,
    };
  } catch {
    // Malformed value, private-mode storage, or JSON failure — fall back to a fresh read.
    return null;
  }
}

function persist(attribution: PrelaunchAttribution): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    /* Storage is a convenience here, never a requirement. */
  }
}

/** Reads UTM values from the current URL. Malformed query strings resolve to nulls. */
export function readAttributionFromLocation(
  search: string,
  referrer: string | null,
  pathname: string
): PrelaunchAttribution {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    params = new URLSearchParams();
  }

  const utmCampaign = clean(params.get("utm_campaign"), VALUE_MAX_LENGTH);

  return {
    source: PRELAUNCH_SOURCE,
    campaign: clean(params.get("campaign"), VALUE_MAX_LENGTH) ?? utmCampaign,
    utmSource: clean(params.get("utm_source"), VALUE_MAX_LENGTH),
    utmMedium: clean(params.get("utm_medium"), VALUE_MAX_LENGTH),
    utmCampaign,
    utmContent: clean(params.get("utm_content"), VALUE_MAX_LENGTH),
    utmTerm: clean(params.get("utm_term"), VALUE_MAX_LENGTH),
    referrer: clean(referrer, URL_MAX_LENGTH),
    landingPage: clean(pathname, URL_MAX_LENGTH),
  };
}

function hasAnyUtm(attribution: PrelaunchAttribution): boolean {
  return Boolean(
    attribution.utmSource ||
      attribution.utmMedium ||
      attribution.utmCampaign ||
      attribution.utmContent ||
      attribution.utmTerm
  );
}

/**
 * Resolves attribution for this visit, preferring UTM values present in the
 * current URL and otherwise reusing whatever was captured earlier in the session.
 */
export function resolvePrelaunchAttribution(): PrelaunchAttribution {
  if (typeof window === "undefined") return EMPTY_ATTRIBUTION;

  const fromUrl = readAttributionFromLocation(
    window.location.search,
    document.referrer || null,
    window.location.pathname
  );

  if (hasAnyUtm(fromUrl)) {
    persist(fromUrl);
    return fromUrl;
  }

  const stored = readStored();
  if (stored && hasAnyUtm(stored)) return stored;

  persist(fromUrl);
  return fromUrl;
}
