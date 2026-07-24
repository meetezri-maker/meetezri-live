import { LandingGlowCard, type LandingGlowVariant } from "@/app/landing/LandingGlowCard";
import { cn } from "@/lib/utils";
import { EVERYDAY_MOMENTS, SECTION_IDS } from "../prelaunch.content";
import { PRELAUNCH_STORY_IMAGES } from "../prelaunch.imagery";
import {
  CtaSupportingText,
  FoundingMemberCta,
  Reveal,
  SectionHeader,
} from "../PrelaunchPrimitives";
import { useFoundingMemberSignup } from "../FoundingMemberSignupContext";

/**
 * Section 4 — Everyday Moments.
 *
 * Cinematic story cards, each a still frame from someone's life. Images
 * alternate sides on desktop and always sit above the copy on mobile at 16:9.
 */
export function EverydayMomentsSection() {
  const { openSignup } = useFoundingMemberSignup();

  return (
    <section
      id={SECTION_IDS.everydayMoments}
      aria-labelledby="prelaunch-everyday-heading"
      className="relative overflow-hidden py-20 md:py-28"
    >
      <div className="landing-section relative z-10">
        <SectionHeader
          badge={EVERYDAY_MOMENTS.badge}
          heading={EVERYDAY_MOMENTS.heading}
          supportingCopy={EVERYDAY_MOMENTS.supportingCopy}
          headingId="prelaunch-everyday-heading"
        />

        <div className="mt-14 flex flex-col gap-8 md:gap-10">
          {EVERYDAY_MOMENTS.stories.map((story, index) => {
            const imageOnRight = index % 2 === 1;

            return (
              <Reveal key={story.title}>
                <LandingGlowCard
                  glow={story.glow as LandingGlowVariant}
                  className="grid grid-cols-1 gap-0 lg:grid-cols-2"
                >
                  <div
                    className={cn(
                      "relative aspect-video w-full overflow-hidden",
                      imageOnRight ? "lg:order-2" : "lg:order-1",
                      "lg:aspect-auto lg:min-h-[22rem]",
                    )}
                  >
                    <img
                      src={PRELAUNCH_STORY_IMAGES[index]}
                      alt={story.imageAlt}
                      loading="lazy"
                      decoding="async"
                      width={1920}
                      height={1080}
                      className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out motion-safe:group-hover:scale-[1.03]"
                    />
                    <div
                      className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,22,0.25)_0%,rgba(5,8,22,0.55)_100%)]"
                      aria-hidden
                    />
                  </div>

                  <div
                    className={cn(
                      "flex flex-col justify-center gap-4 p-6 sm:p-8 lg:p-10",
                      imageOnRight ? "lg:order-1" : "lg:order-2",
                    )}
                  >
                    <p className="flex items-center gap-2 text-sm font-medium text-white/60">
                      <span className="text-lg" aria-hidden>
                        {story.emoji}
                      </span>
                      {story.label}
                    </p>

                    <h3 className="landing-serif text-xl font-semibold leading-snug text-white sm:text-2xl md:text-[26px]">
                      {story.title}
                    </h3>

                    <div className="space-y-2 text-[15px] leading-[1.75] text-[var(--solace-ds-text-muted)]">
                      {story.copy.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>

                    <div className="mt-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                        Perfect for
                      </p>
                      <ul className="mt-2.5 flex list-none flex-wrap gap-2">
                        {story.perfectFor.map((tag) => (
                          <li
                            key={tag}
                            className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/75"
                          >
                            {tag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </LandingGlowCard>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.1} className="mt-16">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <p className="landing-serif text-xl leading-snug text-white sm:text-2xl md:text-[28px]">
              {EVERYDAY_MOMENTS.closingStatement}
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--solace-ds-text-muted)]">
              {EVERYDAY_MOMENTS.closingSupportingCopy}
            </p>

            <div className="mt-8 flex w-full flex-col items-center">
              <FoundingMemberCta onClick={() => openSignup("everyday_moments")} />
              <CtaSupportingText>{EVERYDAY_MOMENTS.ctaSupportingText}</CtaSupportingText>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
