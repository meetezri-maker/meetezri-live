import { useEffect, useId, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  transform,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import svgPaths from "../svg/arrowPaths";
import { useHasMounted } from "../useHasMounted";
import { usePinned } from "../layoutModes";
import imgManBg from "../assets/moment-quiet-bg.webp";
import imgManFg from "../assets/moment-quiet-fg.webp";
import imgBlueBg from "../assets/moment-win-bg.webp";
import imgBlueFg from "../assets/moment-win-fg.webp";
import imgChairBg from "../assets/moment-everyday-bg.webp";
import imgChairFg from "../assets/moment-everyday-fg.webp";
import imgAthBg from "../assets/moment-decision-bg.webp";
import imgAthFg from "../assets/moment-decision-fg.webp";
import { Link } from "react-router";
import SolaceEmblem from "./SolaceEmblem";
import { EARLY_ACCESS_PATH, trackEarlyAccessClick } from "../homeActions";

const GRAD = "linear-gradient(135deg, #e91e63 8%, #9c27b0 92%)";
const EASE = [0.22, 1, 0.36, 1] as const;

type Card = {
  n: string;
  title: string;
  sub: string;
  bg: string;
  fg: string;
  sparkle?: "tl" | "tr";
};

const CARDS: Card[] = [
  {
    n: "(01)",
    title: "When the day is finally quiet...",
    sub: "Some nights, your thoughts are louder than the silence.",
    bg: imgManBg,
    fg: imgManFg,
    sparkle: "tr",
  },
  {
    n: "(02)",
    title: "After a small win...",
    sub: "Growth deserves to be noticed.",
    bg: imgBlueBg,
    fg: imgBlueFg,
  },
  {
    n: "(03)",
    title: "During everyday life...",
    sub: "Not every conversation starts with something difficult.",
    bg: imgChairBg,
    fg: imgChairFg,
    sparkle: "tl",
  },
  {
    n: "(04)",
    title: "Before a big decision...",
    sub: "Sometimes clarity begins with a conversation.",
    bg: imgAthBg,
    fg: imgAthFg,
  },
];

// Each later card slides up over the one before it during its own window.
const ENTER: ([number, number] | null)[] = [
  null,
  [0.06, 0.31],
  [0.34, 0.59],
  [0.62, 0.87],
];

/*
 * Scroll-linked opacity uses motion's function form of `useTransform`. The array form is
 * handed to a native ScrollTimeline, which motion 12 attaches to the whole document instead of
 * this section, so the heading and CTA never followed the section's scroll.
 */
const headOpacityAt = transform([0, 0.15, 1], [1, 0, 0]);
const ctaOpacityAt = transform([0, 0.8, 0.86, 1], [0, 0, 1, 1]);

/** SVG gradient ids must be unique per instance: these graphics render in both layouts. */
function useSvgId(prefix: string) {
  return `${prefix}_${useId().replace(/:/g, "")}`;
}

function Sparkle({ pos }: { pos: "tl" | "tr" }) {
  const gradientId = useSvgId("moment_sparkle");
  return (
    <div
      className={`pointer-events-none absolute z-20 h-[30px] w-[30px] rotate-[46deg] ${
        pos === "tr" ? "-right-2 -top-3" : "-left-2 -top-3"
      }`}
    >
      <svg aria-hidden viewBox="0 0 35.3771 36.6704" fill="none" className="h-full w-full">
        <path
          d={svgPaths.peb644f0}
          fill={`url(#${gradientId})`}
          stroke="white"
          strokeWidth="0.795427"
        />
        <defs>
          <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1="0"
            x2="35.6662"
            y1="11.6617"
            y2="24.1853"
          >
            <stop stopColor="#E91E63" />
            <stop offset="1" stopColor="#9C27B0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

/** The framed image and caption shared by the pinned stack and the flow list. */
function CardFace({ card }: { card: Card }) {
  return (
    <>
      {card.sparkle ? <Sparkle pos={card.sparkle} /> : null}

      {/* Framed image */}
      <div className="relative z-10 aspect-[16/10] w-full overflow-hidden rounded-[10px] bg-black">
        <img
          src={card.bg}
          loading="lazy"
          decoding="async"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-95 blur-[4px]"
        />
        <img
          src={card.fg}
          loading="lazy"
          decoding="async"
          alt={card.title}
          className="absolute left-1/2 top-1/2 h-[74%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-[5px] object-cover"
        />
      </div>

      {/* Caption */}
      <div className="relative -z-10 flex min-h-[96px] items-start gap-3 bg-white pt-4 pb-2">
        <span
          className="mt-[2px] bg-clip-text text-[14px] text-transparent"
          style={{ fontFamily: "'Inter', sans-serif", backgroundImage: GRAD }}
        >
          {card.n}
        </span>
        <div>
          <p
            className="text-[21px] leading-[1.1] tracking-[-0.6px] text-black"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
            }}
          >
            {card.title}
          </p>
          <p
            className="mt-2 text-[14px] tracking-[-0.6px] text-[#434343]"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
            }}
          >
            {card.sub}
          </p>
        </div>
      </div>
    </>
  );
}

