import { useState, useRef } from "react";
import { motion, AnimatePresence, useInView } from "motion/react";
import { useHomeReducedMotion } from "../useHomeReducedMotion";
import svgPaths from "../svg/arrowPaths";
import { useHasMounted } from "../useHasMounted";
import { Link } from "react-router";
import MotionLink from "./MotionLink";
import { EARLY_ACCESS_PATH, trackEarlyAccessClick } from "../homeActions";
import { FAQ as APPROVED_FAQ, type FaqItem } from "@/app/features/prelaunch/prelaunch.content";
import { SUBSCRIPTION_PLANS } from "@/app/utils/subscriptionPlans";

const GRAD = "linear-gradient(135deg, #e91e63 8%, #9c27b0 92%)";
const EASE = [0.22, 1, 0.36, 1] as const;

/*
 * Answers are the approved FAQ copy shared with the Founding Circle page, so the two
 * cannot drift apart. Two homepage-specific adjustments:
 *  - "How do I get started?" describes this page's two real paths (the free trial and the
 *    Founding Circle) instead of the Founding-Circle-only answer.
 *  - The immediate-help link points at the public Safety page, which carries the
 *    emergency guidance.
 */
const FAQS: FaqItem[] = APPROVED_FAQ.items.map((item) => {
  if (item.id === "how-do-i-get-started") {
    return {
      ...item,
      answer: [
        `Choose a membership in the pricing section above. The Free Trial includes ${SUBSCRIPTION_PLANS.trial.credits} Talk It Out minutes, with no credit card required.`,
        "You can also reserve your place in our Founding Circle for early-member benefits and launch updates.",
      ],
      link: { label: "Join the Founding Circle", to: EARLY_ACCESS_PATH },
    };
  }
  if (item.id === "what-if-i-need-immediate-help") {
    return { ...item, link: { label: "Safety & crisis resources", to: "/safety" } };
  }
  return item;
});

