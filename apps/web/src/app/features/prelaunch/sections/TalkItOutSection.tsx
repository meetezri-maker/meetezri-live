import { Check, Video } from "lucide-react";
import { LandingGlowCard } from "@/app/landing/LandingGlowCard";
import { SECTION_IDS, TALK_IT_OUT } from "../prelaunch.content";
import {
  CtaSupportingText,
  FoundingMemberCta,
  Reveal,
  SectionHeader,
} from "../PrelaunchPrimitives";
import { useFoundingMemberSignup } from "../FoundingMemberSignupContext";

/**
 * Section 3 — Talk It Out.
 *
 * Consolidates the previous Meet Solace and More Than a Conversation sections.
 * Copy is Appendix A, Page 3.
 *
 * Blueprint 6.2 — Layout Composition: introduction, the conversation
 * experience, the benefits of talking, transition, then the invitation.
 * Blueprint 6.5 — nothing autoplays and no typing simulation appears.
 *
 * The 90-120 second product video does not exist yet, so the frame is a clearly
 * labelled placeholder at the correct ratio with no play control: an affordance
 * that opened nothing would be worse than none. When the asset arrives it drops
 * into this frame without a layout change.
 *
 * No conversation dialogue, screenshots, or interaction states are invented.
 */
export function TalkItOutSection() {
  const { openSignup } = useFoundingMemberSignup();

  return (
    <section
      id={SECTION_IDS.talkItOut}
      aria-labelledby="prelaunch-talk-it-out-heading"
      className="relative overflow-hidden py-20 md:py-28"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(88,28,135,0.18)_0%,transparent_60%)]"
        aria-hidden
      />

      <div className="landing-section relative z-10">
        <SectionHeader
          badge={TALK_IT_OUT.badge}
          heading={TALK_IT_OUT.heading}
          supportingCopy={[TALK_IT_OUT.supportingLine]}
          headingId="prelaunch-talk-it-out-heading"
        />

        {/* The conversation experience. */}
        <Reveal delay={0.08} className="mt-14">
          <div className="mx-auto max-w-4xl">
            <h3 className="landing-serif mb-3 text-center text-2xl font-semibold text-white sm:text-3xl">
              {TALK_IT_OUT.videoTitle}
            </h3>

            <LandingGlowCard glow="purple" className="mt-6 overflow-hidden">
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 px-6 text-center">
                <Video className="h-9 w-9 text-white/30" aria-hidden />
                <p className="text-sm font-semibold text-white/75">Video coming soon</p>
                <p className="max-w-md text-xs text-white/45">
                  The introduction video is in production and will appear here.
                </p>
              </div>
            </LandingGlowCard>

            <p className="mt-5 text-center text-[15px] text-[var(--solace-ds-text-muted)]">
              {TALK_IT_OUT.videoIntro}
            </p>
          </div>
        </Reveal>

        {/* Key highlights — emotional outcomes rather than a feature list. */}
        <Reveal delay={0.16} className="mt-16">
          <ul className="mx-auto grid max-w-4xl gap-x-8 gap-y-4 sm:grid-cols-2">
            {TALK_IT_OUT.highlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-3">
                <Check
                  className="landing-check-glow mt-1 h-[18px] w-[18px] shrink-0 text-emerald-400/90"
                  aria-hidden
                />
                <span className="text-[15px] text-[var(--solace-ds-text-muted)]">
                  {highlight}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>

        {/*
          Transition, then the section's single invitation.

          This is the only conversion control in Talk It Out. It carries the
          `meet_solace` origin; the former `experience` origin was retired with
          the section it belonged to — see TALK_IT_OUT in prelaunch.content.ts.
        */}
        <Reveal delay={0.2} className="mt-16">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <p className="landing-serif text-xl text-white sm:text-2xl md:text-[28px]">
              {TALK_IT_OUT.transition}
            </p>

            <div className="mt-8 flex w-full flex-col items-center">
              <FoundingMemberCta onClick={() => openSignup("meet_solace")} />
              <CtaSupportingText>{TALK_IT_OUT.ctaSupportingText}</CtaSupportingText>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
