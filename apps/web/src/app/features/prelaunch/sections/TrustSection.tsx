import { Link } from "react-router-dom";
import { LandingGlowCard, type LandingGlowVariant } from "@/app/landing/LandingGlowCard";
import { cn } from "@/lib/utils";
import { SECTION_IDS, TRUST } from "../prelaunch.content";
import { PRELAUNCH_TRUST_BG } from "../prelaunch.imagery";
import {
  FoundingMemberCta,
  Reveal,
  SectionBackdrop,
  SectionHeader,
} from "../PrelaunchPrimitives";
import { useFoundingMemberSignup } from "../FoundingMemberSignupContext";

/**
 * Section 7 — Trust, Privacy & Safety. Copy from Appendix A, Page 6.
 *
 * Blueprint 8.3 — trust is communicated through calm typography and spacing
 * rather than security iconography: no padlocks, shields, medical symbols, or
 * certification badges, which would imply guarantees the product does not make.
 * The section therefore carries no imagery at all.
 *
 * The three pillars appear in Appendix A order. Nothing here states an
 * encryption, certification, compliance, clinical, or crisis-response
 * capability, and nothing implies SOLACE replaces therapy or emergency care.
 *
 * The legal destinations are unchanged from the previous implementation.
 */

/** Shared focus treatment for the legal links. Never suppresses the outline
 *  without replacing it with an equally visible indicator. */
const legalLinkClass = cn(
  "rounded-sm text-violet-300 underline underline-offset-4 transition-colors",
  "hover:text-violet-200",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
  "focus-visible:ring-offset-2 focus-visible:ring-offset-[#050816]",
);

export function TrustSection() {
  const { openSignup } = useFoundingMemberSignup();

  return (
    <section
      id={SECTION_IDS.trust}
      aria-labelledby="prelaunch-trust-heading"
      className="relative overflow-hidden py-20 md:py-10"
    >
      <SectionBackdrop src={PRELAUNCH_TRUST_BG} />

      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,28,0.6)_0%,rgba(5,8,22,0.85)_100%)]"
        aria-hidden
      />

      <div className="landing-section relative z-10">
        <SectionHeader
          badge={TRUST.badge}
          heading={TRUST.heading}
          supportingCopy={[TRUST.supportingLine]}
          headingId="prelaunch-trust-heading"
        />

        <ul className="mt-14 grid list-none grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
          {TRUST.pillars.map((pillar, index) => (
            <Reveal as="li" key={pillar.id} delay={index * 0.08} className="flex">
              <LandingGlowCard
                glow={pillar.glow as LandingGlowVariant}
                className="flex h-full w-full flex-col gap-3 p-7 sm:p-8"
              >
                <h3 className="landing-serif text-xl font-semibold text-white sm:text-[22px]">
                  {pillar.title}
                </h3>
                <p className="text-[15px] text-[var(--solace-ds-text-muted)]">
                  {pillar.description}
                </p>
              </LandingGlowCard>
            </Reveal>
          ))}
        </ul>

        {/* Transition, then the invitation and the legal destinations. */}
        <Reveal delay={0.14} className="mt-14 md:mt-16">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <p className="landing-serif text-xl text-white sm:text-2xl md:text-[28px]">
              {TRUST.transition}
            </p>

            {/* No supporting line: Appendix A supplies none for this CTA, and
                there is no existing line to retain, so nothing is written. */}
            <div className="mt-8 flex w-full flex-col items-center">
              <FoundingMemberCta onClick={() => openSignup("trust")} />
            </div>

            <nav
              aria-label="Privacy, terms, and safety"
              className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm"
            >
              {TRUST.links.map((link) => (
                <Link key={link.to} to={link.to} className={legalLinkClass}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
