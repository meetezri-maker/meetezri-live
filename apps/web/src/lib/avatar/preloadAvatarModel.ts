import { resolveCompanionModelUrl } from "./companionModelUrl";

const preloadByUrl = new Map<string, Promise<void>>();

/**
 * Warm HTTP cache for the avatar GLB while the user is still on lobby / other screens.
 * The file is large (~50MB+); preloading reduces perceived delay when ActiveSession mounts.
 */
export function preloadAvatarModel(modelUrl?: string): Promise<void> {
  const url = modelUrl ?? resolveCompanionModelUrl(undefined);
  const existing = preloadByUrl.get(url);
  if (existing) return existing;
  const p = fetch(url, {
    mode: "same-origin",
    cache: "force-cache",
  })
    .then(() => undefined)
    .catch(() => undefined);
  preloadByUrl.set(url, p);
  return p;
}
