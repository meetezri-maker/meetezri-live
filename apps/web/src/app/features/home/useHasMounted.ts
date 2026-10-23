import { useEffect, useState } from "react";

/**
 * `false` on the server and during hydration, `true` afterwards.
 *
 * Used to keep purely decorative, path-heavy SVGs (the hand-drawn CTA arrows, ~16 KB of path
 * data each) out of the prerendered HTML. They are aria-hidden and animate in on their own, so
 * appearing after hydration changes nothing for visitors or crawlers.
 */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
