import { PURPOSE, SECTION_IDS } from "../prelaunch.content";
import { PRELAUNCH_PURPOSE_BG } from "../prelaunch.imagery";
import { Reveal, SectionBackdrop, SectionBadge } from "../PrelaunchPrimitives";

/**
 * Section 6 — Why We Built Solace.
 *
 * The quietest section on the page: full-height, minimal interaction, and no
 * CTA by design. Nothing here should interrupt the visitor before the founder.
 */
export function PurposeSection() {
  return (
    <section
      id={SECTION_IDS.purpose}
      aria-labelledby="prelaunch-purpose-heading"
      className="relative flex min-h-[100svh] items-center overflow-hidden py-24 md:py-32"
    >
      <SectionBackdrop
        src={PRELAUNCH_PURPOSE_BG}
        overlayClassName="bg-[linear-gradient(180deg,rgba(5,8,22,0.88)_0%,rgba(5,8,22,0.9)_45%,rgba(5,8,22,0.95)_100%)]"
      />

      <div className="landing-section relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <SectionBadge>{PURPOSE.badge}</SectionBadge>
          </Reveal>

          <Reveal delay={0.08}>
            <h2
              id="prelaunch-purpose-heading"
              className="landing-serif mt-6 text-[28px] font-semibold leading-[1.15] text-white sm:text-4xl md:text-5xl"
            >
              {PURPOSE.heading}
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <div className="mt-8 space-y-2.5 text-[15px] leading-[1.85] text-white/72 sm:text-base">
              {PURPOSE.story.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.2} className="mt-16">
          <div className="mx-auto max-w-3xl border-y border-white/10 py-12 text-center">
            <p className="landing-serif text-2xl font-semibold leading-[1.2] text-white sm:text-4xl md:text-[44px]">
              {PURPOSE.missionStatement}
            </p>
          </div>
        </Reveal>

        <ul className="mx-auto mt-16 grid max-w-4xl list-none grid-cols-1 gap-8 sm:grid-cols-2">
          {PURPOSE.beliefs.map((belief, index) => (
            <Reveal as="li" key={belief.title} delay={index * 0.12}>
              <h3 className="flex items-center gap-2.5 text-lg font-semibold text-white">
                <span className="text-xl" aria-hidden>
                  {belief.emoji}
                </span>
                {belief.title}
              </h3>
              <div className="mt-2.5 space-y-1.5 text-[15px] leading-relaxed text-[var(--solace-ds-text-muted)]">
                {belief.copy.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={0.3} className="mt-16">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            {PURPOSE.closingReflection.map((line) => (
              <p key={line} className="landing-serif text-lg leading-snug text-white/90 sm:text-xl">
                {line}
              </p>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.38} className="mt-10">
          <p className="mx-auto max-w-xl text-center text-sm leading-relaxed text-white/50">
            {PURPOSE.transition}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
