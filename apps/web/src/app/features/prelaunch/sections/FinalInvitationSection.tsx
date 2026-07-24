import { Link } from "react-router-dom";
import { FINAL_INVITATION, SECTION_IDS } from "../prelaunch.content";
import { PRELAUNCH_FINAL_BG } from "../prelaunch.imagery";
import {
  CtaSupportingText,
  FoundingMemberCta,
  Reveal,
  SectionBackdrop,
  SectionBadge,
} from "../PrelaunchPrimitives";
import { useFoundingMemberSignup } from "../FoundingMemberSignupContext";

/**
 * Section 11 — Your Journey Starts Here.
 *
 * Closes the loop by repeating the brand promise. One message, one action:
 * no countdowns, no scarcity banners, no statistics, no competing CTAs.
 */
export function FinalInvitationSection() {
  const { openSignup } = useFoundingMemberSignup();

  function scrollToSection(targetId: string) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
  }

  return (
    <section
      id={SECTION_IDS.finalInvitation}
      aria-labelledby="prelaunch-final-heading"
      className="relative flex min-h-[100svh] items-center overflow-hidden py-24 md:py-32"
    >
      {/* Brightest environment on the page — a new beginning. */}
      <SectionBackdrop
        src={PRELAUNCH_FINAL_BG}
        overlayClassName="bg-[linear-gradient(180deg,rgba(5,8,22,0.72)_0%,rgba(7,8,24,0.8)_55%,rgba(5,8,22,0.9)_100%)]"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_40%,rgba(251,191,36,0.14)_0%,transparent_60%)]"
        aria-hidden
      />

      <div className="landing-section relative z-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Reveal>
            <SectionBadge>{FINAL_INVITATION.badge}</SectionBadge>
          </Reveal>

          <Reveal delay={0.08}>
            <h2
              id="prelaunch-final-heading"
              className="landing-serif mt-6 text-[30px] font-semibold leading-[1.12] text-white sm:text-5xl md:text-[56px]"
            >
              {FINAL_INVITATION.heading}
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <div className="mt-8 space-y-2.5 text-[15px] leading-[1.8] text-white/82 sm:text-base">
              {FINAL_INVITATION.supportingCopy.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.24}>
            <p className="landing-serif mt-10 text-xl leading-snug text-white sm:text-2xl md:text-[28px]">
              {FINAL_INVITATION.closingInvitation}
            </p>
          </Reveal>

          <Reveal delay={0.3} className="mt-8 w-full">
            <div className="flex flex-col items-center">
              <FoundingMemberCta onClick={() => openSignup("final_invitation")} size="xl" />
              <CtaSupportingText>{FINAL_INVITATION.ctaSupportingText}</CtaSupportingText>
            </div>
          </Reveal>

          <Reveal delay={0.36}>
            <nav
              aria-label="More about Solace"
              className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/55"
            >
              {FINAL_INVITATION.secondaryLinks.map((link) =>
                link.href ? (
                  link.href.startsWith("mailto:") ? (
                    <a
                      key={link.label}
                      href={link.href}
                      className="underline underline-offset-4 transition-colors hover:text-white/85"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.label}
                      to={link.href}
                      className="underline underline-offset-4 transition-colors hover:text-white/85"
                    >
                      {link.label}
                    </Link>
                  )
                ) : (
                  <button
                    key={link.label}
                    type="button"
                    onClick={() => link.targetId && scrollToSection(link.targetId)}
                    className="underline underline-offset-4 transition-colors hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  >
                    {link.label}
                  </button>
                ),
              )}
            </nav>
          </Reveal>

          <Reveal delay={0.42}>
            <div className="mt-10 space-y-1 text-xs leading-relaxed text-white/45 sm:text-sm">
              {FINAL_INVITATION.closingLine.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
