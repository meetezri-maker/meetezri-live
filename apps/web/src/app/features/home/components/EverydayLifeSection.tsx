import { useCallback, useEffect, useId, useRef } from "react";
import { motion, transform, useScroll, useTransform, type MotionValue } from "motion/react";
import { usePinned } from "../layoutModes";
import imgQuiet from "../assets/moment-quiet-fg.webp";
import imgWin from "../assets/moment-win-fg.webp";
import imgEveryday from "../assets/moment-everyday-fg.webp";
import imgDecision from "../assets/moment-decision-fg.webp";
import imgNature from "../assets/app-insights.webp";

const GRAD = "linear-gradient(135deg, #e91e63 8%, #9c27b0 92%)";

type GradientCard = {
  id: string;
  type: "gradient";
  gradient: string;
  text: string;
  tag: string;
};
type ImageCard = {
  id: string;
  type: "image";
  image: string;
  text: string;
  tag: string;
};
type MomentCardType = GradientCard | ImageCard;

/*
 * The design filled this carousel with customer testimonials, names, and usage statistics.
 * None of those exist, so the cards carry Solace's approved product copy instead
 * (Talk It Out highlights, trust pillars, and the Human Moments transition) with no
 * attribution, and the statistics bar shows the homepage's existing trust indicators.
 */
/* Alternating: gradient → image → gradient → image → gradient → image ... */
const MOMENTS: MomentCardType[] = [
  {
    id: "a",
    type: "gradient",
    gradient: "linear-gradient(145deg, #e91e63 0%, #c2185b 40%, #9c27b0 100%)",
    text: "Talk about anything that's on your mind.",
    tag: "Talk It Out",
  },
  {
    id: "b",
    type: "image",
    image: imgQuiet,
    text: "Reflect on your day without judgment.",
    tag: "Reflect",
  },
  {
    id: "c",
    type: "gradient",
    gradient: "linear-gradient(145deg, #d81b60 0%, #e91e63 45%, #8e24aa 100%)",
    text: "Celebrate your wins, no matter how small.",
    tag: "Celebrate",
  },
  {
    id: "d",
    type: "image",
    image: imgWin,
    text: "Explore ideas, goals, and personal growth.",
    tag: "Grow",
  },
  {
    id: "e",
    type: "gradient",
    gradient: "linear-gradient(145deg, #ad1457 0%, #e91e63 50%, #7b1fa2 100%)",
    text: "Build healthier habits one conversation at a time.",
    tag: "Healthy Habits",
  },
  {
    id: "f",
    type: "image",
    image: imgEveryday,
    text: "Private, supportive, and available whenever you need it.",
    tag: "Always There",
  },
  {
    id: "g",
    type: "gradient",
    gradient: "linear-gradient(145deg, #c2185b 0%, #e91e63 45%, #7b1fa2 100%)",
    text: "Your conversations stay personal and protected.",
    tag: "Private by Design",
  },
  {
    id: "h",
    type: "image",
    image: imgDecision,
    text: "Choose when to talk, what to share, and how you use SOLACE.",
    tag: "You're in Control",
  },
  {
    id: "i",
    type: "gradient",
    gradient: "linear-gradient(145deg, #e91e63 0%, #d81b60 50%, #8e24aa 100%)",
    text: "SOLACE encourages healthier conversations while helping guide you toward additional support when needed.",
    tag: "Support",
  },
  {
    id: "j",
    type: "image",
    image: imgNature,
    text: "Whatever is on your mind, there's always a place to start the conversation.",
    tag: "Start Anywhere",
  },
];

const STATS = [
  { label: "Private by Design", icon: "🔒" },
  { label: "Safety First", icon: "🛡️" },
  { label: "No Credit Card Required", icon: "💳" },
  { label: "User Control", icon: "✦" },
];

/**
 * Where the pinned track sits on screen, measured from the real layout.
 * `travel` is how far the track moves left over the whole scroll; `peaks` is the scroll progress
 * at which each card's centre reaches the middle of the viewport (its "focal" moment).
 */
type TrackGeometry = { start: number; travel: number; peaks: number[]; delta: number };

/** Track offset at scroll progress `v`: from the design's 4% lead-in to the end of the track. */
export function trackX(geometry: TrackGeometry, v: number): number {
  return geometry.start - (geometry.start + geometry.travel) * v;
}

/**
 * Pure layout maths, kept separate so it can be unit tested: the travel that brings the last
 * card fully into view, and the progress at which each card is centred.
 */
