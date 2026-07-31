/**
 * Imagery for the pre-launch landing page.
 *
 * Scenery reuses the approved cinematic Solace plates already in `public/`.
 * Product screens use real Solace application screenshots where they exist —
 * `PRODUCT_SCREENS` marks the rest as `pending`, and the preview components
 * render a labelled placeholder for those rather than a fabricated UI.
 */

/** Section 1 — hero. Night lake, same plate the main site hero uses. */
export const PRELAUNCH_HERO_BG = "/community/hero-lake.jpg";

/*
 * The former recognition backdrop (`/community/scene-forest.jpg`) was retired
 * with that section. Despite the filename it is a desert highway, which the
 * Blueprint's environmental guardrails exclude.
 */

/*
 * Two backdrops were retired with their sections: the purpose mountains
 * (`/solace/health-background-calm-mountains.jpg`) with "Why We Built Solace",
 * and the final-invitation plate (`/solace/emergency-contact-twilight-lake.jpg`)
 * when that section was folded into the FAQ. Both files remain in `public/`;
 * they are shared assets, not landing-owned.
 */

/** Founding circle. Warmest plate on the page. */
export const PRELAUNCH_FOUNDING_CIRCLE_BG = "/solace/onboarding-complete-twilight-lake.jpg";

/**
 * Section 5 — founder. Twilight lake with blossom, mountains, and a mirrored
 * reflection.
 *
 * Replaces `/solace/profile-setup-twilight-valley.jpg`, which despite its name
 * is a screenshot of the onboarding form complete with placeholder test data.
 * It was invisible under this section's heavy scrim, but a product UI screen is
 * not scenery and should never have been the backdrop.
 */
export const PRELAUNCH_FOUNDER_BG = "/solace/emotional-focus-twilight-sanctuary.jpg";

/**
 * Section 2 — Human Moments. One approved plate per moment, keyed by moment id.
 *
 * Every plate was opened and visually confirmed; filenames in this repository
 * are not reliable. Each is matched to the emotional beat of its moment:
 * a quiet lamplit night, a shooting star over still peaks, sunrise above a sea
 * of cloud, and calm water at dusk.
 *
 * The images carry no information the copy does not already state, so they are
 * marked decorative with empty alt text and the moment title and narrative
 * remain available as text.
 */
export const PRELAUNCH_MOMENT_IMAGES: Record<string, string> = {
  "quiet-day": "/community/scene-bedroom.jpg",
  "small-win": "/community/scene-stars.jpg",
  "big-decision": "/solace/companion-selection-calm-mountain.jpg",
  "everyday-life": "/community/scene-water.jpg",
};

/*
 * The product-screenshot carousel was removed with the Meet Solace and
 * More Than a Conversation sections. Appendix A makes the introduction video
 * the product demonstration, and seven of the nine screens had no approved
 * asset, so the screen catalogue went with it.
 */
/**
 * Founder assets. Both are still to be supplied; the components render an
 * accessible placeholder rather than substituting an unrelated image or a
 * fabricated portrait.
 */
export const FOUNDER_VIDEO_SRC: string | null = null;
export const FOUNDER_VIDEO_POSTER: string | null = null;
export const FOUNDER_VIDEO_CAPTIONS_SRC: string | null = null;
export const FOUNDER_PORTRAIT_SRC: string | null = null;