function CurvedArrow({ animate }: { animate: boolean }) {
  // Decorative and path-heavy: kept out of the prerendered HTML (see useHasMounted).
  if (!useHasMounted()) return null;
  return (
    <svg aria-hidden
      viewBox="0 0 192.752 28.0938"
      fill="none"
      className="h-[24px] w-[165px]"
    >
      <motion.path
        d={svgPaths.p2b5e9b00}
        stroke="url(#faq_arrow_line)"
        strokeLinecap="round"
        strokeWidth="2.92366"
        pathLength={1}
        initial={{ pathLength: 0 }}
        animate={animate ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
      />
      <motion.path
        d={svgPaths.p3bf54f80}
        fill="url(#faq_arrow_head)"
        initial={{ opacity: 0, scale: 0.4 }}
        animate={
          animate ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }
        }
        transition={{ duration: 0.35, delay: 1.1, ease: EASE }}
        style={{ transformOrigin: "10px 14px" }}
      />
      <defs>
        <linearGradient
          id="faq_arrow_head"
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
          id="faq_arrow_line"
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
    </svg>
  );
}

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useHomeReducedMotion();
  const inView = useInView(sectionRef, { once: true, margin: "-15% 0px" });

  const toggleAccordion = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section
      ref={sectionRef}
      id="faq"
      className="relative bg-white py-20 md:py-24 px-6 overflow-hidden scroll-mt-20"
    >
      <div className="mx-auto max-w-[760px] flex flex-col items-center">
        {/* Eyebrow Badge */}
        <motion.span
          className="rounded-[12px] border border-[#e91e63] px-3.5 py-[5px] text-[11px] font-semibold uppercase"
          style={{
            fontFamily: "'Montserrat', sans-serif",
            backgroundImage:
              "linear-gradient(131deg, rgba(233,30,99,0.12), rgba(156,39,176,0.12))",
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: GRAD }}
          >
            FAQs
          </span>
        </motion.span>

        {/* Heading strictly in 2 Lines */}
        <motion.h2
          className="mt-5 text-center text-[clamp(24px,3.5vw,42px)] leading-[1.22] tracking-[-1.2px] text-black w-full max-w-[820px]"
          style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400 }}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
        >
          <span className="block md:whitespace-nowrap">
            Questions? We've{" "}
            <span
              className="bg-clip-text font-semibold italic text-transparent"
              style={{ backgroundImage: GRAD }}
            >
              answered
            </span>{" "}
            the
          </span>
          <span className="block md:whitespace-nowrap">
            ones people ask most.
          </span>
        </motion.h2>

        {/* Accordion List */}
        <motion.div
          className="mt-9 w-full flex flex-col gap-3"
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
        >
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <motion.div
                key={faq.question}
                className="overflow-hidden rounded-[18px] border transition-all duration-300 backdrop-blur-[6px]"
                style={{
                  borderColor: isOpen
                    ? "rgba(233, 30, 99, 0.55)"
                    : "rgba(233, 30, 99, 0.22)",
                  backgroundImage: isOpen
                    ? "linear-gradient(168deg, rgba(233, 30, 99, 0.04) 8%, rgba(156, 39, 176, 0.04) 92%)"
                    : "linear-gradient(168deg, rgba(233, 30, 99, 0.015) 8%, rgba(156, 39, 176, 0.015) 92%)",
                  boxShadow: isOpen
                    ? "0 8px 24px -8px rgba(233,30,99,0.12)"
                    : "none",
                }}
              >
                <h3>
                <button
                  type="button"
                  id={`faq-question-${faq.id}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${faq.id}`}
                  onClick={() => toggleAccordion(index)}
                  className="flex w-full items-center justify-between px-5 py-3.5 text-left cursor-pointer transition-colors"
                >
                  <span
                    className="text-[15px] md:text-[16px] font-semibold text-[#1d1d1d]"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    {faq.question}
                  </span>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="ml-4 shrink-0 flex items-center justify-center w-5 h-5 text-[#1d1d1d]"
                  >
                    <svg aria-hidden width="13" height="13" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M4 6L8 10L12 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </motion.div>
                </button>
                </h3>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      id={`faq-answer-${faq.id}`}
                      role="region"
                      aria-labelledby={`faq-question-${faq.id}`}
                      initial={
                        reduce ? { opacity: 1 } : { height: 0, opacity: 0 }
                      }
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                    >
                      <div
                        className="flex flex-col gap-2 px-5 pb-4 pt-0.5 text-[13.5px] leading-[1.6] text-[#555]"
                        style={{
                          fontFamily: "'Montserrat', sans-serif",
                          fontWeight: 500,
                        }}
                      >
                        {faq.answer.map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                        {faq.link && (
                          <Link
                            to={faq.link.to}
                            className="w-fit font-semibold text-[#e91e63] underline-offset-2 hover:underline"
                          >
                            {faq.link.label}
                          </Link>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Bottom Quote Block */}
        <motion.div
          className="mt-12 max-w-[620px] text-center relative px-8"
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.35, ease: EASE }}
        >
          <span
            className="absolute left-0 top-0 -translate-y-4 bg-clip-text text-[38px] font-bold leading-none text-transparent select-none"
            style={{ backgroundImage: GRAD }}
          >
            &ldquo;
          </span>
          <p
            className="text-[clamp(16px,1.9vw,20px)] leading-[1.4] text-[#222]"
            style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}
          >
            Every conversation brings you closer to yourself.
          </p>
          <span
            className="absolute right-0 bottom-0 translate-y-2 bg-clip-text text-[38px] font-bold leading-none text-transparent select-none"
            style={{ backgroundImage: GRAD }}
          >
            &rdquo;
          </span>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          className="mt-7 flex items-center gap-4"
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.45, ease: EASE }}
        >
          <MotionLink
            to={EARLY_ACCESS_PATH}
            onClick={() => trackEarlyAccessClick("home_faq")}
            className="inline-flex items-center whitespace-nowrap rounded-[14px] bg-gradient-to-br from-[#e91e63] to-[#9c27b0] px-7 py-3 text-[13.5px] tracking-[0.28px] text-white shadow-[0px_8px_16px_rgba(233,30,99,0.34)] font-bold"
            style={{ fontFamily: "'Inter', sans-serif" }}
            whileHover={{ y: -2 }}
          >
            Become a Founding Member
          </MotionLink>
          <div className="hidden translate-y-[-4px] sm:block">
            <CurvedArrow animate={inView} />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