export function measureTrack(
  viewportWidth: number,
  trackWidth: number,
  cardCentres: number[],
): TrackGeometry {
  const start = viewportWidth * 0.04;
  const travel = Math.max(0, trackWidth - viewportWidth);
  const span = start + travel;
  const peaks = cardCentres.map((centre) =>
    span > 0 ? Math.min(1, Math.max(0, (start + centre - viewportWidth / 2) / span)) : 0,
  );
  const gaps = peaks.slice(1).map((p, i) => p - peaks[i]).filter((g) => g > 0);
  const meanGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 1;
  return { start, travel, peaks, delta: meanGap * 0.95 };
}

/** The design's focal curve (scale, opacity, lift) around a card's measured peak. */
function focalCurve(geometry: TrackGeometry | null, index: number, total: number) {
  if (!geometry) return null;
  const peak = geometry.peaks[index] ?? 0;
  const delta = geometry.delta;
  if (index === 0 || peak <= 0) {
    return { input: [0, delta, delta * 2], scale: [1.14, 1.0, 0.94], opacity: [1, 0.9, 0.82], y: [-10, 0, 8] };
  }
  if (index === total - 1 || peak >= 1) {
    return { input: [1 - delta * 2, 1 - delta, 1], scale: [0.94, 1.0, 1.14], opacity: [0.82, 0.9, 1], y: [8, 0, -10] };
  }
  return {
    input: [Math.max(0, peak - delta), peak, Math.min(1, peak + delta)],
    scale: [0.94, 1.14, 0.94],
    opacity: [0.82, 1, 0.82],
    y: [8, -10, 8],
  };
}

/* ── Individual Moment Card with Dynamic Scroll Focus Scaling ── */
function MomentCardItem({
  m,
  index,
  total,
  scrollYProgress,
  geometryRef,
  animated,
  onImageLoad,
}: {
  m: MomentCardType;
  index: number;
  total: number;
  scrollYProgress: MotionValue<number>;
  geometryRef: React.RefObject<TrackGeometry | null>;
  /** False in the flow layout and with reduced motion: cards rest at their natural size. */
  animated: boolean;
  onImageLoad: () => void;
}) {
  // Function-form transforms: computed from the measured geometry on every frame, and never
  // handed to motion's document-wide native ScrollTimeline.
  const at = (key: "scale" | "opacity" | "y", rest: number) => (v: number) => {
    const curve = focalCurve(geometryRef.current, index, total);
    return animated && curve ? transform(curve.input, curve[key])(v) : rest;
  };
  const scale = useTransform(scrollYProgress, at("scale", 1));
  const opacity = useTransform(scrollYProgress, at("opacity", 1));
  const y = useTransform(scrollYProgress, at("y", 0));
  const zIndex = useTransform(scale, (s) => (s > 1.03 ? 20 : index + 1));

  const baseW = 275;
  const baseH = 355;

  const cardContent = (
    <div className="group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[22px] cursor-pointer">
      {/* Background */}
      {m.type === "image" ? (
        <>
          <img
            src={m.image}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={onImageLoad}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(160,20,90,0.14) 0%, rgba(120,15,140,0.46) 45%, rgba(80,8,120,0.88) 100%)",
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: m.gradient }} />
      )}

      {/* Tag */}
      <div className="relative z-10 p-5">
        <span
          className="rounded-full bg-white/20 px-3 py-[3px] text-[9.5px] font-bold uppercase tracking-wider text-white backdrop-blur-sm"
          style={{
            fontFamily: "'Inter', sans-serif",
            border: "1px solid rgba(255,255,255,0.25)",
          }}
        >
          {m.tag}
        </span>
      </div>

      {/* Highlight */}
      <div className="relative z-10 p-5">
        <p
          className="text-[15px] font-semibold leading-[1.45] text-white/95 drop-shadow-sm"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          {m.text}
        </p>
      </div>
    </div>
  );

  return (
    <motion.div
      className="relative shrink-0 select-none"
      data-home-card
      style={{
        width: baseW,
        height: baseH,
        scale,
        opacity,
        y,
        zIndex,
        transformOrigin: "center center",
      }}
      whileHover={{
        scale: 1.15,
        transition: { type: "spring", stiffness: 320, damping: 20 },
      }}
    >
      {/* 4px Gradient Border for image cards */}
      {m.type === "image" ? (
        <div
          className="h-full w-full rounded-[26px] p-[4px] shadow-[0_16px_40px_rgba(233,30,99,0.18)]"
          style={{ background: GRAD }}
        >
          {cardContent}
        </div>
      ) : (
        <div className="h-full w-full rounded-[22px] shadow-[0_16px_40px_rgba(156,39,176,0.18)]">
          {cardContent}
        </div>
      )}
    </motion.div>
  );
}

