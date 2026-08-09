import { canInitializeAnalytics } from "./config";
import { trackGa4Event } from "./ga4";
import { trackMetaCustomEvent, trackMetaEvent } from "./meta";

export type MarketingEventName =
  | "early_access_cta_click"
  | "early_access_form_open"
  | "generate_lead"
  | "founder_video_open"
  | "pricing_cta_click"
  | "signup_start"
  | "signup_complete"
  | "checkout_started";

export type MarketingEventProperties = Partial<Record<
  "origin" | "status" | "signup_type" | "plan_tier" | "checkout_type",
  string | number | boolean | null
>>;

const ALLOWED_PROPERTY_KEYS = new Set([
  "origin",
  "status",
  "signup_type",
  "plan_tier",
  "checkout_type",
]);

const FORBIDDEN_KEY_PATTERN =
  /(^|_)(email|name|phone|userid|user_id|sessionid|session_id|conversationid|conversation_id|query|message|text|transcript|journal|mood|sleep|habit|crisis|token|access_token|refresh_token|code|error_description)($|_)/i;

const FORBIDDEN_VALUE_PATTERN =
  /(@|access_token|refresh_token|session_id|sessionId|conversation_id|conversationId|error_description|<script|bearer\s+)/i;

const EVENT_MAP: Record<
  MarketingEventName,
  { ga4: string; meta: string; metaCustom?: boolean }
> = {
  early_access_cta_click: { ga4: "early_access_cta_click", meta: "EarlyAccessCtaClick", metaCustom: true },
  early_access_form_open: { ga4: "early_access_form_open", meta: "EarlyAccessFormOpen", metaCustom: true },
  generate_lead: { ga4: "generate_lead", meta: "Lead" },
  founder_video_open: { ga4: "founder_video_open", meta: "FounderVideoOpen", metaCustom: true },
  pricing_cta_click: { ga4: "pricing_cta_click", meta: "PricingCtaClick", metaCustom: true },
  signup_start: { ga4: "signup_start", meta: "SignupStart", metaCustom: true },
  signup_complete: { ga4: "sign_up", meta: "CompleteRegistration" },
  checkout_started: { ga4: "begin_checkout", meta: "InitiateCheckout" },
};

function isSafeValue(value: unknown): value is string | number | boolean | null {
  if (value === null) return true;
  if (typeof value === "number" || typeof value === "boolean") return true;
  return typeof value === "string" && !FORBIDDEN_VALUE_PATTERN.test(value);
}

export function sanitizeMarketingEventProperties(
  properties: Record<string, unknown> = {}
): MarketingEventProperties {
  const safe: MarketingEventProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTY_KEYS.has(key)) continue;
    if (FORBIDDEN_KEY_PATTERN.test(key)) continue;
    if (!isSafeValue(value)) continue;
    safe[key as keyof MarketingEventProperties] = value;
  }
  return safe;
}

export function trackMarketingEvent(
  name: MarketingEventName,
  properties: Record<string, unknown> = {}
): void {
  const mapped = EVENT_MAP[name];
  if (!mapped || !canInitializeAnalytics()) return;

  const safeProperties = sanitizeMarketingEventProperties(properties);
  trackGa4Event(mapped.ga4, safeProperties);
  if (mapped.metaCustom) trackMetaCustomEvent(mapped.meta, safeProperties);
  else trackMetaEvent(mapped.meta, safeProperties);
}

