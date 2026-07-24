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

/** Section 2 — recognition. Forest at dusk. */
export const PRELAUNCH_RECOGNITION_BG = "/community/scene-forest.jpg";

/** Section 6 — purpose. Mountains, no people, no technology. */
export const PRELAUNCH_PURPOSE_BG = "/solace/health-background-calm-mountains.jpg";

/** Section 8 — founding circle. Warmest plate on the page. */
export const PRELAUNCH_FOUNDING_CIRCLE_BG = "/solace/onboarding-complete-twilight-lake.jpg";

/** Section 11 — final invitation. Brightest plate on the page. */
export const PRELAUNCH_FINAL_BG = "/solace/emergency-contact-twilight-lake.jpg";

/** Section 7 — founder. Warm, minimal backdrop behind the video card. */
export const PRELAUNCH_FOUNDER_BG = "/solace/profile-setup-twilight-valley.jpg";

/**
 * Section 4 story imagery, mapped to the approved direction for each card.
 * These are approved Solace cinematic plates, not stock photography.
 */
export const PRELAUNCH_STORY_IMAGES = [
  "/community/scene-bedroom.jpg",
  "/solace/companion-selection-calm-mountain.jpg",
  "/community/scene-water.jpg",
  "/community/scene-stars.jpg",
] as const;

export type ProductScreenId =
  | "dashboard"
  | "talk-it-out"
  | "journal"
  | "mood"
  | "habits"
  | "sleep"
  | "goals"
  | "community"
  | "progress";

export interface ProductScreen {
  id: ProductScreenId;
  /** Short caption explaining how the screen supports the overall journey. */
  label: string;
  caption: string;
  /** `null` when no approved screenshot exists yet — renders a labelled placeholder. */
  src: string | null;
}

/**
 * Approved screenshot sequence for Section 5, reused by the Section 3 preview.
 * Order matches the document: Dashboard → Talk It Out → Journal → Mood → Habits
 * → Sleep → Goals → Community → Progress.
 */
export const PRODUCT_SCREENS: ProductScreen[] = [
  {
    id: "dashboard",
    label: "Home Dashboard",
    caption: "Everything you're working on, gathered in one calm place.",
    src: "/dashboard-images/dashboard.png",
  },
  {
    id: "talk-it-out",
    label: "Talk It Out",
    caption: "A private space to speak freely and organize your thoughts.",
    src: null,
  },
  {
    id: "journal",
    label: "Journal",
    caption: "Capture today before it becomes a memory.",
    src: null,
  },
  {
    id: "mood",
    label: "Mood",
    caption: "Notice emotional patterns and what influences your wellbeing.",
    src: null,
  },
  {
    id: "habits",
    label: "Habits",
    caption: "Small routines, built one step at a time.",
    src: null,
  },
  {
    id: "sleep",
    label: "Sleep",
    caption: "Understand how rest shapes the rest of your day.",
    src: "/sleep-tracker/ChatGPT Image May 14, 2026, 02_15_01 PM.png",
  },
  {
    id: "goals",
    label: "Goals & Achievements",
    caption: "Every step forward deserves to be seen.",
    src: null,
  },
  {
    id: "community",
    label: "Community",
    caption: "Encouragement from people who understand the journey.",
    src: null,
  },
  {
    id: "progress",
    label: "Progress & Insights",
    caption: "Growth becomes clearer when you can look back.",
    src: "/progress/progress ref.png",
  },
];

/** Screens still awaiting an approved screenshot. Surfaced in the delivery report. */
export const PENDING_PRODUCT_SCREENS = PRODUCT_SCREENS.filter(
  (screen) => screen.src === null
).map((screen) => screen.label);

/**
 * Founder assets. Both are still to be supplied; the components render an
 * accessible placeholder rather than substituting an unrelated image or a
 * fabricated portrait.
 */
export const FOUNDER_VIDEO_SRC: string | null = null;
export const FOUNDER_VIDEO_POSTER: string | null = null;
export const FOUNDER_VIDEO_CAPTIONS_SRC: string | null = null;
export const FOUNDER_PORTRAIT_SRC: string | null = null;
