/** Static assets under `public/talk-it-out/` for the Talk It Out lobby. */
export const TALK_IT_OUT_IMAGES = {
  /** Hero — sunset mountain lake (`public/wellness-tools/6.png`) */
  heroBackground: "/wellness-tools/6.png",
  /** Warm candle glow — layered on hero lower-left */
  heroCandleAccent: "/talk-it-out/2.png",
  /** Moonlit lake — hero / environment atmosphere */
  heroMoonLayer: "/talk-it-out/3.png",
  /** Environment thumbnails — `public/Avatar-bg/` */
  environmentNightLake: "/Avatar-bg/B1.png",
  environmentForest: "/Avatar-bg/B3.png",
  environmentSunsetRiver: "/Avatar-bg/B4.png",
  environmentCozyCabin: "/talk-it-out/6.png",
  environmentCampfire: "/Avatar-bg/IMG_2250.jpeg",
  /** “Before we begin” lotus accent */
  lotusDecor: "/talk-it-out/8.png",
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
    label: "Minimal Luxe Pedestal",
    image: TALK_IT_OUT_IMAGES.environmentNightLake,
    value: "mountains",
  },
  {
    label: "Padded Editorial Chamber",
    image: TALK_IT_OUT_IMAGES.environmentForest,
    value: "forest",
  },
  {
    label: "Aqua Serenity Stage",
    image: TALK_IT_OUT_IMAGES.environmentSunsetRiver,
    value: "minimal",
  },
  {
    label: "Monolith Gallery Space",
    image: TALK_IT_OUT_IMAGES.environmentCampfire,
    value: "beach",
  },
];
