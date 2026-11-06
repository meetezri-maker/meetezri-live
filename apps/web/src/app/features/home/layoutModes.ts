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
 *
 * Features at ≥1280px wide pins from 708px tall: the shortest viewport where the arc and all eight
 * bubbles fit with their full float clearance at the default line height. Taller headings (the
 * loose line-height setting, a late font) can still need more; the section then measures itself
 * and falls back to flow (`data-features-fit="none"`, see `placeFeatureBubbles`).
 */
export const PIN_QUERIES = {
  features:
    "(prefers-reduced-motion: no-preference) and (max-width: 639px) and (min-height: 1090px), (prefers-reduced-motion: no-preference) and (min-width: 640px) and (max-width: 1023px) and (min-height: 1045px), (prefers-reduced-motion: no-preference) and (min-width: 1024px) and (max-width: 1279px) and (min-height: 1090px), (prefers-reduced-motion: no-preference) and (min-width: 1280px) and (min-height: 708px)",
  howItWorks:
    "(prefers-reduced-motion: no-preference) and (max-width: 639px) and (min-height: 840px), (prefers-reduced-motion: no-preference) and (min-width: 640px) and (max-width: 1023px) and (min-height: 945px), (prefers-reduced-motion: no-preference) and (min-width: 1024px) and (min-height: 725px)",
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

/* ────────────────────────────────────────────────────────────────────────────────────────────
 * Features and How It Works only. Nothing below is used by the other pinned sections.
 * ──────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The app's own motion settings, which Features and How It Works honour alongside the OS
 * `prefers-reduced-motion` preference: Accessibility → Reduce motion (`reduced-motion`) and
 * Appearance → animations off (`appearance-no-animations`, which Billing already treats the same
 * way). `home.css` guards those two sections' pins with the same classes.
 */
export const APP_REDUCED_MOTION_CLASSES = ["reduced-motion", "appearance-no-animations"] as const;

function appReducedMotion(root: HTMLElement): boolean {
  return APP_REDUCED_MOTION_CLASSES.some((name) => root.classList.contains(name));
}

/**
 * Whether a section should hold still: the OS asks for reduced motion, or an in-app motion
 * setting is on. Follows both live (a media query listener and a class observer on
 * `<html>`, both removed on unmount), and is `false` for the server render and the first client
 * render so hydration matches.
 */
export function useMotionDisabled(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const query =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    const update = () => setReduce(Boolean(query?.matches) || appReducedMotion(root));
    update();
    query?.addEventListener("change", update);
    const observer = typeof MutationObserver === "function" ? new MutationObserver(update) : null;
    observer?.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      query?.removeEventListener("change", update);
      observer?.disconnect();
    };
  }, []);
  return reduce;
}

/** One highlight bubble's designer position inside its 440×490 cluster. */
export type FeatureSlot = {
  /** px from the cluster top. */
  top: number;
  /** px from the cluster's outer edge (left edge of the left cluster, right edge of the right). */
  pos: number;
  /** Which of the four bubble sizes / float rhythms this bubble uses. */
  index: number;
  /** Whether the highlight comes from the feature's "up" or "down" group. */
  isUp: boolean;
  /** Index into that group. */
  gi: number;
};

/**
 * The designer's bubble positions for each of the five feature steps, per cluster.
 * `pos` ~5–40 is the outer edge (far from the screen); ~150–220 is the inner area.
 */
