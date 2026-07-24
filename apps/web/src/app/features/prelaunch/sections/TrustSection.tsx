import { Link } from "react-router-dom";
import { Check, X } from "lucide-react";
import { LandingGlowCard, type LandingGlowVariant } from "@/app/landing/LandingGlowCard";
import { SECTION_IDS, TRUST } from "../prelaunch.content";
import { Reveal, SectionHeader } from "../PrelaunchPrimitives";

/**
 * Section 9 — Privacy, Safety & Trust.
 *
 * Reassurance in plain language, with links out to the full legal and safety
 * pages. No CTA — trust leads naturally into the FAQ.
 */
export function TrustSection() {
  return (
    <section
      id={SECTION_IDS.trust}
      aria-labelledby="prelaunch-trust-heading"
      className="relative overflow-hidden py-20 md:py-28"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,28,0.6)_0%,rgba(5,8,22,0.85)_100%)]"
        aria-hidden
      />

      <div className="landing-section relative z-10">
        <SectionHeader
          badge={TRUST.badge}
          heading={TRUST.heading}
          supportingCopy={TRUST.supportingCopy}
          headingId="prelaunch-trust-heading"
        />

        <ul className="mt-14 grid list-none grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TRUST.cards.map((card, index) => (
            <Reveal as="li" key={card.title} delay={(index % 3) * 0.08} className="flex">
              <LandingGlowCard
                glow={card.glow as LandingGlowVariant}
                className="flex h-full w-full flex-col gap-3 p-6"
              >
                <span className="text-2xl" aria-hidden>
                  {card.emoji}
                </span>
                <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                <div className="space-y-1.5 text-[15px] leading-relaxed text-[var(--solace-ds-text-muted)]">
                  {card.copy.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </LandingGlowCard>
            </Reveal>
          ))}
        </ul>

        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Reveal className="flex">
            <LandingGlowCard glow="green" className="flex h-full w-full flex-col p-7 sm:p-8">
              <h3 className="text-lg font-semibold text-white">{TRUST.isHeading}</h3>
              <ul className="mt-5 list-none space-y-3">
                {TRUST.is.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] text-white/85">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </LandingGlowCard>
          </Reveal>

          <Reveal delay={0.08} className="flex">
            <LandingGlowCard glow="blue" className="flex h-full w-full flex-col p-7 sm:p-8">
              <h3 className="text-lg font-semibold text-white">{TRUST.isntHeading}</h3>
              <ul className="mt-5 list-none space-y-3">
                {TRUST.isnt.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] text-white/85">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-300/90" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </LandingGlowCard>
          </Reveal>
        </div>

        <Reveal delay={0.14} className="mt-14">
          <div className="mx-auto max-w-2xl text-center">
            <p className="landing-serif text-xl leading-snug text-white sm:text-2xl">
              {TRUST.finalReassurance}
            </p>
            <div className="mt-4 space-y-1.5 text-[15px] leading-relaxed text-[var(--solace-ds-text-muted)]">
              {TRUST.finalReassuranceSupporting.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>

            <nav
              aria-label="Privacy, terms, and safety"
              className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm"
            >
              <Link
                to="/privacy"
                className="text-violet-300 underline underline-offset-4 hover:text-violet-200"
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="text-violet-300 underline underline-offset-4 hover:text-violet-200"
              >
                Terms of Service
              </Link>
              <Link
                to="/privacy#safety"
                className="text-violet-300 underline underline-offset-4 hover:text-violet-200"
              >
                Safety Information
              </Link>
            </nav>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
