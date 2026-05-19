import { DASHBOARD_IMAGES } from "@/lib/solace/dashboardImages";
import { MOOD_CHECKIN_IMAGES } from "@/lib/solace/moodCheckInImages";

/** Full-bleed landscapes from dashboard + mood-check-in for heroes, cards, and thumbnails. */
export const SOLACE_CINEMATIC_POOL: readonly string[] = Array.from(
  new Set([
    DASHBOARD_IMAGES.heroAtmosphere,
    DASHBOARD_IMAGES.quoteDecor,
    DASHBOARD_IMAGES.journeyLake,
    DASHBOARD_IMAGES.journeyMountain,
    DASHBOARD_IMAGES.journeyForest,
    DASHBOARD_IMAGES.journeyDusk,
    DASHBOARD_IMAGES.brainHealth,
    DASHBOARD_IMAGES.brainHealthAccent,
    DASHBOARD_IMAGES.todayFocusDecor,
    MOOD_CHECKIN_IMAGES.heroBanner,
    MOOD_CHECKIN_IMAGES.calm,
    MOOD_CHECKIN_IMAGES.overwhelmed,
    MOOD_CHECKIN_IMAGES.hopeful,
    MOOD_CHECKIN_IMAGES.tired,
    MOOD_CHECKIN_IMAGES.heavy,
    MOOD_CHECKIN_IMAGES.grateful,
    "/dashboard-images/4.png",
    "/dashboard-images/5.png",
    "/dashboard-images/6.png",
    "/dashboard-images/7.png",
    "/dashboard-images/8.png",
    "/mood-check-in/3.png",
    "/mood-check-in/4.png",
    "/mood-check-in/6.png",
    "/mood-check-in/7.png",
  ])
);

function hashToIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i)) % length;
  }
  return hash;
}

/** Deterministic pick by string/number seed, or random when seed is omitted. */
export function pickSolaceCinematicImage(seed?: string | number): string {
  const pool = SOLACE_CINEMATIC_POOL;
  if (pool.length === 0) return DASHBOARD_IMAGES.heroAtmosphere;
  if (seed === undefined) {
    return pool[Math.floor(Math.random() * pool.length)]!;
  }
  if (typeof seed === "number") {
    return pool[Math.abs(seed) % pool.length]!;
  }
  return pool[hashToIndex(seed, pool.length)]!;
}

export function pickRandomSolaceCinematicImage(): string {
  return pickSolaceCinematicImage();
}
