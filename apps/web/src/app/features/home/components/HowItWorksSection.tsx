import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useScroll,
  useTransform,
  useSpring,
  type MotionValue,
} from "motion/react";
import { useHomeReducedMotion } from "../useHomeReducedMotion";
import { usePinned } from "../layoutModes";
import imgPlaceholder from "../assets/app-rest.webp";
import SolaceEmblem from "./SolaceEmblem";
import { SUBSCRIPTION_PLANS } from "@/app/utils/subscriptionPlans";

const GRAD = "linear-gradient(135deg, #e91e63 8%, #9c27b0 92%)";

const { trial, core, pro } = SUBSCRIPTION_PLANS;

// Figures come from the membership configuration so they cannot drift from what is sold.
const MODULES = [
  {
    step: "Step 01",
    title: "Talk It Out",
    desc: "Talk about anything that's on your mind, in your own words, with an AI companion designed to help you reflect.",
    features: [
      { num: `${trial.credits} Minutes`, text: "Free to start,\nno credit card required" },
      { num: `${pro.credits}`, text: `Minutes each month\nwith ${pro.displayName}` },
    ],
    img: imgPlaceholder,
  },
  {
    step: "Step 02",
    title: "Journal Thoughts",
    desc: "Reflect on your day, track your moods, and build a healthy habit of self-awareness.",
    features: [
      { num: "Daily", text: "Mood check-ins\non every membership" },
      { num: "Export", text: `PDF and JSON journal\nexport with ${core.displayName}` },
    ],
    img: imgPlaceholder,
  },
  {
    step: "Step 03",
    title: "Wellness Toolkit",
    desc: "Explore breathing exercises, grounding techniques, and mindful practices.",
    features: [
      { num: "Library", text: `Wellness tools with\n${core.displayName} and ${pro.displayName}` },
      { num: "Guided", text: "Breathing and\ngrounding exercises" },
    ],
    img: imgPlaceholder,
  },
];

/* ── Sub-components ── */

