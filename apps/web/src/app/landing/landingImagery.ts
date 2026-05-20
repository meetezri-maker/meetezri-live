/**
 * Landing-only scenery — do NOT use login-cinematic-lock.png (contains login UI artwork).
 * Do NOT reuse auth/signup hero plates; keep landing visually independent.
 */
export const LANDING_HERO_BG = "/community/hero-lake.jpg";

/** Background image inside the “Ready to Start” CTA card only */
export const LANDING_CTA_CARD_BG = "/talk-it-out/5.png";

/** “Simple. Effective. Personal.” step icon boxes (steps 1–3) */
export const LANDING_STEP_BACKGROUNDS = [
  "/wellness-tools/11.png",
  "/wellness-tools/12.png",
  "/wellness-tools/13.png",
] as const;

/** How It Works journey cards — steps 1, 2, and 4 photo panels */
export const HOW_IT_WORKS_STEP_IMAGES: Partial<Record<1 | 2 | 3 | 4, string>> = {
  1: "/community/1.png",
  2: "/community/2.png",
  4: "/community/3.png",
};
