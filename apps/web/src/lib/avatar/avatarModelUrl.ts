/** Public URL for the GLB served from `public/`. Keep in sync with `index.html` preload. */
const base = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

export const AVATAR_MODEL_URL = `${base}T1.glb`;
