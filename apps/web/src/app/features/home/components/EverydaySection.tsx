import { useRef } from "react";
import { motion, useInView, type Variants } from "motion/react";
import { useHomeReducedMotion } from "../useHomeReducedMotion";
import svgPaths from "../svg/arrowPaths";
import { useHasMounted } from "../useHasMounted";
import SolaceEmblem from "./SolaceEmblem";
import { scrollToSection } from "../scroll";

const EASE = [0.22, 1, 0.36, 1] as const;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

function Sparkle() {
  return (
    <motion.div
      className="mb-4 h-[37px] w-[37px]"
      variants={{
        hidden: { opacity: 0, scale: 0.3, rotate: -60 },
        show: {
          opacity: 1,
          scale: 1,
          rotate: 0,
          transition: { duration: 0.8, ease: EASE },
        },
      }}
    >
      <div className="flex h-full w-full rotate-[45.98deg] items-center justify-center">
        <svg aria-hidden
          viewBox="0 0 35.3771 36.6704"
          fill="none"
          className="h-[92%] w-[92%]"
        >
          <path
            d={svgPaths.peb644f0}
            fill="url(#sparkle_grad)"
            stroke="white"
            strokeWidth="0.795427"
          />
          <defs>
            <linearGradient
              id="sparkle_grad"
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
    </motion.div>
  );
}

function CurvedArrow({ animate }: { animate: boolean }) {
  // Decorative and path-heavy: kept out of the prerendered HTML (see useHasMounted).
  if (!useHasMounted()) return null;
  return (
    <motion.svg aria-hidden
      viewBox="0 0 192.752 28.0938"
      fill="none"
      className="h-[28px] w-[193px]"
      animate={animate ? { x: [0, 5, 0] } : {}}
      transition={{
        duration: 1.4,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 1.2,
      }}
    >
      <motion.path
        d={svgPaths.p2b5e9b00}
        stroke="url(#arrow_line)"
        strokeLinecap="round"
        strokeWidth="2.92366"
        pathLength={1}
        initial={{ pathLength: 0 }}
        animate={animate ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
      />
      <motion.path
        d={svgPaths.p3bf54f80}
        fill="url(#arrow_head)"
        initial={{ opacity: 0, scale: 0.4 }}
        animate={
          animate ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }
        }
        transition={{ duration: 0.35, delay: 1.1, ease: EASE }}
        style={{ transformOrigin: "10px 14px" }}
      />
      <defs>
        <linearGradient
          id="arrow_head"
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
          id="arrow_line"
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

export default function EverydaySection() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useHomeReducedMotion();
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const state = reduce ? "show" : inView ? "show" : "hidden";

  return (
    <section
      ref={ref}
      id="companions"
      className="relative bg-white py-20 md:py-24 overflow-hidden scroll-mt-20"
    >
      {/* Decorative floating Solace Logo Emblem */}
      <div className="absolute right-[-20px] md:right-[3%] top-[12%] pointer-events-none z-0 hidden sm:block opacity-70">
        <SolaceEmblem size={135} tilt={14} />
      </div>

      <motion.div
        className="mx-auto grid max-w-[1360px] grid-cols-1 items-start gap-16 px-6 lg:grid-cols-[minmax(0,1fr)_384px] lg:gap-24 relative z-10"
        variants={container}
        initial="hidden"
        animate={state}
      >
        {/* Heading */}
        <div className="max-w-[760px]">
          <Sparkle />
          <h2
            className="text-[clamp(36px,4.6vw,58px)] leading-[1.06] tracking-[-1.3px] text-black"
            style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400 }}
          >
            <motion.span className="block overflow-hidden">
              <motion.span className="block" variants={rise}>
                Because life isn't just about{" "}
              </motion.span>
            </motion.span>
            <motion.span className="block overflow-hidden">
              <motion.span className="block" variants={rise}>
                <span className="whitespace-nowrap">
                  <span
                    className="bg-clip-text text-transparent"
                    style={{
                      fontWeight: 600,
                      backgroundImage:
                        "linear-gradient(146deg, rgb(233,30,99) 8.49%, rgb(156,39,176) 91.51%)",
                    }}
                  >
                    getting
                  </span>{" "}
                  through
                </span>
              </motion.span>
            </motion.span>
            <motion.span className="block overflow-hidden">
              <motion.span className="block" variants={rise}>
                hard days.
              </motion.span>
            </motion.span>
          </h2>
          <motion.div
            className="mt-6 h-[5px] rounded-full bg-gradient-to-r from-[#e91e63] to-[#9c27b0]"
            variants={{
              hidden: { width: 0, opacity: 0 },
              show: {
                width: 57,
                opacity: 1,
                transition: { duration: 0.6, delay: 0.3, ease: EASE },
              },
            }}
          />
        </div>

        {/* Right block */}
        <div className="w-full max-w-[384px]">
          <motion.p
            className="text-[19.85px] leading-[26.25px] text-black"
            style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}
            variants={rise}
          >
            Some conversations help you process. Others help you celebrate,
            reflect, dream, and grow.
          </motion.p>

          <div className="mt-7 flex items-center gap-4">
            <motion.a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection("features");
              }}
              className="inline-flex items-center whitespace-nowrap rounded-[14px] bg-gradient-to-br from-[#e91e63] to-[#9c27b0] px-8 py-[14px] text-[14px] tracking-[0.28px] text-white shadow-[0px_8px_16px_rgba(233,30,99,0.34)] cursor-pointer"
              style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700 }}
              variants={{
                hidden: { opacity: 0, y: 20, scale: 0.95 },
                show: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { duration: 0.6, ease: EASE },
                },
              }}
              whileHover={{ y: -2 }}
            >
              Meet Your Companion
            </motion.a>
            <div className="hidden translate-y-[-6px] sm:block">
              <CurvedArrow animate={state === "show"} />
            </div>
          </div>

          <motion.p
            className="mt-4 text-[12px] leading-[18px] text-black"
            style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}
            variants={rise}
          >
            No credit card required. Start talking in minutes.
          </motion.p>
        </div>
      </motion.div>
    </section>
  );
}
