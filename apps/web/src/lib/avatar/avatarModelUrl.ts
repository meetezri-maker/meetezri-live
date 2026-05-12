/** Vite `public/` base (e.g. `/` or `/app/`). */
export function getVitePublicBaseUrl(): string {
  return import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
}

/** Default 3D model when no companion-specific GLB is registered. */
export const DEFAULT_AVATAR_MODEL_URL = `${getVitePublicBaseUrl()}jordan Taylor.glb`;

/** @deprecated Use {@link DEFAULT_AVATAR_MODEL_URL} or {@link resolveCompanionModelUrl}. */
export const AVATAR_MODEL_URL = DEFAULT_AVATAR_MODEL_URL;