export const FEATURE_SLOTS: { left: FeatureSlot[][]; right: FeatureSlot[][] } = {
  left: [
    // Step 0 — Journal: Z-spread (outer-top, inner-top, outer-bottom, inner-bottom)
    [
      { top: 10, pos: 8, index: 0, isUp: true, gi: 0 },
      { top: 60, pos: 200, index: 1, isUp: true, gi: 1 },
      { top: 270, pos: 190, index: 2, isUp: false, gi: 0 },
      { top: 340, pos: 12, index: 3, isUp: false, gi: 1 },
    ],
    // Step 1 — Talk: diagonal inner-top to outer-bottom
    [
      { top: 20, pos: 195, index: 0, isUp: true, gi: 0 },
      { top: 10, pos: 15, index: 1, isUp: true, gi: 1 },
      { top: 275, pos: 12, index: 2, isUp: false, gi: 0 },
      { top: 310, pos: 210, index: 3, isUp: false, gi: 1 },
    ],
    // Step 2 — Wellness: four-corner spread (no overlaps)
    [
      { top: 8, pos: 8, index: 0, isUp: true, gi: 0 },
      { top: 15, pos: 215, index: 1, isUp: true, gi: 1 },
      { top: 280, pos: 205, index: 2, isUp: false, gi: 0 },
      { top: 315, pos: 10, index: 3, isUp: false, gi: 1 },
    ],
    // Step 3 — Insights: outer-top, inner-mid, inner-mid, outer-bottom (X pattern)
    [
      { top: 8, pos: 12, index: 0, isUp: true, gi: 0 },
      { top: 90, pos: 200, index: 1, isUp: true, gi: 1 },
      { top: 265, pos: 195, index: 2, isUp: false, gi: 0 },
      { top: 340, pos: 8, index: 3, isUp: false, gi: 1 },
    ],
    // Step 4 — Rest: asymmetric scatter
    [
      { top: 30, pos: 180, index: 0, isUp: true, gi: 0 },
      { top: 15, pos: 15, index: 1, isUp: true, gi: 1 },
      { top: 280, pos: 20, index: 2, isUp: false, gi: 0 },
      { top: 315, pos: 195, index: 3, isUp: false, gi: 1 },
    ],
  ],
  right: [
    // Step 0 — Journal: mirrored Z (inner-top, outer-top, inner-bottom, outer-bottom)
    [
      { top: 10, pos: 195, index: 0, isUp: true, gi: 0 },
      { top: 60, pos: 10, index: 1, isUp: true, gi: 1 },
      { top: 270, pos: 15, index: 2, isUp: false, gi: 0 },
      { top: 340, pos: 200, index: 3, isUp: false, gi: 1 },
    ],
    // Step 1 — Talk: outer-top, inner-top, outer-bottom, inner-bottom
    [
      { top: 10, pos: 12, index: 0, isUp: true, gi: 0 },
      { top: 50, pos: 200, index: 1, isUp: true, gi: 1 },
      { top: 265, pos: 205, index: 2, isUp: false, gi: 0 },
      { top: 325, pos: 10, index: 3, isUp: false, gi: 1 },
    ],
    // Step 2 — Wellness: outer-heavy layout
    [
      { top: 15, pos: 10, index: 0, isUp: true, gi: 0 },
      { top: 80, pos: 200, index: 1, isUp: true, gi: 1 },
      { top: 270, pos: 190, index: 2, isUp: false, gi: 0 },
      { top: 330, pos: 12, index: 3, isUp: false, gi: 1 },
    ],
    // Step 3 — Insights: inner-top, outer-top, outer-bottom, inner-bottom
    [
      { top: 15, pos: 205, index: 0, isUp: true, gi: 0 },
      { top: 10, pos: 12, index: 1, isUp: true, gi: 1 },
      { top: 265, pos: 8, index: 2, isUp: false, gi: 0 },
      { top: 325, pos: 210, index: 3, isUp: false, gi: 1 },
    ],
    // Step 4 — Rest: spread all four corners
    [
      { top: 12, pos: 15, index: 0, isUp: true, gi: 0 },
      { top: 70, pos: 195, index: 1, isUp: true, gi: 1 },
      { top: 275, pos: 12, index: 2, isUp: false, gi: 0 },
      { top: 330, pos: 200, index: 3, isUp: false, gi: 1 },
    ],
  ],
};

/** Bubble sizes and motion, shared by the renderer and the placement maths. */
export const FEATURES_BUBBLE = {
  /** Designer diameters per bubble index. */
  sizes: [170, 144, 158, 136],
  /**
   * Smallest diameter. Every highlight's tag and text (12.5px text, 9px tag) stays at least 2px
   * inside a 134px circle, measured in the browser; 136px is the design's own smallest bubble.
   */
  minSize: 136,
  /** Float travel per bubble index (px, motion `y` keyframe), and its duration (s). */
  floatY: [-12, 9, -8, 11],
  floatDur: [4.2, 5.0, 4.6, 5.4],
  /**
   * Satellite pearls around an active bubble, as fractions of its diameter beyond its edge, plus
   * each satellite's own float travel (px). Top: satellite 1 (floats up 5). Bottom: satellite 2
   * (floats down 4). Outer side: satellite 3. Inner side: satellite 1.
   */
  satTop: 0.04,
  satTopFloat: 5,
  satBottom: 0.02,
  satBottomFloat: 4,
  satOuter: 0.03,
  satInner: 0.02,
  /** Minimum gap between two bubbles' circles at every point of their float (px). */
  gap: 12,
} as const;

