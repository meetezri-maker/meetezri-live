import { useEffect, useState } from "react";

/**
 * When each scroll-pinned homepage section has room to pin.
 *
 * A pinned section holds its content in a viewport-high stage while the page scrolls past it.
 * That only works when the whole stage fits below the floating header, so each section pins
 * only above a minimum viewport height measured for its layout at that width, and never when the
 * visitor prefers reduced motion. Everywhere else the section falls back to normal document flow
 * with the same content.
 *
 * The same queries drive the CSS in `home.css`, which decides the layout from the first paint
 * (so the server-rendered page and the hydrated page agree). `HomePage.test.tsx` checks the two
 * copies stay identical.
 */
export const PIN_QUERIES = {
  features:
    "(prefers-reduced-motion: no-preference) and (max-width: 639px) and (min-height: 1090px), (prefers-reduced-motion: no-preference) and (min-width: 640px) and (max-width: 1023px) and (min-height: 1045px), (prefers-reduced-motion: no-preference) and (min-width: 1024px) and (max-width: 1279px) and (min-height: 1090px), (prefers-reduced-motion: no-preference) and (min-width: 1280px) and (min-height: 970px)",
  howItWorks:
    "(prefers-reduced-motion: no-preference) and (max-width: 639px) and (min-height: 840px), (prefers-reduced-motion: no-preference) and (min-width: 640px) and (max-width: 1023px) and (min-height: 945px), (prefers-reduced-motion: no-preference) and (min-width: 1024px) and (min-height: 1000px)",
  moments:
    "(prefers-reduced-motion: no-preference) and (max-width: 1023px) and (min-height: 780px), (prefers-reduced-motion: no-preference) and (min-width: 1024px) and (min-height: 700px)",
  carousel:
    "(prefers-reduced-motion: no-preference) and (max-width: 767px) and (min-height: 855px), (prefers-reduced-motion: no-preference) and (min-width: 768px) and (min-height: 820px)",
  journey:
    "(prefers-reduced-motion: no-preference) and (max-width: 1023px) and (min-height: 885px), (prefers-reduced-motion: no-preference) and (min-width: 1024px) and (min-height: 640px)",
  conversation:
    "(prefers-reduced-motion: no-preference) and (min-width: 1024px) and (min-height: 700px)",
} as const;

export type PinnedSection = keyof typeof PIN_QUERIES;

/**
 * Whether `section` is currently pinned. Always `false` on the server and for the first client
 * render (the flow layout's state), then follows the media query. Only animation sources use
 * this; layout itself comes from CSS.
 */
export function usePinned(section: PinnedSection): boolean {
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(PIN_QUERIES[section]);
    const update = () => setPinned(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [section]);
  return pinned;
}
