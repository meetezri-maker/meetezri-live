/** Static assets under `public/community/` for the Community page. */
export const COMMUNITY_IMAGES = {
  /** Hero — gathering by the lake at twilight */
  hero: "/community/1.png",
  /** Right-rail daily reminder card */
  dailyReminder: "/community/2.png",
  /** Optional accent (campfire / togetherness) */
  togetherness: "/community/3.png",
  /** Legacy JPEG scenes — post card backdrops */
  sceneWater: "/community/scene-water.jpg",
  sceneBedroom: "/community/scene-bedroom.jpg",
  sceneForest: "/community/scene-forest.jpg",
  sceneStars: "/community/scene-stars.jpg",
  /** Find-your-circle card backdrops */
  circleLake: "/community/hero-lake.jpg",
} as const;

/** One backdrop per support-space card (order matches Community SUPPORT_SPACES). */
export const COMMUNITY_CIRCLE_CARD_IMAGES: readonly string[] = [
  COMMUNITY_IMAGES.sceneWater,
  COMMUNITY_IMAGES.sceneStars,
  COMMUNITY_IMAGES.sceneForest,
  COMMUNITY_IMAGES.sceneBedroom,
  COMMUNITY_IMAGES.togetherness,
  COMMUNITY_IMAGES.circleLake,
] as const;

/** Rotating scenic backdrops on feed post cards (community + shared Solace pool). */
export const COMMUNITY_POST_SCENES: readonly string[] = [
  COMMUNITY_IMAGES.sceneWater,
  COMMUNITY_IMAGES.sceneBedroom,
  COMMUNITY_IMAGES.sceneForest,
  COMMUNITY_IMAGES.sceneStars,
  "/community/2.png",
  "/community/3.png",
  "/mood-check-in/1.png",
  "/sleep-tracker/hero.png",
] as const;

export function communityPostSceneForId(postId: string): string {
  let h = 0;
  for (let i = 0; i < postId.length; i++) h = (h * 31 + postId.charCodeAt(i)) >>> 0;
  return COMMUNITY_POST_SCENES[h % COMMUNITY_POST_SCENES.length]!;
}
