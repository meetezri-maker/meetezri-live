import { LandingGlowCard, type LandingGlowVariant } from "@/app/landing/LandingGlowCard";
import { RECOGNITION, SECTION_IDS } from "../prelaunch.content";
import { PRELAUNCH_RECOGNITION_BG } from "../prelaunch.imagery";
import { Reveal, SectionBackdrop, SectionHeader } from "../PrelaunchPrimitives";

/**
 * Section 2 — You're Not the Only One.
 *
 * Recognition, not conversion: there is deliberately no CTA here. Cards use a
 * uniform grid with `h-full` so every card matches height regardless of copy.
 */
export function RecognitionSection() {
  return (
    <section
      id={SECTION_IDS.recognition}
      aria-labelledby="prelaunch-recognition-heading"
      className="relative overflow-hidden py-20 md:py-28"
    >
      <SectionBackdrop
        src={PRELAUNCH_RECOGNITION_BG}
        overlayClassName="bg-[linear-gradient(180deg,rgba(5,8,22,0.93)_0%,rgba(5,8,22,0.95)_50%,rgba(5,8,22,0.97)_100%)]"
      />

      <div className="landing-section relative z-10">
        <SectionHeader
          badge={RECOGNITION.badge}
          heading={RECOGNITION.heading}
          supportingCopy={RECOGNITION.supportingCopy}
          headingId="prelaunch-recognition-heading"
        />

        <ul className="mt-14 grid list-none grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {RECOGNITION.cards.map((card, index) => (
            <Reveal
              as="li"
              key={card.title}
              // 80–100ms stagger, reset per row so later cards don't lag noticeably.
              delay={(index % 3) * 0.09}
              className="flex"
            >
              <LandingGlowCard
                glow={card.glow as LandingGlowVariant}
                className="flex h-full w-full flex-col gap-3 p-6"
              >
                <span className="text-2xl" aria-hidden>
                  {card.emoji}
                </span>
                <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                <p className="text-[15px] leading-relaxed text-[var(--solace-ds-text-muted)]">
                  {card.description}
                </p>
              </LandingGlowCard>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={0.25} className="mt-14">
          <div className="mx-auto max-w-2xl space-y-1.5 text-center">
            {RECOGNITION.transition.map((line) => (
              <p
                key={line}
                className="landing-serif text-lg leading-snug text-white/90 sm:text-xl md:text-2xl"
              >
                {line}
              </p>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