function StackCard({
  card,
  index,
  progress,
  enter,
  coveredFrom,
}: {
  card: Card;
  index: number;
  progress: MotionValue<number>;
  enter: [number, number] | null;
  /** Progress at which the next card has fully covered this one, if any. */
  coveredFrom: number | null;
}) {
  const y = useTransform(
    progress,
    enter ?? [0, 1],
    enter ? ["115vh", "0vh"] : ["0vh", "0vh"],
  );
  // Once the next card has settled on top, this one is hidden visually so a taller caption
  // cannot show beneath it. It stays in the accessibility tree, in order.
  const opacity = useTransform(progress, (v) => (coveredFrom !== null && v >= coveredFrom ? 0 : 1));

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ zIndex: index + 1 }}
    >
      <motion.div
        className="w-[min(560px,86vw)] will-change-transform bg-white"
        style={{ y: !enter ? 0 : y, opacity }}
      >
        <CardFace card={card} />
      </motion.div>
    </div>
  );
}

function CurvedArrow({ down = true }: { down?: boolean }) {
  const headId = useSvgId("moment_ah");
  const lineId = useSvgId("moment_al");
  // Decorative and path-heavy: kept out of the prerendered HTML (see useHasMounted).
  if (!useHasMounted()) return null;
  return (
    <motion.svg aria-hidden
      viewBox="0 0 192.752 28.0938"
      fill="none"
      className={`h-[26px] w-[110px] ${down ? "rotate-[74deg]" : ""}`}
      animate={{ x: [0, 5, 0] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <path d={svgPaths.p3bf54f80} fill={`url(#${headId})`} />
      <path
        d={svgPaths.p2b5e9b00}
        stroke={`url(#${lineId})`}
        strokeLinecap="round"
        strokeWidth="2.92366"
      />
      <defs>
        <linearGradient
          id={headId}
          gradientUnits="userSpaceOnUse"
          x1="1.14138"
          x2="19.5851"
          y1="8.52298"
          y2="69.0184"
        >
          <stop stopColor="#E91E63" />
          <stop offset="1" stopColor="#9C27B0" />
        </linearGradient>
        <linearGradient
          id={lineId}
          gradientUnits="userSpaceOnUse"
          x1="1.87185"
          x2="12.6787"
          y1="17.1867"
          y2="20.093"
        >
          <stop stopColor="#E91E63" />
          <stop offset="1" stopColor="#9C27B0" />
        </linearGradient>
      </defs>
    </motion.svg>
  );
}

type SlideInfo = {
  n: string;
  heading: string;
  body: string;
};

const SLIDE_TEXTS: SlideInfo[] = [
  {
    n: "(01)",
    heading: "Celebrate every step",
    body: "Progress doesn't always look dramatic. Solace helps you recognise the wins that often go unspoken.",
  },
  {
    n: "(02)",
    heading: "Just checking in",
    body: "Sometimes the best conversations happen on an ordinary afternoon. Solace fits into your everyday, not just your hard days.",
  },
  {
    n: "(03)",
    heading: "Think it through together",
    body: "Big decisions can feel isolating. Talk it out with Solace and find the clarity you need before you take the leap.",
  },
  {
    n: "(04)",
    heading: "Before a big decision...",
    body: "When the stakes feel highest, Solace is there — a steady, judgment-free presence to help you trust yourself again.",
  },
];

function SlideText({ slide }: { slide: SlideInfo }) {
  return (
    <>
      <span
        className="mb-3 inline-flex self-start rounded-full border border-[#e91e63]/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
        style={{
          backgroundImage:
            "linear-gradient(131deg, rgba(233,30,99,0.1), rgba(156,39,176,0.1))",
          fontFamily: "'Montserrat', sans-serif",
        }}
      >
        <span
          className="bg-clip-text text-transparent"
          style={{ backgroundImage: GRAD }}
        >
          {slide.n}
        </span>
      </span>
      <h3
        className="text-[clamp(28px,3.2vw,40px)] leading-[1.1] tracking-[-1.2px] text-black"
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 600,
        }}
      >
        {slide.heading}
      </h3>
      <div
        className="mt-3 h-[3px] w-[48px] rounded-full"
        style={{ background: GRAD }}
      />
      <p
        className="mt-4 max-w-[360px] text-[16px] leading-[1.65] text-[#555]"
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 500,
        }}
      >
        {slide.body}
      </p>
    </>
  );
}

