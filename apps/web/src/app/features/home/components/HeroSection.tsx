import { useEffect, useRef } from "react";
import { motion, transform, useScroll, useTransform } from "motion/react";
import { useHomeReducedMotion } from "../useHomeReducedMotion";
import imgBackground from "../assets/hero-sky.webp";
import imgDashboard from "../assets/app-dashboard.webp";
import imgCloud from "../assets/hero-cloud.webp";
import SolaceEmblem from "./SolaceEmblem";
import { scrollToSection } from "../scroll";

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 12 8.3"
      fill="none"
      aria-hidden
      className={className}
      animate={{ x: [0, 3, 0] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
    >
      <path
        d="M7.7 0.3 11.7 4c0.2 0.2 0.2 0.5 0 0.7L7.7 8c-0.2 0.2-0.6 0.1-0.6-0.2V5.2H0.5c-0.3 0-0.5-0.2-0.5-0.5V3.6c0-0.3 0.2-0.5 0.5-0.5H7.1V0.5C7.1 0.2 7.5 0.1 7.7 0.3Z"
        fill="currentColor"
      />
    </motion.svg>
  );
}

function Cloud({ className, delay = 0 }: { className: string; delay?: number }) {
  const reduce = useHomeReducedMotion();
  return (
    <motion.img
      src={imgCloud}
      alt=""
      aria-hidden
      className={`pointer-events-none absolute select-none ${className}`}
      animate={reduce ? undefined : { x: [0, 24, 0] }}
      transition={{ duration: 18, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// Function form, not the array form: motion hands array-form opacity to a native ScrollTimeline
// bound to the whole document rather than this section.
const textOpacityAt = transform([0, 0.75, 1], [1, 1, 0.35]);

/** Below this width the lifting dashboard would cover the hero's calls to action. */
const CTA_CLEARANCE_QUERY = "(max-width: 1023px)";
const CTA_CLEARANCE_PX = 16;

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const ctaRowRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  // Untransformed layout of the CTA row and dashboard, measured on phones and tablets only.
  const clearanceRef = useRef<{ gap: number; height: number } | null>(null);
  const reduce = useHomeReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  useEffect(() => {
    const cta = ctaRowRef.current;
    const screen = screenRef.current;
    if (!cta || !screen || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(CTA_CLEARANCE_QUERY);
    const measure = () => {
      // offsetTop ignores transforms, so these are the resting positions in the content column.
      const ctaBottom = cta.offsetTop + cta.offsetHeight;
      clearanceRef.current = query.matches
        ? { gap: screen.offsetTop - ctaBottom, height: screen.offsetHeight }
        : null;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(cta);
    observer.observe(screen);
    query.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      query.removeEventListener("change", measure);
    };
  }, []);

  // Text rises upward as the user scrolls
  const textY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const textOpacity = useTransform(scrollYProgress, textOpacityAt);

  // Dashboard starts visible, then lifts and enlarges prominently on scroll
  const screenScale = useTransform(scrollYProgress, [0, 1], [0.88, 1.28]);
  // On phones and tablets the lift stops short of the CTA row so both buttons stay visible
  // and clickable; on desktop it follows the design's full lift.
  const screenY = useTransform(scrollYProgress, (v) => {
    const designY = -220 * v;
    const clearance = clearanceRef.current;
    if (!clearance) return designY;
    const scale = 0.88 + 0.4 * v;
    const ctaShift = -120 * v;
    const minY = ctaShift + CTA_CLEARANCE_PX - clearance.gap + ((scale - 1) * clearance.height) / 2;
    return Math.max(designY, minY);
  });

  // Background pans down toward grass level as the user scrolls
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);

  return (
    <section ref={sectionRef} id="hero" className="relative h-[220vh]">
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Background — pans down to grass level on scroll */}
        <motion.img
          src={imgBackground}
          alt=""
          aria-hidden
          style={reduce ? undefined : { y: bgY }}
          className="pointer-events-none absolute inset-x-0 top-0 h-[135%] w-full select-none object-cover object-top"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white" />

        {/* Clouds */}
        <Cloud className="left-[3%] top-[16%] w-[220px] opacity-80" delay={0} />
        <Cloud
          className="right-[2%] top-[10%] w-[300px] opacity-90"
          delay={4}
        />

        {/* Floating emblem in lower-left empty space */}
        <div className="pointer-events-none absolute bottom-[8%] left-[3%] z-0 hidden xl:block opacity-40">
          <SolaceEmblem size={110} tilt={-18} />
        </div>

        {/* Content */}
        <div className="relative z-10 mx-auto flex h-full max-w-[1100px] flex-col items-center px-6 pt-[190px] text-center">
          <motion.div
            style={reduce ? undefined : { y: textY, opacity: textOpacity }}
            className="flex flex-col items-center"
          >
            <h1
              className="text-[clamp(48px,8.5vw,100px)] leading-[1] tracking-[-0.014em] text-[#1d1d1d]"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontWeight: 600,
              }}
            >
              Talk to Solace
            </h1>
            <p
              className="mt-5 max-w-[600px] text-[18.6px] leading-[26px] text-[#4d585f]"
              style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}
            >
              Talk through what&apos;s on your mind with a private AI companion
              designed to help you express, reflect, and process what&apos;s
              weighing on you.
            </p>

            <div ref={ctaRowRef} className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <a
                href="#pricing"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection("pricing");
                }}
                className="group flex items-center rounded-full border border-white/70 bg-white/10 p-[6px] backdrop-blur-[2.5px] cursor-pointer"
              >
                <span className="relative flex items-center overflow-hidden rounded-full border border-[#e91e63] bg-gradient-to-br from-[#e91e63] to-[#9c27b0] py-3 pl-[30px] pr-[54px] shadow-[0px_8px_16px_rgba(233,30,99,0.34),inset_4px_4px_8px_rgba(255,255,255,0.3),inset_-4px_-4px_8px_rgba(255,255,255,0.3)]">
                  <span className="text-[17px] font-semibold text-white">
                    Get started now
                  </span>
                  <span className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white transition-transform group-hover:translate-x-[2px]">
                    <ArrowIcon className="h-[8px] w-[12px] text-[#1d1d1d]" />
                  </span>
                </span>
              </a>
              <a
                href="#about"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection("about");
                }}
                className="rounded-full bg-white px-8 py-[18px] text-[17.2px] font-semibold text-[#1d1d1d] shadow-[0px_8px_16px_rgba(29,29,29,0.08)] transition-transform hover:-translate-y-[1px] cursor-pointer"
              >
                Meet the Founder
              </a>
            </div>
          </motion.div>

          {/* Dashboard screen — sits lower, lifts and enlarges on scroll */}
          <motion.div
            ref={screenRef}
            style={
              reduce
                ? undefined
                : {
                    scale: screenScale,
                    y: screenY,
                    transformOrigin: "center center",
                    willChange: "transform",
                  }
            }
            className="mt-12 w-full max-w-[960px] shrink-0 rounded-[22px] p-[3px]"
          >
            <div className="rounded-[22px] bg-gradient-to-br from-[#e91e63]/60 to-[#9c27b0]/60 p-[2px] shadow-[0px_40px_90px_rgba(76,20,90,0.35)]">
              <img
                src={imgDashboard}
                alt="Solace companion dashboard"
                width={2000}
                height={1259}
                decoding="async"
                className="block w-full rounded-[20px] object-cover"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
