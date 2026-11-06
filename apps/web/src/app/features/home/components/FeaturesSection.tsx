import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { motion } from "motion/react";
import {
  FEATURE_SLOTS,
  FEATURES_BUBBLE,
  FEATURES_STAGE,
  PIN_QUERIES,
  featuresStageMetrics,
  placeFeatureBubbles,
  useMotionDisabled,
  usePinned,
  type FeaturesBubbleLayout,
  type FeaturesStageMetrics,
} from "../layoutModes";
import imgHome from "../assets/app-dashboard.webp";
import imgTalkItOut from "../assets/app-talk-it-out.webp";
import imgWellness from "../assets/app-wellness.webp";
import imgNature from "../assets/app-insights.webp";
import imgRest from "../assets/app-rest.webp";
import SolaceEmblem from "./SolaceEmblem";

const GRAD = "linear-gradient(135deg, #e91e63 8%, #9c27b0 92%)";
const EASE = [0.22, 1, 0.36, 1] as const;

type TabItem = {
  text: string;
  tag: string;
};

type Feature = {
  key: string;
  num: string;
  label: string;
  shortLabel: string;
  screen: string;
  leftUp: TabItem[];
  leftDown: TabItem[];
  rightUp: TabItem[];
  rightDown: TabItem[];
};

const FEATURES: Feature[] = [
  {
    key: "journal",
    num: "01",
    label: "Journal & Mood",
    shortLabel: "Journal",
    screen: imgHome,
    leftUp: [
      { text: "Write freely in a private journal", tag: "Journal" },
      { text: "Track daily moods over time", tag: "Mood Log" },
    ],
    leftDown: [
      { text: "Spot emotional patterns over time", tag: "Insights" },
      { text: "Personal and protected, by design", tag: "Private" },
    ],
    rightUp: [
      { text: "Reflect on your day without judgment", tag: "Reflect" },
      { text: "Weekly highlights & streaks", tag: "Progress" },
    ],
    rightDown: [
      { text: "Export entries as PDF or JSON", tag: "Export" },
      { text: "Celebrate your milestones", tag: "Growth" },
    ],
  },
  {
    key: "talk",
    num: "02",
    label: "Talk It Out",
    shortLabel: "Talk",
    screen: imgTalkItOut,
    leftUp: [
      { text: "Talk freely, whenever you need it", tag: "Anytime" },
      { text: "Zero judgment, full presence", tag: "Safe Space" },
    ],
    leftDown: [
      { text: "Celebrate your wins, no matter how small", tag: "Celebrate" },
      { text: "Talk about anything on your mind", tag: "Open" },
    ],
    rightUp: [
      { text: "Choose the companion you talk to", tag: "Your Choice" },
      { text: "Deep, thoughtful responses", tag: "Mindful" },
    ],
    rightDown: [
      { text: "Goes at your pace, always", tag: "Your Speed" },
      { text: "Warm reassurance when you need it", tag: "Support" },
    ],
  },
  {
    key: "wellness",
    num: "03",
    label: "Wellness Tools",
    shortLabel: "Wellness",
    screen: imgWellness,
    leftUp: [
      { text: "Box breathing & 4-7-8 technique", tag: "Breathe" },
      { text: "Quick daily mood check-ins", tag: "Quick Reset" },
    ],
    leftDown: [
      { text: "5-4-3-2-1 grounding drill", tag: "Grounding" },
      { text: "Micro-break mindful pauses", tag: "Pause" },
    ],
    rightUp: [
      { text: "Gentle movement with guided audio", tag: "Movement" },
      { text: "Build tiny daily habits", tag: "Streak" },
    ],
    rightDown: [
      { text: "Full body tension release scan", tag: "Body Scan" },
      { text: "Quick energy reset anytime", tag: "Recharge" },
    ],
  },
  {
    key: "insights",
    num: "04",
    label: "Insights & Growth",
    shortLabel: "Insights",
    screen: imgNature,
    leftUp: [
      { text: "AI finds patterns in your emotions", tag: "Discovery" },
      { text: "Progress and session history", tag: "History" },
    ],
    leftDown: [
      { text: "Mood history and trends", tag: "Trends" },
      { text: "Watch your growth month by month", tag: "Progress" },
    ],
    rightUp: [
      { text: "Achievements mark your milestones", tag: "Achievements" },
      { text: "Habit tracking for small daily wins", tag: "Habits" },
    ],
    rightDown: [
      { text: "Set goals, track tiny steps daily", tag: "Goals" },
      { text: "Long-term mindset shifts", tag: "Lasting" },
    ],
  },
  {
    key: "rest",
    num: "05",
    label: "Rest & Habits",
    shortLabel: "Rest",
    screen: imgRest,
    leftUp: [
      { text: "Late-night companion for winding down", tag: "Bedtime" },
      { text: "Gentle reflections before sleep", tag: "Wind Down" },
    ],
    leftDown: [
      { text: "Track your sleep over time", tag: "Sleep Log" },
      { text: "Quiet the mental noise", tag: "Calm Mind" },
    ],
    rightUp: [
      { text: "Start your day with a mood check-in", tag: "Good Morning" },
      { text: "Gratitude shifts your perspective", tag: "Grateful" },
    ],
    rightDown: [
      { text: "Evening journal to release thoughts", tag: "Let Go" },
      { text: "Build a restful nightly routine", tag: "Ritual" },
    ],
  },
];