function SectionHeading({ size }: { size: "desktop" | "mobile" }) {
  return size === "desktop" ? (
    <>
      <span
        className="inline-flex rounded-[12px] border border-[#e91e63] px-3 py-[6px] text-[11.1px] font-semibold uppercase backdrop-blur-[4px]"
        style={{
          backgroundImage:
            "linear-gradient(131deg, rgba(233,30,99,0.12), rgba(156,39,176,0.12))",
        }}
      >
        <span
          className="bg-clip-text text-transparent"
          style={{
            fontFamily: "'Montserrat', sans-serif",
            backgroundImage: GRAD,
          }}
        >
          Moments
        </span>
      </span>
      <h2
        className="mt-5 text-[clamp(40px,4.4vw,56px)] leading-[1] tracking-[-1.7px] text-black"
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 400,
        }}
      >
        Everyday
        <br />
        <span
          className="bg-clip-text text-transparent"
          style={{ fontWeight: 600, backgroundImage: GRAD }}
        >
          Moments.....
        </span>
      </h2>
      <div
        className="mt-4 h-[5px] w-[57px] rounded-full"
        style={{ background: GRAD }}
      />
    </>
  ) : (
    <>
      <h2
        className="text-[32px] leading-[1.05] tracking-[-1.2px] text-black"
        style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400 }}
      >
        Everyday{" "}
        <span className="bg-clip-text text-transparent" style={{ fontWeight: 600, backgroundImage: GRAD }}>
          Moments.....
        </span>
      </h2>
      <div className="mt-3 h-[4px] w-[48px] rounded-full" style={{ background: GRAD }} />
    </>
  );
}

function FoundingMemberCta({ withArrow = false }: { withArrow?: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <Link
        to={EARLY_ACCESS_PATH}
        onClick={() => trackEarlyAccessClick("home_moments")}
        className="inline-flex items-center whitespace-nowrap rounded-[14px] px-8 py-[14px] text-[14px] tracking-[0.28px] text-white shadow-[0px_8px_16px_rgba(233,30,99,0.34)] transition-transform hover:scale-105"
        style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 700,
          backgroundImage: GRAD,
        }}
      >
        Become a Founding Member
      </Link>
      {withArrow ? (
        <div className="translate-y-[-3px]">
          <CurvedArrow down={false} />
        </div>
      ) : null}
    </div>
  );
}

