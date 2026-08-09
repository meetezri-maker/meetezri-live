/**
 * Pre-launch landing page analytics events.
 *
 * Existing host-owned `window.dataLayer` events are preserved for launch
 * campaign continuity. Phase 1 also mirrors approved acquisition events to the
 * centralized GA4/Meta facade, where provider initialization and property
 * sanitization are enforced.
 *
 * Never pass the raw email address or any other form value as a property.
 */

import { trackMarketingEvent, type MarketingEventName } from "@/app/analytics";

export type PrelaunchAnalyticsEvent =
  | "prelaunch_landing_viewed"
  | "founding_member_cta_clicked"
  | "founding_member_form_started"
  | "founding_member_form_submitted"
  | "founding_member_submission_succeeded"
  | "founding_member_submission_failed"
  | "founding_member_existing_email"
  | "founder_video_opened"
  | "faq_item_opened";

/** Non-identifying context only: which CTA, which FAQ, which campaign. */
export type PrelaunchAnalyticsProps = Record<string, string | number | boolean | null>;

interface DataLayerWindow extends Window {
  dataLayer?: Array<Record<string, unknown>>;
}

const PRELAUNCH_EVENT_MAP: Partial<Record<PrelaunchAnalyticsEvent, MarketingEventName>> = {
  founding_member_cta_clicked: "early_access_cta_click",
  founding_member_form_started: "early_access_form_open",
  founding_member_submission_succeeded: "generate_lead",
  founder_video_opened: "founder_video_open",
};

export function trackPrelaunchEvent(
  event: PrelaunchAnalyticsEvent,
  props: PrelaunchAnalyticsProps = {}
): void {
  if (typeof window !== "undefined") {
    try {
      const target = window as DataLayerWindow;
      if (Array.isArray(target.dataLayer)) {
        target.dataLayer.push({ event, ...props });
      }
    } catch {
      /* Analytics must never break the page. */
    }
  }

  const mappedEvent = PRELAUNCH_EVENT_MAP[event];
  if (mappedEvent) {
    trackMarketingEvent(mappedEvent, props);
  }
}