// Coordinates of the 5 points along the 180° semi-circular / D-shaped dome arc:
// Angles: 180°, 135°, 90°, 45°, 0°
const ARC_POINTS = [
  { xPercent: 8, yPercent: 78, angle: 180, rotAngle: 180 },
  { xPercent: 24, yPercent: 32, angle: 135, rotAngle: 225 },
  { xPercent: 50, yPercent: 16, angle: 90, rotAngle: 270 },
  { xPercent: 76, yPercent: 32, angle: 45, rotAngle: 315 },
  { xPercent: 92, yPercent: 78, angle: 0, rotAngle: 360 },
];

/* ── Bubble gradient — light pastel gradient matching the website's signature #e91e63 to #9c27b0 palette ── */
const BUBBLE_GRAD =
  "linear-gradient(135deg, #ffffff 0%, #fde7f1 38%, #f5e8fa 75%, #ece3f9 100%)";

/*
 * Bubble sizes, float rhythm and the designer's slot coordinates live in `layoutModes.ts`
 * (FEATURES_BUBBLE, FEATURE_SLOTS) so the renderer and the placement maths share one copy.
 */

/** Client-only layout effect (React 18 warns about `useLayoutEffect` during server rendering). */
const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type FeaturesGeometry = FeaturesStageMetrics & {
  /** Bubble placements, or `null` when they cannot fit (the section then uses the flow layout). */
  layout: FeaturesBubbleLayout | null;
};

/**
 * Sizes the ≥1280px arc-and-bubble stage to the viewport. Measures the section heading (so web
 * fonts and the line-height setting count) and places the bubbles in the room left. `null` while
 * the Features pin query does not match at ≥1280px (server, first render, narrower viewports and
 * the other layouts keep their markup unchanged).
 *
 * The heading is laid out the same in both layouts, so switching to flow when the bubbles do not
 * fit cannot change the measurement that caused it.
 */
