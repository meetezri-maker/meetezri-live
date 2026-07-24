import { useState } from "react";
import { LandingGlowCard, type LandingGlowVariant } from "@/app/landing/LandingGlowCard";
import { MEET_SOLACE, SECTION_IDS } from "../prelaunch.content";
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
 * Section 3 — Meet Solace.
 *
 * Two columns on desktop; on mobile the device preview comes first (as the
 * document specifies) via flex ordering. Hovering a benefit card highlights the
 * related screen in the preview — an enhancement only, since every card also
 * states its own meaning in text.
 */
export function MeetSolaceSection() {
  const { openSignup } = useFoundingMemberSignup();
  const [activeScreenId, setActiveScreenId] = useState<ProductScreenId | null>(null);

  return (
    <section
      id={SECTION_IDS.meetSolace}
      aria-labelledby="prelaunch-meet-solace-heading"
      className="relative overflow-hidden py-20 md:py-28"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(88,28,135,0.18)_0%,transparent_60%)]"
        aria-hidden
      />

      <div className="landing-section relative z-10">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
          {/* Preview first on mobile, second column on desktop. */}
          <Reveal className="order-1 lg:order-2 lg:sticky lg:top-24">
            <ProductPreviewCarousel
              label="Solace product preview"
              activeScreenId={activeScreenId}
              screenIds={[
                "dashboard",
                "talk-it-out",
                "journal",
                "mood",
                "progress",
                "goals",
                "sleep",
                "community",
              ]}
            />
          </Reveal>

          <div className="order-2 lg:order-1">
            <SectionHeader
              badge={MEET_SOLACE.badge}
              heading={MEET_SOLACE.heading}
              supportingCopy={MEET_SOLACE.supportingCopy}
              headingId="prelaunch-meet-solace-heading"
              align="left"
            />

            <div className="mt-10 space-y-7">
              {MEET_SOLACE.introductions.map((intro, index) => (
                <Reveal key={intro.title} delay={index * 0.06}>
                  <h3 className="text-lg font-semibold text-white sm:text-xl">{intro.title}</h3>
                  <div className="mt-2 space-y-2 text-[15px] leading-[1.75] text-[var(--solace-ds-text-muted)]">
                    {intro.copy.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>

        <ul className="mt-16 grid list-none grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MEET_SOLACE.benefits.map((benefit, index) => (
            <Reveal as="li" key={benefit.title} delay={(index % 3) * 0.07} className="flex">
              <LandingGlowCard
                glow={benefit.glow as LandingGlowVariant}
                className="flex h-full w-full items-start gap-4 p-5"
                onMouseEnter={() => setActiveScreenId(benefit.previewId as ProductScreenId)}
                onMouseLeave={() => setActiveScreenId(null)}
              >
                <span className="text-2xl leading-none" aria-hidden>
                  {benefit.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-white">{benefit.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--solace-ds-text-muted)]">
                    {benefit.description}
                  </p>
                </div>
              </LandingGlowCard>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={0.1} className="mt-14">
          <div className="flex flex-col items-center">
            <FoundingMemberCta onClick={() => openSignup("meet_solace")} />
            <CtaSupportingText>{MEET_SOLACE.ctaSupportingText}</CtaSupportingText>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