/**
 * Desktop stage sizing for the arc-and-bubble layout (viewport ≥ 1280px wide). The arc and
 * cluster values must match `.home-features-arc` in `home.css` and the cluster width class in
 * `FeaturesSection.tsx`.
 */
export const FEATURES_STAGE = {
  minWidth: 1280,
  /** Arc controller height: clamp(96px, 12vh, 130px). */
  arcMin: 96,
  arcVh: 0.12,
  arcMax: 130,
  /** Arc top margin: clamp(28px, 4.5vh, 48px). */
  arcTopMin: 28,
  arcTopVh: 0.045,
  arcTopMax: 48,
  /** Arc bottom margin (mb-3) plus the stage row's top margin (mt-1). */
  arcBottom: 16,
  /** The pinned stage's bottom padding. */
  stageBottom: 16,
  rowMax: 500,
  clusterMaxHeight: 490,
  /** Cluster width: clamp(300px, 26vw, 440px). */
  clusterMinWidth: 300,
  clusterVw: 0.26,
  clusterMaxWidth: 440,
  /** Screen frame: max width, top margin (xl:mt-8), frame padding (p-2 on both sides). */
  screenMaxWidth: 610,
  screenTop: 32,
  screenFrame: 16,
  screenAspect: 1.6,
} as const;

const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

export type FeaturesStageMetrics = {
  rowHeight: number;
  clusterWidth: number;
  clusterHeight: number;
  screenMaxWidth: number;
};

/**
 * The space the arc-and-bubble row gets: what is left of the viewport below the floating
 * header, the section heading (measured, so fonts and the line-height setting count) and the
 * arc, capped at the design's 500px.
 */
export function featuresStageMetrics(input: {
  viewportWidth: number;
  viewportHeight: number;
  headerClearance: number;
  headingBlockHeight: number;
}): FeaturesStageMetrics {
  const S = FEATURES_STAGE;
  const vh = input.viewportHeight;
  const arc =
    clamp(S.arcMin, S.arcVh * vh, S.arcMax) + clamp(S.arcTopMin, S.arcTopVh * vh, S.arcTopMax);
  const available =
    vh - input.headerClearance - S.stageBottom - input.headingBlockHeight - arc - S.arcBottom;
  const rowHeight = Math.max(0, Math.min(S.rowMax, Math.floor(available)));
  return {
    rowHeight,
    clusterWidth: Math.floor(
      clamp(S.clusterMinWidth, S.clusterVw * input.viewportWidth, S.clusterMaxWidth),
    ),
    clusterHeight: Math.min(S.clusterMaxHeight, rowHeight),
    screenMaxWidth: Math.max(
      0,
      Math.min(
        S.screenMaxWidth,
        Math.floor((rowHeight - S.screenTop - S.screenFrame) * S.screenAspect + S.screenFrame),
      ),
    ),
  };
}

/** Where one bubble sits: px from the cluster top and from its outer edge, and its diameter. */
export type BubblePlacement = { top: number; offset: number; size: number; index: number };

export type FeaturesBubbleLayout = {
  width: number;
  height: number;
  /** True when the designer's own coordinates are used unchanged. */
  designer: boolean;
  /** [feature step][slot] for each cluster. */
  left: BubblePlacement[][];
  right: BubblePlacement[][];
};

/** How far a bubble and its satellites reach beyond its circle while floating. */
export function bubbleReach(size: number, index: number) {
  const B = FEATURES_BUBBLE;
  const float = B.floatY[index] ?? 0;
  const floatUp = Math.max(0, -float);
  const floatDown = Math.max(0, float);
  return {
    floatUp,
    floatDown,
    up: floatUp + Math.ceil(size * B.satTop + B.satTopFloat),
    down: floatDown + Math.ceil(size * B.satBottom + B.satBottomFloat),
    outer: Math.ceil(size * B.satOuter),
    inner: Math.ceil(size * B.satInner),
  };
}

/**
 * The smallest gap between two bubbles' circles over the whole float of both (they float on
 * independent rhythms, so every relative offset in range is reachable).
 */
