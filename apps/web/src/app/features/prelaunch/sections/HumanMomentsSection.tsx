import { LandingGlowCard, type LandingGlowVariant } from "@/app/landing/LandingGlowCard";
import { cn } from "@/lib/utils";
import { HUMAN_MOMENTS, SECTION_IDS } from "../prelaunch.content";
import {
  PRELAUNCH_HUMAN_MOMENTS_BG,
  PRELAUNCH_MOMENT_IMAGES,
} from "../prelaunch.imagery";
import { scrollToPrelaunchSection } from "../prelaunch.scroll";
import {
  CtaSupportingText,
  FoundingMemberCta,
  Reveal,
  SectionBackdrop,
  SectionHeader,
} from "../PrelaunchPrimitives";
import { useFoundingMemberSignup } from "../FoundingMemberSignupContext";

/**
 * Section 2 — Human Moments.
 *
 * Consolidates the former Recognition and Everyday Moments sections into the
 * single approved chapter. Copy is Appendix A, Page 2.
 *
 * Blueprint 5.2 — a spacious vertical flow: introduction, the four moments,
 * reflection, then the invitation. Information hierarchy is preserved in DOM
 * order.
 *
 * Blueprint 5.5 — cards reveal sequentially rather than together, using opacity
 * and position only; hover elevation and glow come from the existing
 * `.landing-glass` treatment rather than a new one. Blueprint 5.6 — every
 * moment keeps its title, imagery, and narrative at all breakpoints, the order
 * never changes, and nothing collapses into a carousel.
 *
 * The single call to action preserves the existing Founding Circle conversion
 * and its `everyday_moments` analytics origin.
 */
export function HumanMomentsSection() {
  const { openSignup } = useFoundingMemberSignup();

  return (
    <section
      id={SECTION_IDS.humanMoments}
      aria-labelledby="prelaunch-human-moments-heading"
      className="relative overflow-hidden py-20 md:py-28"
    >
      <SectionBackdrop src={PRELAUNCH_HUMAN_MOMENTS_BG} />

      <div className="landing-section relative z-10">
        <SectionHeader
          badge={HUMAN_MOMENTS.badge}
          heading={HUMAN_MOMENTS.heading}
          supportingCopy={[HUMAN_MOMENTS.supportingLine]}
          headingId="prelaunch-human-moments-heading"
        />

        {/* Four peer moments. Nothing here is interactive, so nothing offers an
            affordance it cannot honour. */}
        <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:gap-8">
          {HUMAN_MOMENTS.moments.map((moment, index) => (
            <Reveal as="li" key={moment.id} delay={index * 0.08} className="flex">
              <LandingGlowCard
                glow={moment.glow as LandingGlowVariant}
                className="flex h-full w-full flex-col overflow-hidden"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden">
                  <img
                    src={PRELAUNCH_MOMENT_IMAGES[moment.id]}
                    // Decorative: the title and narrative below carry the meaning.
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={1920}
                    height={1200}
                    className="h-full w-full object-cover"
                  />
                  <div
                    className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,22,0.2)_0%,rgba(5,8,22,0.55)_100%)]"
                    aria-hidden
                  />
                </div>

                <div className="flex flex-1 flex-col gap-2 p-6 sm:p-7">
                  <h3 className="landing-serif text-xl font-semibold text-white sm:text-[22px]">
                    {moment.title}
                  </h3>
                  <p className="text-[15px] text-[var(--solace-ds-text-muted)]">
                    {moment.narrative}
                  </p>
                </div>
              </LandingGlowCard>
            </Reveal>
          ))}
        </ul>

        {/* Reflection, then the invitation to join. */}
        <Reveal delay={0.1} className="mt-16">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <p className="landing-serif text-xl text-white sm:text-2xl md:text-[28px]">
              {HUMAN_MOMENTS.transition}
            </p>

            <div className="mt-8 flex w-full flex-col items-center">
              <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:justify-center">
                <FoundingMemberCta onClick={() => openSignup("everyday_moments")} />

                {/*
                  Appendix A: "(Scrolls to the Talk It Out section.)" Navigational
                  only — it never opens the signup flow. A button rather than a
                  bare anchor so reduced-motion scrolling and focus transfer match
                  the page navigation exactly.
                */}
                <button
                  type="button"
                  onClick={() => scrollToPrelaunchSection(SECTION_IDS.talkItOut)}
                  className={cn(
                    "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20",
                    "bg-black/25 px-8 py-4 text-base font-semibold text-white/90 backdrop-blur-sm",
                    "transition-[box-shadow,border-color] hover:border-white/35",
                    "hover:shadow-[0_0_28px_-8px_rgba(168,85,247,0.45)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:w-auto",
                  )}
                >
                  {HUMAN_MOMENTS.secondaryCta}
                </button>
              </div>
              <CtaSupportingText>{HUMAN_MOMENTS.ctaSupportingText}</CtaSupportingText>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
