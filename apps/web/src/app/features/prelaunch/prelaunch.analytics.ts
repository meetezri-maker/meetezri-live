/**
 * Pre-launch landing page analytics events.
 *
 * The repository has no analytics provider, and this task must not introduce one.
 * Events are therefore dispatched to whatever the host page already exposes
 * (`window.dataLayer`, which a tag manager would populate) and are otherwise a
 * no-op. Wiring a real provider later means reading these same event names.
 *
 * Never pass the raw email address or any other form value as a property.
 */

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

export function trackPrelaunchEvent(
  event: PrelaunchAnalyticsEvent,
  props: PrelaunchAnalyticsProps = {}
): void {
  if (typeof window === "undefined") return;

  try {
    const target = window as DataLayerWindow;
    if (!Array.isArray(target.dataLayer)) return;
    target.dataLayer.push({ event, ...props });
  } catch {
    /* Analytics must never break the page. */
  }
}
