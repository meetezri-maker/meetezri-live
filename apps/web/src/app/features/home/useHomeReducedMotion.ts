import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

/**
 * `useReducedMotion`, but always `false` for the first client render.
 *
 * The homepage is prerendered on the server, where the preference is unknown. Reading it
 * during hydration would give reduced-motion visitors different markup than the server sent;
 * this applies the preference one render later instead.
 */
export function useHomeReducedMotion(): boolean {
  const prefersReducedMotion = useReducedMotion();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated && prefersReducedMotion === true;
}
