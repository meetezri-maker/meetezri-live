/** Static assets under `public/talk-it-out/` for the Talk It Out lobby. */
export const TALK_IT_OUT_IMAGES = {
  /** Hero — night lake, dock, and candle lantern */
  heroBackground: "/talk-it-out/1.png",
  /** Warm candle glow — layered on hero lower-left */
  heroCandleAccent: "/talk-it-out/2.png",
  /** Moonlit lake — hero / environment atmosphere */
  heroMoonLayer: "/talk-it-out/3.png",
  /** Environment: Night Lake (matches hero scene) */
  environmentNightLake: "/talk-it-out/1.png",
  /** Environment: Mist Forest */
  environmentForest: "/talk-it-out/4.png",
  /** Environment: Golden river at sunset */
  environmentSunsetRiver: "/talk-it-out/5.png",
  /** Environment: Cozy cabin porch */
  environmentCozyCabin: "/talk-it-out/6.png",
  /** Environment: Campfire in the woods */
  environmentCampfire: "/talk-it-out/7.png",
  /** “Before we begin” lotus accent */
  lotusDecor: "/talk-it-out/8.png",
  /** Ambient player thumbnail — Night Calm */
  ambientThumbnail: "/talk-it-out/9.png",
  /** Full-page cool texture */
  pageBackground: "/talk-it-out/10.png",
  /** Violet glow overlay */
  pageGlow: "/talk-it-out/11.png",
  /** Ember particles on hero */
  heroEmbers: "/talk-it-out/12.png",
  /** Companion portrait fallback (Jordan) when avatar URL is missing */
  companionPortrait: "/talk-it-out/companion-portrait.png",
  /** “How would you like to start?” — Talk freely (warm candle) */
  startTalkFreely: "/talk-it-out/2.png",
  /** Guided talk (lotus / mindful) */
  startGuided: "/talk-it-out/8.png",
  /** Deep reflection (cozy cabin) */
  startDeep: "/talk-it-out/6.png",
  /** Quick check-in (mist forest) */
  startQuick: "/talk-it-out/4.png",
} as const;

export const TALK_IT_OUT_START_CARDS = [
  { key: "freely", image: TALK_IT_OUT_IMAGES.startTalkFreely, title: "Talk freely" },
  { key: "guided", image: TALK_IT_OUT_IMAGES.startGuided, title: "Guided talk" },
  { key: "deep", image: TALK_IT_OUT_IMAGES.startDeep, title: "Deep reflection" },
  { key: "quick", image: TALK_IT_OUT_IMAGES.startQuick, title: "Quick check-in" },
] as const;

export const TALK_IT_OUT_ENVIRONMENT_THUMBS: {
  label: string;
  image: string;
  value: string;
}[] = [
  {
    label: "Night Lake",
    image: TALK_IT_OUT_IMAGES.environmentNightLake,
    value: "mountains",
  },
  {
    label: "Forest Calm",
    image: TALK_IT_OUT_IMAGES.environmentForest,
    value: "forest",
  },
  {
    label: "Golden River",
    image: TALK_IT_OUT_IMAGES.environmentSunsetRiver,
    value: "minimal",
  },
  {
    label: "Campfire Woods",
    image: TALK_IT_OUT_IMAGES.environmentCampfire,
    value: "beach",
  },
];
