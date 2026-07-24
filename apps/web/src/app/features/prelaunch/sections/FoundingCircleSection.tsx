import { Check, Sparkles } from "lucide-react";
import { LandingGlowCard } from "@/app/landing/LandingGlowCard";
import { FOUNDING_CIRCLE, SECTION_IDS } from "../prelaunch.content";
import { PRELAUNCH_FOUNDING_CIRCLE_BG } from "../prelaunch.imagery";
import { Reveal, SectionBackdrop, SectionHeader } from "../PrelaunchPrimitives";
import { FoundingMemberForm } from "../FoundingMemberForm";

/**
 * Section 8 — Become a Founding Member.
 *
 * The primary conversion point, and the one place the signup form is inline.
 * This is an invitation, not a pricing page: no countdown, no scarcity, and no
 * community counter — a real number is not available, and one is never invented.
 */
export function FoundingCircleSection() {
  return (
    <section
      id={SECTION_IDS.foundingCircle}
      aria-labelledby="prelaunch-founding-circle-heading"
      className="relative overflow-hidden py-20 md:py-28"
    >
      {/* Warmest plate on the page — the sunrise after the calm night. */}
      <SectionBackdrop
        src={PRELAUNCH_FOUNDING_CIRCLE_BG}
        overlayClassName="bg-[linear-gradient(180deg,rgba(10,7,18,0.86)_0%,rgba(8,7,20,0.9)_50%,rgba(5,8,22,0.94)_100%)]"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_45%_at_50%_0%,rgba(251,191,36,0.14)_0%,transparent_58%)]"
        aria-hidden
      />

      <div className="landing-section relative z-10">
        <SectionHeader
          badge={FOUNDING_CIRCLE.badge}
          heading={FOUNDING_CIRCLE.heading}
          supportingCopy={FOUNDING_CIRCLE.supportingCopy}
          headingId="prelaunch-founding-circle-heading"
        />

        <Reveal delay={0.1} className="mt-14">
          <LandingGlowCard glow="popular" className="mx-auto max-w-3xl p-7 sm:p-10">
            <h3 className="flex items-center justify-center gap-2.5 text-lg font-semibold text-white sm:text-xl">
              <Sparkles className="landing-star-glow h-5 w-5 text-amber-300" aria-hidden />
              {FOUNDING_CIRCLE.cardTitle}
            </h3>

            <ul className="mt-8 grid list-none grid-cols-1 gap-5 sm:grid-cols-2">
              {FOUNDING_CIRCLE.benefits.map((benefit, index) => (
                <Reveal as="li" key={benefit.title} delay={index * 0.07}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                      <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[15px] font-semibold text-white">{benefit.title}</h4>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--solace-ds-text-muted)]">
                        {benefit.description}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ul>
          </LandingGlowCard>
        </Reveal>

        <Reveal delay={0.14} className="mt-14">
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/55">
              {FOUNDING_CIRCLE.invitationHeading}
            </h3>
            <div className="mt-4 space-y-2 text-[15px] leading-[1.8] text-white/80 sm:text-base">
              {FOUNDING_CIRCLE.invitation.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.18} className="mt-12">
          <LandingGlowCard glow="purple" className="mx-auto max-w-md p-7 sm:p-8">
            <FoundingMemberForm origin="founding_circle_section" />
          </LandingGlowCard>

          <div className="mx-auto mt-5 max-w-md space-y-1 text-center text-sm text-[var(--solace-ds-text-muted)]">
            {FOUNDING_CIRCLE.ctaSupportingText.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