export default function EverydayLifeSection() {
  const containerRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const geometryRef = useRef<TrackGeometry | null>(null);
  const pinned = usePinned("carousel");
  const headingId = useId();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Re-measure whenever anything that changes the track's width or position could have
  // changed: the viewport or track resizing, images decoding, and web fonts arriving.
  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const centres = [...track.querySelectorAll<HTMLElement>("[data-home-card]")].map(
      (card) => card.offsetLeft + card.offsetWidth / 2,
    );
    geometryRef.current = measureTrack(viewport.clientWidth, track.scrollWidth, centres);
    // Re-emit the current progress so transforms pick up the new geometry without a scroll.
    scrollYProgress.set(scrollYProgress.get());
  }, [scrollYProgress]);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (viewportRef.current) observer.observe(viewportRef.current);
    if (trackRef.current) observer.observe(trackRef.current);
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const x = useTransform(scrollYProgress, (v) =>
    pinned && geometryRef.current ? trackX(geometryRef.current, v) : 0,
  );

  return (
    <section ref={containerRef} className="home-pin home-pin--carousel relative bg-white">
      <div className="home-pin-stage flex w-full flex-col items-center justify-center">
        {/* Header */}
        <div className="flex w-full flex-col items-center px-6 text-center">
          <span
            className="rounded-[10px] border border-[#e91e63]/50 px-4 py-[5px] text-[11px] font-semibold uppercase tracking-wider"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              background:
                "linear-gradient(131deg, rgba(233,30,99,0.08), rgba(156,39,176,0.08))",
              color: "#e91e63",
            }}
          >
            Moments
          </span>

          <h2
            id={headingId}
            className="mt-4 text-[clamp(30px,4vw,52px)] font-semibold leading-[1.15] tracking-[-1.5px] text-black"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            <span
              className="bg-clip-text text-transparent font-bold"
              style={{ backgroundImage: GRAD }}
            >
              Built
            </span>{" "}
            for
            <br />
            <span className="font-bold text-black">everyday life.</span>
          </h2>

          <div
            className="mt-3 h-[4px] w-[48px] rounded-full"
            style={{ background: GRAD }}
          />
        </div>

        {/* Scrolling Cards with Dynamic Focal Zoom */}
        {/* Pinned, the track moves with the page scroll; in flow (short screens, reduced
            motion) the same cards sit in a native horizontal scroller. */}
        <div
          ref={viewportRef}
          className="home-carousel-viewport relative mt-8 w-full py-4"
          role="region"
          aria-labelledby={headingId}
          tabIndex={pinned ? -1 : 0}
        >
          <motion.div
            ref={trackRef}
            className="flex w-max items-center gap-6 px-[10vw]"
            style={{ x }}
          >
            {MOMENTS.map((m, idx) => (
              <MomentCardItem
                key={m.id}
                m={m}
                index={idx}
                total={MOMENTS.length}
                scrollYProgress={scrollYProgress}
                geometryRef={geometryRef}
                animated={pinned}
                onImageLoad={measure}
              />
            ))}
          </motion.div>
        </div>

        {/* Stats bar — improved pill design */}
        <ul className="mt-10 flex flex-wrap items-center justify-center gap-2 px-6">
          {STATS.map((s, i) => (
            <li key={s.label} className="flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 rounded-full px-4 py-[7px]"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(233,30,99,0.06) 0%, rgba(156,39,176,0.06) 100%)",
                  border: "1px solid rgba(233,30,99,0.18)",
                  boxShadow: "0 2px 8px rgba(233,30,99,0.06)",
                }}
              >
                <span className="text-[12px]" aria-hidden>
                  {s.icon}
                </span>
                <span
                  className="text-[12px] font-semibold text-slate-700"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {s.label}
                </span>
              </div>
              {i < STATS.length - 1 && (
                <div
                  className="hidden h-[3px] w-[3px] rounded-full sm:block"
                  style={{
                    background: "linear-gradient(135deg,#e91e63,#9c27b0)",
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