export function movingGap(a: BubblePlacement, b: BubblePlacement): number {
  const ra = bubbleReach(a.size, a.index);
  const rb = bubbleReach(b.size, b.index);
  const dx = b.offset + b.size / 2 - (a.offset + a.size / 2);
  const dy0 = b.top + b.size / 2 - (a.top + a.size / 2);
  const lo = dy0 - rb.floatUp - ra.floatDown;
  const hi = dy0 + rb.floatDown + ra.floatUp;
  const dy = lo <= 0 && hi >= 0 ? 0 : Math.min(Math.abs(lo), Math.abs(hi));
  return Math.hypot(dx, dy) - a.size / 2 - b.size / 2;
}

/** Whether one cluster's bubbles keep their gap and stay inside it, floating and with satellites. */
export function clusterClears(bubbles: BubblePlacement[], width: number, height: number): boolean {
  for (const b of bubbles) {
    const r = bubbleReach(b.size, b.index);
    if (b.top - r.up < 0 || b.top + b.size + r.down > height) return false;
    if (b.offset - r.outer < 0 || b.offset + b.size + r.inner > width) return false;
  }
  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      if (movingGap(bubbles[i], bubbles[j]) < FEATURES_BUBBLE.gap) return false;
    }
  }
  return true;
}

/** Each step's slots as a 2×2 grid: one outer and one inner bubble in each of two rows. */
function gridOf(slots: FeatureSlot[]) {
  const top = slots.filter((s) => s.isUp);
  const bottom = slots.filter((s) => !s.isUp);
  const isOuter = (s: FeatureSlot) => s.pos < 100;
  const ok = (row: FeatureSlot[]) => row.length === 2 && row.filter(isOuter).length === 1;
  return ok(top) && ok(bottom) ? { top, bottom, isOuter } : null;
}

/**
 * Places one cluster's bubbles for every step in a `width`×`height` box.
 *
 * Each step keeps the designer's arrangement: the same bubble stays in the same corner (top or
 * bottom row, outer or inner column), its designer offset within that corner is scaled into the
 * spare room, and bubbles shrink toward the 136px floor only as far as the box needs. Rows are
 * separated by the gap plus both rows' float travel, and every bubble's float and satellites stay
 * inside the box. Returns `null` when the bubbles cannot fit at `scale`.
 */
function placeCluster(
  steps: FeatureSlot[][],
  width: number,
  height: number,
  scale: number,
): BubblePlacement[][] | null {
  const B = FEATURES_BUBBLE;
  const sizeOf = (s: FeatureSlot) =>
    Math.max(B.minSize, Math.round((B.sizes[s.index] ?? B.minSize) * scale));
  const reach = (s: FeatureSlot) => bubbleReach(sizeOf(s), s.index);
  const out: BubblePlacement[][] = [];
  for (const slots of steps) {
    const grid = gridOf(slots);
    if (!grid) return null;
    const topReach = Math.max(...grid.top.map((s) => reach(s).up));
    const bottomReach = Math.max(...grid.bottom.map((s) => reach(s).down));
    const rowGap =
      B.gap +
      Math.max(...grid.top.map((s) => reach(s).floatDown)) +
      Math.max(...grid.bottom.map((s) => reach(s).floatUp));
    const topRow = Math.max(...grid.top.map(sizeOf));
    const bottomRow = Math.max(...grid.bottom.map(sizeOf));
    const slackY = height - topReach - topRow - rowGap - bottomRow - bottomReach;
    if (slackY < 0) return null;
    const halfY = Math.floor(slackY / 2);

    const placed = slots.map((slot): BubblePlacement => {
      const size = sizeOf(slot);
      const designerSize = B.sizes[slot.index] ?? B.minSize;
      const row = slot.isUp ? grid.top : grid.bottom;
      const outer = row.find(grid.isOuter)!;
      const inner = row.find((s) => !grid.isOuter(s))!;
      const slackX =
        width - reach(outer).outer - sizeOf(outer) - B.gap - sizeOf(inner) - reach(inner).inner;
      const halfX = Math.max(0, Math.floor(slackX / 2));
      // The designer's offset within its corner, as 0..1.
      const jy = slot.isUp
        ? clamp(0, slot.top / 90, 1)
        : clamp(0, (476 - slot.top - designerSize) / 60, 1);
      const jx = grid.isOuter(slot)
        ? clamp(0, slot.pos / 20, 1)
        : clamp(0, (440 - slot.pos - designerSize) / 100, 1);
      return {
        size,
        index: slot.index,
        top: slot.isUp
          ? topReach + Math.round(jy * halfY)
          : height - bottomReach - size - Math.round(jy * halfY),
        offset: grid.isOuter(slot)
          ? reach(slot).outer + Math.round(jx * halfX)
          : width - reach(slot).inner - size - Math.round(jx * halfX),
      };
    });
    if (!clusterClears(placed, width, height)) return null;
    out.push(placed);
  }
  return out;
}

