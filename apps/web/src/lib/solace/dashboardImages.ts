import type { JourneyAmbiance } from "@/app/solace/SolaceJourneyCardVisual";

/** Static assets under `public/dashboard-images/` for the member dashboard. */
export const DASHBOARD_IMAGES = {
  /** Ezri companion portrait — hero card left panel */
  companionHero: "/dashboard-images/companion-hero.png",
  /** Sidebar profile photo (fallback when user has no avatar_url) */
  userAvatar: "/dashboard-images/user-avatar.png",
  /** Starry lake — hero card atmosphere behind greeting copy */
  heroAtmosphere: "/dashboard-images/first.jpg",
  /** Journey: Deep Focus */
  journeyLake: "/dashboard-images/4.png",
  /** Journey: Evening Unwind */
  journeyMountain: "/dashboard-images/5.png",
  /** Journey: Anxiety Release */
  journeyForest: "/dashboard-images/6.png",
  /** Journey: Gratitude Reflection (warm sunset) */
  journeyDusk: "/dashboard-images/journey-gratitude.png",
  /** Brain health rail card — detailed illustration */
  brainHealth: "/dashboard-images/3.png",
  /** Brain health card — neural network accent layer */
  brainHealthAccent: "/dashboard-images/9.png",
  /** Quote card — warm candle glow accent */
  quoteDecor: "/dashboard-images/2.png",
  /** Today's focus rail — misty river forest atmosphere */
  todayFocusDecor: "/dashboard-images/8.png",
} as const;

export const JOURNEY_AMBIANCE_IMAGE: Record<JourneyAmbiance, string> = {
  lake: DASHBOARD_IMAGES.journeyLake,
  mountain: DASHBOARD_IMAGES.journeyMountain,
  forest: DASHBOARD_IMAGES.journeyForest,
  dusk: DASHBOARD_IMAGES.journeyDusk,
};