export default function MomentsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinned = usePinned("moments");

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const [activeSlide, setActiveSlide] = useState<number | null>(null);

  useEffect(() => {
    return scrollYProgress.on("change", (v) => {
      if (v >= 0.82) setActiveSlide(3);
      else if (v >= 0.58) setActiveSlide(2);
      else if (v >= 0.32) setActiveSlide(1);
      else if (v >= 0.08) setActiveSlide(0);
      else setActiveSlide(null);
    });
  }, [scrollYProgress]);

  // Map the full 0 -> 1 scroll range explicitly to guarantee it never bounces back or extrapolates.
  const headY = useTransform(scrollYProgress, [0, 0.15, 1], [0, -150, -150]);
  const headOpacity = useTransform(scrollYProgress, headOpacityAt);

  // The CTA fades in right as the final card (card 4) comes into place.
  const ctaOpacity = useTransform(scrollYProgress, ctaOpacityAt);
  const ctaY = useTransform(scrollYProgress, [0, 0.8, 0.86, 1], [22, 22, 0, 0]);

  // While the pinned CTA is faded out it is inert, so keyboard users cannot land on an
  // invisible link. A focused CTA is never hidden or made inert (focus guard).
  const [ctaShown, setCtaShown] = useState(false);
  const [ctaFocused, setCtaFocused] = useState(false);
  useMotionValueEvent(ctaOpacity, "change", (v) => setCtaShown(v >= 0.5));
  const ctaInert = pinned && !ctaShown && !ctaFocused;

  return (
    <section ref={sectionRef} className="home-pin home-pin--moments relative bg-white">
      <div className="home-pin-stage flex items-center">
        {/* Floating Solace Emblem in background */}
        <div className="absolute right-[4%] top-[8%] pointer-events-none z-0 hidden xl:block opacity-55">
          <SolaceEmblem size={135} tilt={15} />
        </div>

        {/* Pinned layout: the cards stack as the page scrolls. */}
        <div className="home-pinned-only mx-auto grid w-full max-w-[1360px] grid-cols-1 items-center gap-4 lg:gap-16 px-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] relative z-10">
          {/* Left column */}
          <div className="relative hidden h-[560px] lg:block">
            {/* Persistent top badge */}
            <motion.div
              className="absolute left-0 top-0"
              style={{ y: headY, opacity: headOpacity, pointerEvents: "none" }}
            >
              <SectionHeading size="desktop" />
            </motion.div>

            {/* Per-slide animated text — with AnimatePresence so only active slide renders */}
            <div className="absolute inset-x-0 top-[120px] bottom-[110px] pointer-events-none">
              <AnimatePresence mode="wait">
                {activeSlide !== null && (
                  <motion.div
                    key={SLIDE_TEXTS[activeSlide].n}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="absolute inset-0 flex flex-col justify-start pt-6"
                  >
                    <SlideText slide={SLIDE_TEXTS[activeSlide]} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom CTA — fades in on last card */}
            <motion.div
              className="absolute bottom-4 left-0"
              style={{ opacity: ctaFocused ? 1 : ctaOpacity, y: ctaFocused ? 0 : ctaY }}
              onFocus={() => setCtaFocused(true)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setCtaFocused(false);
              }}
              {...(ctaInert ? { inert: "" } : {})}
            >
              <FoundingMemberCta withArrow />
            </motion.div>
          </div>

          {/* Phones and tablets: the left column does not fit, so its heading and call to
              action sit above and below the card stack instead. */}
          <div className="flex flex-col items-start lg:hidden">
            <SectionHeading size="mobile" />
          </div>

          {/* Right column: stacking cards */}
          <div className="relative h-[420px] w-full sm:h-[520px]">
            {CARDS.map((card, i) => (
              <StackCard
                key={card.n}
                card={card}
                index={i}
                progress={scrollYProgress}
                enter={ENTER[i]}
                coveredFrom={ENTER[i + 1]?.[1] ?? null}
              />
            ))}
          </div>

          <div className="lg:hidden">
            <FoundingMemberCta />
          </div>
        </div>

        {/* Flow layout (short screens, reduced motion): every card with its text, in order. */}
        <div className="home-flow-only mx-auto w-full max-w-[1360px] px-6 relative z-10">
          <div className="flex flex-col items-start">
            <SectionHeading size="desktop" />
          </div>
          <ol className="mt-10 flex flex-col gap-12">
            {CARDS.map((card, i) => (
              <li
                key={card.n}
                className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-16"
              >
                <div className="flex flex-col">
                  <SlideText slide={SLIDE_TEXTS[i]} />
                </div>
                <div className="relative mx-auto w-[min(560px,100%)] bg-white">
                  <CardFace card={card} />
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <FoundingMemberCta withArrow />
          </div>
        </div>
      </div>
    </section>
  );
}
