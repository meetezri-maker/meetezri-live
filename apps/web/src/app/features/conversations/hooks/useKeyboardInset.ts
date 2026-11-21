import { useEffect, useState } from "react";

/**
 * Height (px) of the on-screen keyboard overlapping the layout viewport, measured from the
 * VisualViewport API rather than a fixed offset.
 *
 * - Android Chrome (default `resizes-visual`) and iOS Safari keep the layout viewport and shrink
 *   the visual viewport: the overlap is `innerHeight - (visualViewport.height + offsetTop)`.
 * - Browsers that resize the layout viewport report ~0 here, and the `h-dvh` shell already
 *   shrinks — so the two mechanisms never double-count.
 * Returns 0 without VisualViewport support.
 */
export function useKeyboardInset(enabled = true): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!enabled || !vv) {
      setInset(0);
      return;
    }
    const update = () => {
      const overlap = window.innerHeight - (vv.height + vv.offsetTop);
      setInset(overlap > 40 ? Math.round(overlap) : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [enabled]);
  return inset;
}