function useFeaturesGeometry(
  sectionRef: RefObject<HTMLElement | null>,
  headingStartRef: RefObject<HTMLElement | null>,
  headingEndRef: RefObject<HTMLElement | null>,
): FeaturesGeometry | null {
  const [geometry, setGeometry] = useState<FeaturesGeometry | null>(null);
  useClientLayoutEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(PIN_QUERIES.features);
    let lastKey = "null";
    const measure = () => {
      const section = sectionRef.current;
      const start = headingStartRef.current;
      const end = headingEndRef.current;
      let next: FeaturesGeometry | null = null;
      if (section && start && end && query.matches && window.innerWidth >= FEATURES_STAGE.minWidth) {
        const clearance = parseFloat(
          getComputedStyle(section).getPropertyValue("--home-header-clearance"),
        );
        const metrics = featuresStageMetrics({
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          headerClearance: Number.isFinite(clearance) ? clearance : 96,
          headingBlockHeight: end.getBoundingClientRect().bottom - start.getBoundingClientRect().top,
        });
        next = {
          ...metrics,
          layout: placeFeatureBubbles(FEATURE_SLOTS, metrics.clusterWidth, metrics.clusterHeight),
        };
      }
      const key = next
        ? `${next.rowHeight}|${next.clusterWidth}|${next.clusterHeight}|${next.screenMaxWidth}|${Boolean(next.layout)}`
        : "null";
      if (key === lastKey) return;
      lastKey = key;
      setGeometry(next);
    };
    measure();
    query.addEventListener("change", measure);
    window.addEventListener("resize", measure);
    // Every part of the heading block: the app's calm-transitions setting animates line-height,
    // so the final size can arrive a few frames after the setting changes.
    const heading = headingStartRef.current?.parentElement?.querySelector("h2");
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    for (const el of [headingStartRef.current, heading, headingEndRef.current]) {
      if (el) observer?.observe(el);
    }
    // The app applies its text settings (line height, letter spacing, font) as classes and
    // custom properties on <html>; re-measure as soon as they change rather than a frame later.
    const settings = typeof MutationObserver === "function" ? new MutationObserver(measure) : null;
    settings?.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    let alive = true;
    fonts?.ready.then(() => alive && measure());
    fonts?.addEventListener?.("loadingdone", measure);
    return () => {
      alive = false;
      query.removeEventListener("change", measure);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
      settings?.disconnect();
      fonts?.removeEventListener?.("loadingdone", measure);
    };
  }, [sectionRef, headingStartRef, headingEndRef]);
  return geometry;
}

