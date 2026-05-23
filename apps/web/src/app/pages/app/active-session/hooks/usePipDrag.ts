import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

const PIP_LAYOUT_W = 248;
const PIP_LAYOUT_H = 192;

export interface UsePipDragOptions {
  sessionContainerRef: RefObject<HTMLDivElement | null>;
  leftSessionChromeRef: RefObject<HTMLDivElement | null>;
}

export function usePipDrag({
  sessionContainerRef,
  leftSessionChromeRef,
}: UsePipDragOptions) {
  const [pipPos, setPipPos] = useState({ left: 0, bottom: 0 });
  const pipDragRef = useRef<{
    id: number;
    sx: number;
    sy: number;
    sl: number;
    sb: number;
  } | null>(null);
  const pipDefaultPlacedRef = useRef(false);

  const pipClamp = useCallback((n: number, lo: number, hi: number) => {
    return Math.min(hi, Math.max(lo, n));
  }, []);

  const handlePipPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      pipDragRef.current = {
        id: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        sl: pipPos.left,
        sb: pipPos.bottom,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [pipPos.left, pipPos.bottom],
  );

  const handlePipPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = pipDragRef.current;
      if (!d || e.pointerId !== d.id) return;
      const boundsEl = sessionContainerRef.current;
      if (!boundsEl) return;
      const el = e.currentTarget;
      const bw = boundsEl.clientWidth;
      const bh = boundsEl.clientHeight;
      const pipW = el.offsetWidth;
      const pipH = el.offsetHeight;
      const margin = 4;
      const maxLeft = Math.max(margin, bw - pipW - margin);
      const maxBottom = Math.max(margin, bh - pipH - margin);
      const deltaX = e.clientX - d.sx;
      const deltaY = e.clientY - d.sy;
      setPipPos({
        left: pipClamp(d.sl + deltaX, margin, maxLeft),
        bottom: pipClamp(d.sb - deltaY, margin, maxBottom),
      });
    },
    [pipClamp, sessionContainerRef],
  );

  const handlePipPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = pipDragRef.current;
      if (!d || e.pointerId !== d.id) return;
      pipDragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const anchorPipBelowTranscriptOnce = useCallback(() => {
    if (pipDefaultPlacedRef.current) return;
    const root = sessionContainerRef.current;
    const card = leftSessionChromeRef.current;
    if (!root) return;

    const margin = 8;
    const gap = 12;
    const pipW = PIP_LAYOUT_W;
    const pipH = PIP_LAYOUT_H;
    const rootRect = root.getBoundingClientRect();

    if (card) {
      const cardRect = card.getBoundingClientRect();
      if (cardRect.width >= 24 && cardRect.height >= 24) {
        const leftDesired = cardRect.left - rootRect.left;
        const bottomDesired = rootRect.bottom - cardRect.bottom - gap - pipH;
        setPipPos({
          left: pipClamp(
            leftDesired,
            margin,
            Math.max(margin, root.clientWidth - pipW - margin),
          ),
          bottom: pipClamp(
            bottomDesired,
            margin,
            Math.max(margin, root.clientHeight - pipH - margin),
          ),
        });
        pipDefaultPlacedRef.current = true;
        return;
      }
    }

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767.98px)").matches
    ) {
      setPipPos({ left: margin, bottom: margin });
      pipDefaultPlacedRef.current = true;
    }
  }, [leftSessionChromeRef, pipClamp, sessionContainerRef]);

  useLayoutEffect(() => {
    const run = () => anchorPipBelowTranscriptOnce();

    run();
    let rafOuter = 0;
    let rafInner = 0;
    rafOuter = requestAnimationFrame(() => {
      rafInner = requestAnimationFrame(run);
    });

    const card = leftSessionChromeRef.current;
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(run);
      if (card) ro.observe(card);
    }

    window.addEventListener("resize", run);

    const safety = window.setTimeout(() => {
      if (!pipDefaultPlacedRef.current) {
        setPipPos({ left: 8, bottom: 8 });
        pipDefaultPlacedRef.current = true;
      }
    }, 2500);

    return () => {
      cancelAnimationFrame(rafOuter);
      cancelAnimationFrame(rafInner);
      ro?.disconnect();
      window.removeEventListener("resize", run);
      window.clearTimeout(safety);
    };
  }, [anchorPipBelowTranscriptOnce, leftSessionChromeRef]);

  return {
    pipPos,
    handlePipPointerDown,
    handlePipPointerMove,
    handlePipPointerUp,
  };
}