function TextSlide({
  mod,
  index,
  smoothProgress,
}: {
  mod: typeof MODULES[number];
  index: number;
  smoothProgress: MotionValue<number>;
}) {
  const start = index === 0 ? 0 : (index - 0.1) / MODULES.length;
  const peakIn = (index + 0.1) / MODULES.length;
  const peakOut = (index + 0.8) / MODULES.length;
  const end = (index + 1) / MODULES.length;

  const opacity = useTransform(
    smoothProgress,
    [start, peakIn, peakOut, end],
    [index === 0 ? 1 : 0, 1, 1, 0],
  );
  const y = useTransform(
    smoothProgress,
    [start, peakIn, peakOut, end],
    [index === 0 ? 0 : 30, 0, 0, -30],
  );

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-start"
      style={{ opacity, y, pointerEvents: "none" }}
    >
      <h3
        className="text-[38px] leading-[1.15] tracking-[-1px] lg:text-[46px]"
        style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400 }}
      >
        <span
          className="bg-clip-text font-semibold italic text-transparent"
          style={{ backgroundImage: GRAD }}
        >
          {mod.title.split(" ")[0]}
        </span>{" "}
        <span className="text-[#1d1d1d]">
          {mod.title.split(" ").slice(1).join(" ")}
        </span>
      </h3>
      <p
        className="mt-4 max-w-[474px] text-[16px] font-medium leading-[1.55] text-[#555] lg:text-[16.7px]"
        style={{ fontFamily: "'Montserrat', sans-serif" }}
      >
        {mod.desc}
      </p>

      <div className="mt-10 flex w-full flex-col gap-6 sm:flex-row sm:gap-14">
        {mod.features.map((feat, fi) => (
          <div key={fi} className="flex flex-col gap-1.5">
            <span
              className="bg-clip-text text-[28px] font-bold text-transparent lg:text-[32px]"
              style={{
                fontFamily: "'Montserrat', sans-serif",
                backgroundImage: GRAD,
              }}
            >
              {feat.num}
            </span>
            <span
              className="whitespace-pre-line text-[14px] font-medium leading-[1.5] text-[#666] lg:text-[14.8px]"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {feat.text}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function UniqueDockStepper({
  scrollYProgress,
  onSelectStep,
}: {
  scrollYProgress: MotionValue<number>;
  onSelectStep: (idx: number) => void;
}) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    return scrollYProgress.on("change", (latest) => {
      if (latest >= 0.62) setActiveStep(2);
      else if (latest >= 0.3) setActiveStep(1);
      else setActiveStep(0);
    });
  }, [scrollYProgress]);

  const steps = [
    {
      num: "01",
      phase: "PHASE 01",
      title: "Talk It Out",
      tag: "Live Voice AI",
    },
    {
      num: "02",
      phase: "PHASE 02",
      title: "Journal Thoughts",
      tag: "Daily Reflection",
    },
    {
      num: "03",
      phase: "PHASE 03",
      title: "Wellness Toolkit",
      tag: "Mindful Habits",
    },
  ];

  // Track progress position: 0% at step 0, 50% at step 1, 100% at step 2
  const progressPercent =
    activeStep === 0 ? "0%" : activeStep === 1 ? "50%" : "100%";

  return (
    <div className="relative z-20 w-full select-none px-1">
      {/* Ethereal Ambient Radial Light behind active node — completely blends into canvas */}
      <motion.div
        className="pointer-events-none absolute -top-10 h-32 w-56 rounded-full blur-3xl opacity-50"
        style={{
          background:
            "radial-gradient(circle, rgba(233,30,99,0.22) 0%, rgba(156,39,176,0.14) 55%, transparent 75%)",
        }}
        animate={{
          left: activeStep === 0 ? "0%" : activeStep === 1 ? "34%" : "66%",
        }}
        transition={{ type: "spring", stiffness: 220, damping: 28 }}
      />

      {/* Floating Timeline Track & Interactive Step Nodes (No background box) */}
      <div className="relative w-full py-1">
        {/* Horizontal Connecting Timeline Track Line */}
        <div className="pointer-events-none absolute left-[16%] right-[16%] top-[25px] h-[2.5px] -translate-y-1/2">
          {/* Subtle Base Track with delicate glowing tint */}
          <div className="absolute inset-0 rounded-full bg-slate-200/80" />

          {/* Animated Illuminated Gradient Progress Beam */}
          <motion.div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{
              background: GRAD,
              boxShadow: "0 0 12px rgba(233,30,99,0.55)",
            }}
            animate={{ width: progressPercent }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Gliding Glowing Spark Head at the front edge */}
          <motion.div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_2.5px_rgba(233,30,99,0.85),0_0_3px_#fff]"
            animate={{ left: progressPercent }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        {/* Step Nodes */}
        <div className="relative flex items-start justify-between">
          {steps.map((s, i) => {
            const isActive = activeStep === i;
            const isCompleted = i < activeStep;

            return (
              <button
                key={s.num}
                type="button"
                onClick={() => onSelectStep(i)}
                aria-label={`Step ${s.num}: ${s.title}`}
                aria-current={isActive ? "step" : undefined}
                className="group relative flex cursor-pointer flex-col items-center focus:outline-none"
              >
                {/* Node Orb Marker */}
                <div className="relative flex h-[50px] w-[50px] items-center justify-center">
                  {/* Active Luminous Radar Rings */}
                  {isActive && (
                    <>
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ border: "1.5px solid rgba(233,30,99,0.4)" }}
                        animate={{
                          scale: [1, 1.32, 1],
                          opacity: [0.9, 0.25, 0.9],
                        }}
                        transition={{
                          duration: 2.4,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                      <motion.div
                        className="absolute -inset-1 rounded-full bg-pink-500/10 blur-sm"
                        animate={{ opacity: [0.35, 0.75, 0.35] }}
                        transition={{
                          duration: 2.0,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    </>
                  )}

                  {/* Core Node Circle */}
                  <motion.div
                    className={`relative z-10 flex items-center justify-center rounded-full transition-all duration-300 ${
                      isActive
                        ? "h-11 w-11 text-white shadow-[0_8px_24px_rgba(233,30,99,0.45)] ring-4 ring-pink-500/20"
                        : isCompleted
                          ? "h-9 w-9 text-white shadow-[0_4px_12px_rgba(233,30,99,0.25)]"
                          : "h-9 w-9 border-2 border-slate-200 bg-white/90 text-slate-400 backdrop-blur-sm group-hover:border-pink-300 group-hover:text-slate-700"
                    }`}
                    style={
                      isActive || isCompleted ? { background: GRAD } : undefined
                    }
                    animate={isActive ? { scale: 1.06 } : { scale: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 24 }}
                  >
                    {isCompleted ? (
                      <svg aria-hidden
                        className="h-4 w-4 stroke-current stroke-[2.8]"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M5 13l4 4L19 7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <span
                        className={`font-extrabold ${
                          isActive ? "text-[13px]" : "text-[11px]"
                        }`}
                      >
                        {s.num}
                      </span>
                    )}
                  </motion.div>
                </div>

                {/* Typography & Step Labels */}
                <div className="mt-1 flex flex-col items-center text-center">
                  <span
                    className={`text-[9.5px] font-bold uppercase tracking-widest transition-colors ${
                      isActive
                        ? "text-[#e91e63]"
                        : isCompleted
                          ? "text-slate-500"
                          : "text-slate-400"
                    }`}
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    {s.phase}
                  </span>

                  <span
                    className={`mt-0.5 text-[13px] font-bold tracking-tight transition-colors sm:text-[13.5px] ${
                      isActive
                        ? "text-slate-900"
                        : isCompleted
                          ? "text-slate-700"
                          : "text-slate-400 group-hover:text-slate-600"
                    }`}
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    {s.title}
                  </span>

                  {/* Creative Status Badge */}
                  <div className="mt-1.5 flex items-center">
                    {isActive ? (
                      <motion.div
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] shadow-sm"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(233,30,99,0.1), rgba(156,39,176,0.1))",
                          border: "1px solid rgba(233,30,99,0.28)",
                        }}
                      >
                        {/* Animated Voice/Mindful Equalizer Wave */}
                        <div className="flex h-2.5 items-end gap-[2px]">
                          <motion.span
                            className="w-[2px] rounded-full bg-[#e91e63]"
                            animate={{ height: ["3px", "10px", "3px"] }}
                            transition={{
                              duration: 0.75,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          />
                          <motion.span
                            className="w-[2px] rounded-full bg-[#e91e63]"
                            animate={{ height: ["9px", "3px", "9px"] }}
                            transition={{
                              duration: 0.85,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          />
                          <motion.span
                            className="w-[2px] rounded-full bg-[#9c27b0]"
                            animate={{ height: ["4px", "10px", "4px"] }}
                            transition={{
                              duration: 0.65,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          />
                        </div>
                        <span
                          className="bg-clip-text text-[9px] font-bold uppercase tracking-wider text-transparent"
                          style={{
                            backgroundImage: GRAD,
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          Active
                        </span>
                      </motion.div>
                    ) : isCompleted ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-pink-50/80 px-2 py-[2px] text-[8.5px] font-bold uppercase tracking-wider text-[#e91e63]"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                      >
                        <span className="h-1 w-1 rounded-full bg-[#e91e63]" />
                        Done
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-[2px] text-[8.5px] font-medium uppercase tracking-wider text-slate-400"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                      >
                        Next
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepCard({
  mod,
  index,
  smoothProgress,
}: {
  mod: typeof MODULES[number];
  index: number;
  smoothProgress: MotionValue<number>;
}) {
  const isLast = index === MODULES.length - 1;
  const start = index === 0 ? 0 : (index - 0.15) / MODULES.length;
  const peakIn = (index + 0.12) / MODULES.length;
  const peakOut = (index + 0.85) / MODULES.length;
  const end = (index + 1) / MODULES.length;

  const y = useTransform(smoothProgress, [start, peakIn, peakOut, end], [
    index === 0 ? 0 : 80,
    0,
    0,
    isLast ? 0 : -50,
  ]);
  const scale = useTransform(smoothProgress, [start, peakIn, peakOut, end], [
    index === 0 ? 1 : 0.82,
    1,
    1,
    isLast ? 1 : 0.92,
  ]);
  const opacity = useTransform(smoothProgress, [start, peakIn, peakOut, end], [
    index === 0 ? 1 : 0,
    1,
    1,
    isLast ? 1 : 0.3,
  ]);
  const rotateX = useTransform(smoothProgress, [start, peakIn, peakOut, end], [
    index === 0 ? 0 : 8,
    0,
    0,
    isLast ? 0 : -4,
  ]);
  const glowVal = useTransform(
    smoothProgress,
    [start, peakIn, peakOut, end],
    [0, 0.25, 0.25, 0],
  );
  const borderColor = useTransform(glowVal, (v) => `rgba(233, 30, 99, ${v})`);

  return (
    <motion.div
      className="absolute inset-x-0 top-10 flex flex-col items-center overflow-hidden rounded-[30px] p-[2px] shadow-2xl"
      style={{
        scale,
        y,
        opacity,
        rotateX,
        zIndex: index + 1,
        transformOrigin: "bottom center",
        background: borderColor,
      }}
    >
      <div className="flex w-full flex-col items-center overflow-hidden rounded-[28px] bg-white">
        {/* Gradient top accent bar */}
        <div className="h-[3px] w-full" style={{ background: GRAD }} />
        <div className="flex w-full flex-col items-center p-5 pt-4 sm:p-8 sm:pt-6">
          <div className="relative h-[170px] w-full max-w-[460px] overflow-hidden rounded-[16px] sm:h-[320px]">
            <img
              src={mod.img}
              loading="lazy"
              decoding="async"
              alt={mod.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 h-[60px] bg-gradient-to-t from-white/40 to-transparent" />
          </div>
          <div className="mt-6 flex flex-col items-center text-center">
            <h4
              className="text-[22px] tracking-[-0.5px]"
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 400,
              }}
            >
              <span
                className="bg-clip-text font-semibold italic text-transparent"
                style={{ backgroundImage: GRAD }}
              >
                {mod.title.split(" ")[0]}
              </span>{" "}
              <span className="text-[#1d1d1d]">
                {mod.title.split(" ").slice(1).join(" ")}
              </span>
            </h4>
            <p
              className="mt-2 max-w-[380px] text-[15px] font-medium leading-[1.5] text-[#666]"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {mod.desc}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main Section ── */

/** Progress that centres step `idx` in the slide and card timelines below. */
const stepProgress = (idx: number) => (idx + 0.45) / MODULES.length;

export default function HowItWorksSection() {
  const containerRef = useRef<HTMLElement>(null);
  const pinned = usePinned("howItWorks");
  const reduce = useHomeReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  /*
   * One progress value drives the stepper, text slides and cards of the pinned layout (the flow
   * layout lists every step instead). It follows the page scroll through the section; until
   * the media query has been read after mount, the stepper buttons set it directly.
   */
  const progress = useMotionValue(0);
  useEffect(() => {
    if (!pinned) return;
    progress.set(scrollYProgress.get());
    return scrollYProgress.on("change", (v) => progress.set(v));
  }, [pinned, progress, scrollYProgress]);

  const springProgress = useSpring(progress, {
    stiffness: 80,
    damping: 22,
  });
  const smoothProgress = reduce ? progress : springProgress;

  const handleSelectModule = (idx: number) => {
    if (!pinned) {
      progress.set(stepProgress(idx));
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const sectionTop = window.scrollY + rect.top;
    const totalScrollable = el.offsetHeight - window.innerHeight;
    const targetY =
      sectionTop + (idx / (MODULES.length - 1)) * (totalScrollable * 0.82);
    window.scrollTo({ top: targetY, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section
      ref={containerRef}
      id="how-it-works"
      className="home-pin home-pin--how-it-works relative bg-white"
    >
      <div className="home-pin-stage flex w-full flex-col items-center justify-center">
        {/* Floating emblem in lower-right empty space */}
        <div className="pointer-events-none absolute bottom-[6%] right-[3%] z-0 hidden xl:block opacity-35">
          <SolaceEmblem size={120} tilt={12} />
        </div>

        {/* Header */}
        <div className="flex w-full max-w-[1260px] flex-col items-center px-6 text-center">
          <span
            className="rounded-[12px] border border-[#e91e63] px-4 py-[6px] text-[11px] font-semibold uppercase backdrop-blur-[4px]"
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
              Meet Solace
            </span>
          </span>
          <h2
            className="mt-4 text-[clamp(40px,4.4vw,56px)] leading-[1] tracking-[-1.7px] text-black"
            style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400 }}
          >
            Meet{" "}
            <span
              className="bg-clip-text font-semibold italic text-transparent"
              style={{ backgroundImage: GRAD }}
            >
              Solace
            </span>
          </h2>
          <p
            className="mt-3 max-w-[440px] text-[15px] leading-[1.6] text-[#666]"
            style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}
          >
            Your companion for every step of the journey
          </p>
          <div
            className="mt-4 h-[5px] w-[57px] rounded-full"
            style={{ background: GRAD }}
          />
        </div>

        {/* Pinned layout: one step at a time, stepped by the page scroll. */}
        <div className="home-pinned-only relative mt-4 flex w-full max-w-[1260px] flex-col gap-6 px-6 lg:mt-12 lg:flex-row lg:items-start lg:gap-20">
          {/* Left Column — hidden below lg, where the stage has no room for it (the cards
              carry each step's title and text). */}
          <div className="home-hiw-text flex flex-1 flex-col items-start pt-6 lg:pt-12">
            <div
              className="inline-flex rounded-full border border-[#e91e63]/30 px-5 py-2.5"
              style={{
                backgroundImage:
                  "linear-gradient(131deg, rgba(233,30,99,0.08), rgba(156,39,176,0.08))",
              }}
            >
              <span
                className="bg-clip-text text-[13.3px] font-semibold text-transparent"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  backgroundImage: GRAD,
                }}
              >
                How it works
              </span>
            </div>

            <div className="relative mt-8 min-h-[200px] w-full">
              {MODULES.map((mod, i) => (
                <TextSlide
                  key={`text-${i}`}
                  mod={mod}
                  index={i}
                  smoothProgress={smoothProgress}
                />
              ))}
            </div>
          </div>

          {/* Right Column */}
          <div className="relative w-full max-w-[620px]">
            {/* Unique Liquid Glass Dock Stepper */}
            <UniqueDockStepper
              scrollYProgress={progress}
              onSelectStep={handleSelectModule}
            />

            {/* Stacking Cards */}
            <div className="relative mt-2 h-[400px] w-full pt-6 sm:h-[520px]">
              {MODULES.map((mod, i) => (
                <StepCard
                  key={`card-${i}`}
                  mod={mod}
                  index={i}
                  smoothProgress={smoothProgress}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Flow layout (short screens, reduced motion): all three steps in order. */}
        <ol className="home-flow-only mt-10 flex w-full max-w-[1100px] flex-col gap-12 px-6">
          {MODULES.map((mod) => (
            <li
              key={mod.step}
              className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12"
            >
              <div>
                <p
                  className="text-[12px] font-semibold uppercase tracking-widest text-[#e91e63]"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  {mod.step}
                </p>
                <h3
                  className="mt-2 text-[32px] leading-[1.15] tracking-[-1px] lg:text-[40px]"
                  style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400 }}
                >
                  {/* The padding keeps the italic overhang inside the clipped gradient. */}
                  <span
                    className="bg-clip-text pr-[0.1em] font-semibold italic text-transparent"
                    style={{ backgroundImage: GRAD }}
                  >
                    {mod.title.split(" ")[0]}
                  </span>{" "}
                  <span className="text-[#1d1d1d]">
                    {mod.title.split(" ").slice(1).join(" ")}
                  </span>
                </h3>
                <p
                  className="mt-3 max-w-[474px] text-[16px] font-medium leading-[1.55] text-[#555]"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  {mod.desc}
                </p>
                <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:gap-14">
                  {mod.features.map((feat, fi) => (
                    <div key={fi} className="flex flex-col gap-1.5">
                      <span
                        className="bg-clip-text text-[26px] font-bold text-transparent lg:text-[30px]"
                        style={{ fontFamily: "'Montserrat', sans-serif", backgroundImage: GRAD }}
                      >
                        {feat.num}
                      </span>
                      <span
                        className="whitespace-pre-line text-[14px] font-medium leading-[1.5] text-[#666]"
                        style={{ fontFamily: "'Montserrat', sans-serif" }}
                      >
                        {feat.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="overflow-hidden rounded-[28px] border border-[#e91e63]/20 bg-white p-2 shadow-2xl">
                <div className="h-[3px] w-full rounded-full" style={{ background: GRAD }} />
                <div className="relative mt-2 aspect-[23/16] w-full overflow-hidden rounded-[20px]">
                  <img
                    src={mod.img}
                    loading="lazy"
                    decoding="async"
                    alt={mod.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