const BubbleCard = memo(function BubbleCard({
  item,
  side,
  index,
  size,
  reduce,
  isActive = false,
}: {
  item: TabItem;
  side: "left" | "right";
  index: number;
  size: number;
  reduce: boolean;
  isActive?: boolean;
}) {
  const shouldAnimate = isActive && !reduce;
  const floatY = FEATURES_BUBBLE.floatY[index] ?? -8;
  const floatDur = FEATURES_BUBBLE.floatDur[index] ?? 4.8;

  return (
    <motion.div
      className="relative select-none"
      /* GPU layer only when actively animating — avoids 160 concurrent composite layers */
      style={isActive ? { willChange: "transform" } : undefined}
      animate={shouldAnimate ? { y: [0, floatY, 0] } : { y: 0 }}
      transition={
        shouldAnimate
          ? {
              duration: floatDur,
              repeat: Infinity,
              ease: "easeInOut",
              repeatType: "mirror",
            }
          : { duration: reduce ? 0 : 0.3, ease: "easeOut" }
      }
      whileHover={
        isActive && !reduce
          ? {
              scale: 1.07,
              transition: { type: "spring", stiffness: 260, damping: 18 },
            }
          : undefined
      }
    >
      {/* ── Main Gradient Sphere — glow via box-shadow only; no separate blur-2xl composite layer ── */}
      <div
        className="relative flex flex-col items-center justify-center text-center p-2"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: BUBBLE_GRAD,
          boxShadow:
            "0 14px 36px rgba(233,30,99,0.14), 0 6px 16px rgba(156,39,176,0.10), inset 0 2px 5px rgba(255,255,255,0.95), inset 0 -4px 10px rgba(233,30,99,0.06)",
          border: "1.5px solid rgba(233,30,99,0.22)",
        }}
      >
        {/* Gloss sheen — top-left ellipse */}
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            width: "55%",
            height: "42%",
            top: "7%",
            left: "10%",
            background:
              "radial-gradient(ellipse at 38% 28%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 68%)",
          }}
        />

        {/* Tag pill — solid background, no backdrop-filter composite layer */}
        <span
          className="relative z-10 mb-1.5 inline-block rounded-full px-2.5 py-[3px] text-[9px] font-bold uppercase tracking-widest text-[#e91e63]"
          style={{
            fontFamily: "'Inter', sans-serif",
            background: "rgba(255,255,255,0.94)",
            border: "1px solid rgba(233,30,99,0.2)",
            boxShadow: "0 1px 4px rgba(233,30,99,0.08)",
          }}
        >
          {item.tag}
        </span>

        {/* Feature text */}
        <span
          className="relative z-10 px-3 text-[12.5px] font-semibold leading-[1.35] text-slate-800"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          {item.text}
        </span>
      </div>

      {/* ── Satellite bubbles — only rendered when card is the active one ── */}
      {isActive && (
        <>
          {/* Sat 1: top corner, larger */}
          <motion.div
            className="pointer-events-none absolute rounded-full"
            style={{
              width: Math.round(size * 0.2),
              height: Math.round(size * 0.2),
              top: -Math.round(size * 0.04),
              [side === "left" ? "right" : "left"]: -Math.round(size * 0.02),
              background: BUBBLE_GRAD,
              border: "1px solid rgba(233,30,99,0.2)",
              boxShadow:
                "0 4px 12px rgba(233,30,99,0.12), inset 0 1px 2px rgba(255,255,255,0.9)",
            }}
            animate={shouldAnimate ? { y: [0, -5, 0] } : { y: 0 }}
            transition={
              shouldAnimate
                ? {
                    duration: floatDur * 0.78,
                    repeat: Infinity,
                    ease: "easeInOut",
                    repeatType: "mirror",
                  }
                : { duration: 0 }
            }
          >
            <div
              className="absolute rounded-full"
              style={{
                width: "52%",
                height: "38%",
                top: "10%",
                left: "14%",
                background:
                  "radial-gradient(ellipse at center, rgba(255,255,255,0.8) 0%, transparent 70%)",
              }}
            />
          </motion.div>

          {/* Sat 2: bottom dot */}
          <motion.div
            className="pointer-events-none absolute rounded-full"
            style={{
              width: Math.round(size * 0.13),
              height: Math.round(size * 0.13),
              bottom: -Math.round(size * 0.02),
              [side === "left" ? "left" : "right"]: Math.round(size * 0.1),
              background: BUBBLE_GRAD,
              border: "1px solid rgba(156,39,176,0.18)",
              boxShadow:
                "0 2px 8px rgba(156,39,176,0.10), inset 0 1px 2px rgba(255,255,255,0.9)",
              opacity: 0.9,
            }}
            animate={shouldAnimate ? { y: [0, 4, 0] } : { y: 0 }}
            transition={
              shouldAnimate
                ? {
                    duration: floatDur * 0.92,
                    repeat: Infinity,
                    ease: "easeInOut",
                    repeatType: "mirror",
                  }
                : { duration: 0 }
            }
          />

          {/* Sat 3: side pearl */}
          <motion.div
            className="pointer-events-none absolute rounded-full"
            style={{
              width: Math.round(size * 0.09),
              height: Math.round(size * 0.09),
              top: "44%",
              [side === "left" ? "left" : "right"]: -Math.round(size * 0.03),
              background: BUBBLE_GRAD,
              border: "1px solid rgba(233,30,99,0.18)",
              boxShadow: "0 2px 6px rgba(233,30,99,0.08)",
              opacity: 0.8,
            }}
            animate={shouldAnimate ? { y: [0, -3, 0] } : { y: 0 }}
            transition={
              shouldAnimate
                ? {
                    duration: floatDur * 1.1,
                    repeat: Infinity,
                    ease: "easeInOut",
                    repeatType: "mirror",
                  }
                : { duration: 0 }
            }
          />
        </>
      )}
    </motion.div>
  );
});

