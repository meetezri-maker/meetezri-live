import { useEffect, useState } from "react";

function matches(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(query).matches;
}

/** Live `matchMedia` result. Returns `false` where matchMedia is unavailable (SSR, old jsdom). */
export function useMediaQuery(query: string): boolean {
  const [value, setValue] = useState(() => matches(query));
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const onChange = () => setValue(mql.matches);
    onChange();
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, [query]);
  return value;
}

/** Tailwind breakpoints used by the module. */
export const DESKTOP_QUERY = "(min-width: 1024px)";
export const WIDE_DESKTOP_QUERY = "(min-width: 1280px)";
export const COARSE_POINTER_QUERY = "(pointer: coarse)";
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
