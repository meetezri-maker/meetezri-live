import { useState } from "react";
import { LandingGlowCard, type LandingGlowVariant } from "@/app/landing/LandingGlowCard";
import { EXPERIENCE, SECTION_IDS } from "../prelaunch.content";
import type { ProductScreenId } from "../prelaunch.imagery";
import {
  CtaSupportingText,
  FoundingMemberCta,
  Reveal,
  SectionHeader,
} from "../PrelaunchPrimitives";
import { ProductPreviewCarousel } from "../ProductPreviewCarousel";
import { useFoundingMemberSignup } from "../FoundingMemberSignupContext";

/**
 * Section 5 — More Than a Conversation.
 *
 * Bento grid: one large featured Talk It Out card plus eight supporting
 * experiences, then the full approved screenshot sequence below. Hovering a card
 * highlights the matching screen in the showcase.
 */
export function SolaceExperienceSection() {
  const { openSignup } = useFoundingMemberSignup();
  const [activeScreenId, setActiveScreenId] = useState<ProductScreenId | null>(null);

  return (
    <section
      id={SECTION_IDS.experience}
      aria-labelledby="prelaunch-experience-heading"
      className="relative overflow-hidden py-20 md:py-28"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_10%,rgba(88,28,135,0.16)_0%,transparent_60%)]"
        aria-hidden
      />

      <div className="landing-section relative z-10">
        <SectionHeader
          badge={EXPERIENCE.badge}
          heading={EXPERIENCE.heading}
          supportingCopy={EXPERIENCE.supportingCopy}
          headingId="prelaunch-experience-heading"
        />

        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Reveal className="flex lg:col-span-2 lg:row-span-2">
            <LandingGlowCard
              glow="purple"
              className="flex h-full w-full flex-col gap-5 p-7 sm:p-9"
              onMouseEnter={() => setActiveScreenId(EXPERIENCE.featured.previewId as ProductScreenId)}
              onMouseLeave={() => setActiveScreenId(null)}
            >
              <p className="flex items-center gap-2.5 text-sm font-semibold uppercase tracking-[0.14em] text-violet-200/80">
                <span className="text-xl" aria-hidden>
                  {EXPERIENCE.featured.emoji}
                </span>
                {EXPERIENCE.featured.name}
              </p>

              <h3 className="landing-serif text-2xl font-semibold leading-snug text-white sm:text-3xl">
                {EXPERIENCE.featured.title}
              </h3>

              <div className="space-y-2.5 text-[15px] leading-[1.75] text-[var(--solace-ds-text-muted)]">
                {EXPERIENCE.featured.copy.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>

              <div className="mt-auto pt-4">
                <ProductPreviewCarousel
                  label="Talk It Out preview"
                  screenIds={["talk-it-out"]}
                  showCaption={false}
                />
              </div>
            </LandingGlowCard>
          </Reveal>

          {EXPERIENCE.cards.map((card, index) => (
            <Reveal key={card.name} delay={0.05 + (index % 3) * 0.06} className="flex">
              <LandingGlowCard
                glow={card.glow as LandingGlowVariant}
                className="flex h-full w-full flex-col gap-2.5 p-6"
                onMouseEnter={() => setActiveScreenId(card.previewId as ProductScreenId)}
                onMouseLeave={() => setActiveScreenId(null)}
              >
                <p className="flex items-center gap-2 text-sm font-semibold text-white/85">
                  <span className="text-lg" aria-hidden>
                    {card.emoji}
                  </span>
                  {card.name}
                </p>
                <h3 className="text-base font-semibold leading-snug text-white">{card.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--solace-ds-text-muted)]">
                  {card.description}
                </p>
              </LandingGlowCard>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1} className="mt-16">
          <div className="mx-auto max-w-4xl">
            <h3 className="mb-6 text-center text-sm font-semibold uppercase tracking-[0.16em] text-white/55">
              Inside Solace
            </h3>
            <ProductPreviewCarousel label="Solace product showcase" activeScreenId={activeScreenId} />
          </div>
        </Reveal>

        <Reveal delay={0.1} className="mt-16">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <p className="landing-serif text-xl leading-snug text-white sm:text-2xl md:text-[28px]">
              {EXPERIENCE.closingStatement}
            </p>
            <div className="mt-3 space-y-1 text-[15px] leading-relaxed text-[var(--solace-ds-text-muted)]">
              {EXPERIENCE.closingSupportingCopy.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>

            <div className="mt-8 flex w-full flex-col items-center">
              <FoundingMemberCta onClick={() => openSignup("experience")} />
              <CtaSupportingText>{EXPERIENCE.ctaSupportingText}</CtaSupportingText>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