export default function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingStartRef = useRef<HTMLSpanElement>(null);
  const headingEndRef = useRef<HTMLDivElement>(null);
  const reduce = useMotionDisabled();
  const geometry = useFeaturesGeometry(sectionRef, headingStartRef, headingEndRef);
  const bubbleLayout = geometry?.layout ?? null;
  /* The same three conditions gate the pin in home.css: the pin query, no in-app reduced
     motion, and (≥1280px) the bubbles fitting. */
  const doesNotFit = geometry !== null && bubbleLayout === null;
  const pinned = usePinned("features") && !reduce && !doesNotFit;

  const [activeIdx, setActiveIdx] = useState(0);

  const TOTAL_STEPS = 5; // 5 models: 0-4

  /* ── Compute the exact scroll Y for a given step (pinned layout only) ── */
  const getTargetScrollY = useCallback((step: number) => {
    const el = sectionRef.current;
    if (!el) return window.scrollY;
    const rect = el.getBoundingClientRect();
    const sectionTop = window.scrollY + rect.top;
    const totalScrollable = el.offsetHeight - window.innerHeight;
    return sectionTop + (step / (TOTAL_STEPS - 1)) * totalScrollable;
  }, []);

  /*
   * Arc buttons (pinned layout only; the flow layout lists every feature instead). A step is a
   * scroll position, so the button scrolls the page there and the scroll sync below activates
   * it. Until the media query has been read after mount, it switches the feature directly.
   */
  const handleSelectStep = useCallback(
    (idx: number) => {
      const step = Math.max(0, Math.min(TOTAL_STEPS - 1, idx));
      if (!pinned) {
        setActiveIdx(step);
        return;
      }
      window.scrollTo({ top: getTargetScrollY(step), behavior: reduce ? "auto" : "smooth" });
    },
    [getTargetScrollY, pinned, reduce],
  );

  /*
   * Pinned: the active step follows the page's own scroll position. No wheel, touch or key input
   * is intercepted, so native scrolling, Space/PageDown/arrow keys and focus all behave normally.
   */
  useEffect(() => {
    if (!pinned) return;
    const syncToScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const totalScrollable = el.offsetHeight - window.innerHeight;
      if (totalScrollable <= 0) return;
      const progress = Math.min(1, Math.max(0, -el.getBoundingClientRect().top / totalScrollable));
      setActiveIdx(Math.round(progress * (TOTAL_STEPS - 1)));
    };
    syncToScroll();
    window.addEventListener("scroll", syncToScroll, { passive: true });
    window.addEventListener("resize", syncToScroll);
    return () => {
      window.removeEventListener("scroll", syncToScroll);
      window.removeEventListener("resize", syncToScroll);
    };
  }, [pinned]);

  return (
    <section
      ref={sectionRef}
      id="features"
      className="home-pin home-pin--features relative bg-white"
      data-features-fit={doesNotFit ? "none" : undefined}
    >
      <div className="home-pin-stage flex flex-col items-center justify-center px-6">
        {/* Background Solace Emblem */}
        <div className="pointer-events-none absolute left-[3%] top-[10%] z-0 hidden opacity-60 xl:block">
          <SolaceEmblem size={130} tilt={-14} />
        </div>

        {/* Section Header */}
        <span
          ref={headingStartRef}
          className="rounded-[12px] border border-[#e91e63] px-4 py-[5px] text-[11px] font-semibold uppercase"
          style={{
            fontFamily: "'Montserrat', sans-serif",
            backgroundImage:
              "linear-gradient(131deg, rgba(233,30,99,0.12), rgba(156,39,176,0.12))",
          }}
        >
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: GRAD }}
          >
            Features
          </span>
        </span>
        <h2
          className="mt-2 text-center text-[clamp(26px,3.2vw,42px)] leading-[1.05] tracking-[-1px] text-black"
          style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}
        >
          Highlighted{" "}
          <br className="home-features-heading-break" />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: GRAD }}
          >
            Features
          </span>
        </h2>
        <div
          ref={headingEndRef}
          className="mt-1.5 h-[4px] w-[52px] rounded-full"
          style={{ background: GRAD }}
        />

        {/* Pinned layout: one feature at a time, stepped by the page scroll. */}
        <div className="home-pinned-only flex w-full flex-col items-center">
        {/* ───── D-Shaped 180-Degree Arc Controller with 5 Milestone Points ───── */}
        <div className="home-features-arc relative mt-8 xl:mt-12 mb-3 h-[170px] w-[min(620px,94vw)] sm:h-[130px]">
          {/* Central Glowing Sphere & Pointer Ring */}
          <div className="absolute left-1/2 bottom-[-20px] -translate-x-1/2">
            {/* Halo */}
            <motion.div
              className="absolute left-1/2 top-1/2 h-[80px] w-[80px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(233,30,99,0.35), rgba(156,39,176,0) 70%)",
              }}
              /* A still target (not `undefined`) so switching reduced motion on stops the loop at once. */
              animate={
                reduce
                  ? { scale: 1, opacity: 0.6 }
                  : { scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }
              }
              transition={
                reduce
                  ? { duration: 0 }
                  : { duration: 3.5, repeat: Infinity, ease: "easeInOut" }
              }
            />

            {/* Rotating Pointer Arrow Indicator */}
            <motion.div
              className="absolute left-1/2 top-1/2 h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2"
              animate={{ rotate: reduce ? 0 : ARC_POINTS[activeIdx].rotAngle }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 65, damping: 14 }
              }
            >
              <svg aria-hidden
                className="absolute right-0 top-1/2 h-[34px] w-[17px] -translate-y-1/2"
                viewBox="0 0 22 45"
                fill="none"
              >
                <path
                  d="M3 5 Q18 22.5 3 40"
                  stroke="url(#arcStrokeGrad2)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d="M18 22.5 L9 16 M18 22.5 L9 29"
                  stroke="url(#arcStrokeGrad2)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient
                    id="arcStrokeGrad2"
                    x1="0"
                    y1="0"
                    x2="22"
                    y2="45"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#e91e63" />
                    <stop offset="1" stopColor="#9c27b0" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>

            {/* Glass Orb Core */}
            <motion.div
              className="relative flex h-[60px] w-[60px] items-center justify-center rounded-full shadow-[0_10px_30px_rgba(233,30,99,0.25)]"
              style={{
                background:
                  "radial-gradient(circle at 36% 28%, #ffffff 0%, #fce4ec 30%, #f48fb1 60%, #ad1457 100%)",
                boxShadow:
                  "inset -6px -8px 14px rgba(74,20,140,0.35), inset 5px 6px 12px rgba(255,255,255,0.85), 0 10px 24px rgba(233,30,99,0.28)",
              }}
              animate={reduce ? { y: 0 } : { y: [0, -3, 0] }}
              transition={
                reduce ? { duration: 0 } : { duration: 4, repeat: Infinity, ease: "easeInOut" }
              }
            >
              <span className="text-[13px] font-extrabold text-slate-900 tracking-wider">
                {FEATURES[activeIdx].num}
              </span>
            </motion.div>
          </div>

          {/* 5 Milestone Points along the 180° Arc (Top points have label ABOVE to prevent overlap) */}
          {FEATURES.map((feat, i) => {
            const pt = ARC_POINTS[i];
            const isActive = activeIdx === i;
            const isTopArc = i >= 1 && i <= 3; // Points 02, 03, 04

            return (
              <button
                key={feat.key}
                type="button"
                onClick={() => handleSelectStep(i)}
                aria-label={feat.label}
                aria-pressed={isActive}
                className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 focus:outline-none"
                style={{
                  left: `${pt.xPercent}%`,
                  top: `${pt.yPercent}%`,
                }}
              >
                <div
                  className={`flex items-center transition-transform duration-300 ${
                    isTopArc ? "flex-col-reverse" : "flex-col"
                  } ${
                    isActive
                      ? "scale-110"
                      : "scale-95 opacity-70 group-hover:opacity-100 group-hover:scale-105"
                  }`}
                >
                  {/* Pin Orb */}
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${
                      isActive
                        ? "border-[#e91e63] bg-white shadow-[0_0_16px_rgba(233,30,99,0.5)]"
                        : "border-slate-300 bg-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                    }`}
                  >
                    <span
                      className={`text-[11px] font-bold ${
                        isActive
                          ? "bg-clip-text text-transparent"
                          : "text-[#666]"
                      }`}
                      style={isActive ? { backgroundImage: GRAD } : undefined}
                    >
                      {feat.num}
                    </span>
                  </div>

                  {/* Label */}
                  <span
                    className={`whitespace-nowrap text-[12px] font-semibold transition-all ${
                      isTopArc ? "mb-1" : "mt-1"
                    } ${
                      isActive
                        ? "bg-clip-text text-transparent"
                        : "text-[#777] group-hover:text-black"
                    }`}
                    style={
                      isActive
                        ? {
                            fontFamily: "'Montserrat', sans-serif",
                            backgroundImage: GRAD,
                          }
                        : { fontFamily: "'Montserrat', sans-serif" }
                    }
                  >
                    {feat.shortLabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* ───── Stage: Freely-scattered Bubble Clusters & Central Screen ───── */}
        <div
          className="relative mt-1 flex w-full max-w-[1520px] flex-col xl:flex-row xl:h-[500px] items-center justify-between px-2 sm:px-4"
          style={bubbleLayout ? { height: geometry!.rowHeight } : undefined}
        >
          <BubbleCluster
            side="left"
            activeIdx={activeIdx}
            layout={bubbleLayout}
            height={bubbleLayout ? geometry!.clusterHeight : undefined}
            reduce={reduce}
          />

          {/* Central Screen Frame */}
          <div
            className="relative z-10 mx-auto w-full max-w-[560px] lg:max-w-[610px] mt-4 xl:mt-8 rounded-[22px] bg-[#0b0b14] p-2 shadow-[0px_32px_80px_rgba(20,10,40,0.32)] shrink"
            style={bubbleLayout ? { maxWidth: geometry!.screenMaxWidth } : undefined}
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[16px]">
              {FEATURES.map((feat, i) => {
                const isActive = activeIdx === i;
                return (
                  <motion.img
                    key={feat.key}
                    src={feat.screen}
                    alt={isActive ? `Solace ${feat.label} screen` : ""}
                    aria-hidden={!isActive}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover object-top"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{
                      opacity: isActive ? 1 : 0,
                      scale: isActive ? 1 : 0.97,
                      zIndex: isActive ? 2 : 1,
                    }}
                    transition={{ duration: reduce ? 0 : 0.55, ease: EASE }}
                  />
                );
              })}
            </div>
          </div>

          {/* Below xl the bubble clusters do not fit beside the screen, so all of the active
              feature's highlights render as a compact list underneath it instead. */}
          <HighlightPills feature={FEATURES[activeIdx]} className="mt-5 max-w-[560px] xl:hidden" />

          <BubbleCluster
            side="right"
            activeIdx={activeIdx}
            layout={bubbleLayout}
            height={bubbleLayout ? geometry!.clusterHeight : undefined}
            reduce={reduce}
          />
        </div>
        </div>

        {/* Flow layout (short screens, reduced motion): all five features in order, each with
            its screen and every highlight. */}
        <ol className="home-flow-only mt-10 flex w-full max-w-[1100px] flex-col gap-14">
          {FEATURES.map((feat) => (
            <li
              key={feat.key}
              className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12"
            >
              <div className="rounded-[22px] bg-[#0b0b14] p-2 shadow-[0px_32px_80px_rgba(20,10,40,0.32)]">
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[16px]">
                  <img
                    src={feat.screen}
                    alt={`Solace ${feat.label} screen`}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover object-top"
                  />
                </div>
              </div>
              <div className="flex flex-col items-center lg:items-start">
                <h3
                  className="flex items-center gap-3 text-[22px] font-semibold text-black"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e91e63] bg-white text-[12px] font-bold"
                    aria-hidden
                  >
                    <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>
                      {feat.num}
                    </span>
                  </span>
                  {feat.label}
                </h3>
                <HighlightPills feature={feat} className="mt-4 lg:justify-start" />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * One side's floating highlight bubbles (≥1280px, pinned). Renders the designer positions until
 * the section has measured itself, then the placements sized to the viewport.
 */
function BubbleCluster({
  side,
  activeIdx,
  layout,
  height,
  reduce,
}: {
  side: "left" | "right";
  activeIdx: number;
  layout: FeaturesBubbleLayout | null;
  height: number | undefined;
  reduce: boolean;
}) {
  return (
    <div
      className="relative z-20 hidden xl:block w-[clamp(300px,26vw,440px)] h-[490px] shrink-0"
      style={height !== undefined ? { height } : undefined}
    >
      {FEATURES.map((feat, fIdx) => {
        const isActive = activeIdx === fIdx;
        const slots = FEATURE_SLOTS[side][fIdx] ?? FEATURE_SLOTS[side][0];
        const placed = layout?.[side][fIdx];
        return (
          <div key={`${feat.key}-${side}-col`} className="absolute inset-0 pointer-events-none">
            {slots.map(({ top, pos, index, isUp, gi }, si) => {
              const group =
                side === "left"
                  ? isUp ? feat.leftUp : feat.leftDown
                  : isUp ? feat.rightUp : feat.rightDown;
              const at = placed?.[si];
              return (
                <motion.div
                  key={`${feat.key}-${side === "left" ? "l" : "r"}-${si}`}
                  className="absolute"
                  aria-hidden={!isActive}
                  style={{
                    top: at?.top ?? top,
                    [side]: at?.offset ?? pos,
                    pointerEvents: isActive ? "auto" : "none",
                  }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{
                    opacity: isActive ? 1 : 0,
                    scale: isActive ? 1 : 0.5,
                  }}
                  transition={{
                    duration: reduce ? 0 : 0.55,
                    ease: EASE,
                    delay: isActive && !reduce ? si * 0.07 : 0,
                  }}
                >
                  <BubbleCard
                    item={group[gi]}
                    side={side}
                    index={index}
                    size={at?.size ?? FEATURES_BUBBLE.sizes[index] ?? FEATURES_BUBBLE.minSize}
                    reduce={reduce}
                    isActive={isActive}
                  />
                </motion.div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Every highlight of one feature, as the compact pill list used below xl and in flow. */
function HighlightPills({ feature, className = "" }: { feature: Feature; className?: string }) {
  const items = [...feature.leftUp, ...feature.leftDown, ...feature.rightUp, ...feature.rightDown];
  return (
    <ul className={`flex w-full flex-wrap justify-center gap-2 ${className}`}>
      {items.map((item) => (
        <li
          key={`${feature.key}-${item.tag}`}
          className="flex items-center gap-2 rounded-full border border-[#e91e63]/20 px-3 py-1.5 text-[12px] font-medium text-[#3d3d3d]"
          style={{ background: BUBBLE_GRAD, fontFamily: "'Montserrat', sans-serif" }}
        >
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#e91e63]">
            {item.tag}
          </span>
          {item.text}
        </li>
      ))}
    </ul>
  );
}
