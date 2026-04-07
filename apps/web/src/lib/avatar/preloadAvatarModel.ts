import { AVATAR_MODEL_URL } from "./avatarModelUrl";

let preloadPromise: Promise<void> | null = null;

/**
 * Warm HTTP cache for the avatar GLB while the user is still on lobby / other screens.
 * The file is large (~50MB+); preloading reduces perceived delay when ActiveSession mounts.
 */
export function preloadAvatarModel(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = fetch(AVATAR_MODEL_URL, {
    mode: "same-origin",
    cache: "force-cache",
  })
    .then(() => undefined)
    .catch(() => undefined);
  return preloadPromise;
}