function designerCluster(steps: FeatureSlot[][]): BubblePlacement[][] {
  return steps.map((slots) =>
    slots.map((s) => ({
      top: s.top,
      offset: s.pos,
      size: FEATURES_BUBBLE.sizes[s.index] ?? FEATURES_BUBBLE.minSize,
      index: s.index,
    })),
  );
}

/**
 * Bubble placements for both clusters in a `width`×`height` cluster box, or `null` when the
 * bubbles cannot fit with their full float clearance (the section then uses the stacked flow
 * layout). Where the box is the design's full 440×490 and the designer's coordinates clear,
 * those are used unchanged.
 */
export function placeFeatureBubbles(
  slots: { left: FeatureSlot[][]; right: FeatureSlot[][] },
  width: number,
  height: number,
): FeaturesBubbleLayout | null {
  if (width >= FEATURES_STAGE.clusterMaxWidth && height >= FEATURES_STAGE.clusterMaxHeight) {
    const left = designerCluster(slots.left);
    const right = designerCluster(slots.right);
    if ([...left, ...right].every((step) => clusterClears(step, width, height))) {
      return { width, height, designer: true, left, right };
    }
  }
  const B = FEATURES_BUBBLE;
  const minScale = B.minSize / Math.max(...B.sizes);
  for (let step = 0; 1 - step * 0.01 >= minScale - 1e-9; step++) {
    const scale = 1 - step * 0.01;
    const left = placeCluster(slots.left, width, height, scale);
    const right = left && placeCluster(slots.right, width, height, scale);
    if (left && right) return { width, height, designer: false, left, right };
  }
  return null;
}

/**
 * How It Works ("Meet Solace") desktop stage, viewport ≥ 1024px wide. The stage gap and the card
 * offset must match the `home.css` rules for the pinned section.
 */
export const HIW_STAGE = {
  minWidth: 1024,
  /** Space kept above the header margins' compact values: h2 mt, subtitle mt, accent bar mt. */
  headingMargins: 8 + 8 + 12,
  /** Gap between the header and the stage: clamp(16px, 3vh, 48px). */
  gapMin: 16,
  gapVh: 0.03,
  gapMax: 48,
  /** The pinned stage's bottom padding. */
  stageBottom: 16,
  /** Stepper to cards (mt-2), and the card's offset inside its box. */
  stepperGap: 8,
  cardTop: 24,
  /** Card around the image: 2+2 border, 3 accent bar, 24 top and 32 bottom padding. */
  cardChrome: 63,
  /** Image height range, and the design's 460×320 proportions. */
  imageMin: 200,
  imageMax: 320,
  imageAspect: 460 / 320,
} as const;

export type HowItWorksStageMetrics = {
  fits: boolean;
  imageHeight: number;
  imageWidth: number;
  cardsHeight: number;
};

/**
 * Whether the pinned stage fits, and how large its image can be, from what the page measured:
 * the header's own height (without margins), the stepper, and the left text column at its
 * tallest step. None of those change between the pinned and stacked layouts, so the answer
 * cannot flip because the layout switched.
 */
export function howItWorksStageMetrics(input: {
  viewportHeight: number;
  headerClearance: number;
  headerHeight: number;
  stepperHeight: number;
  textColumnHeight: number;
}): HowItWorksStageMetrics {
  const S = HIW_STAGE;
  const vh = input.viewportHeight;
  const gap = clamp(S.gapMin, S.gapVh * vh, S.gapMax);
  const available =
    vh - input.headerClearance - S.stageBottom - input.headerHeight - S.headingMargins - gap;
  const imageRoom = Math.floor(
    available - input.stepperHeight - S.stepperGap - S.cardTop - S.cardChrome,
  );
  const imageHeight = Math.min(S.imageMax, imageRoom);
  return {
    fits: imageHeight >= S.imageMin && input.textColumnHeight <= available,
    imageHeight: Math.max(0, imageHeight),
    imageWidth: Math.round(Math.max(0, imageHeight) * S.imageAspect),
    cardsHeight: S.cardTop + S.cardChrome + Math.max(0, imageHeight),
  };
}
