import { Compass, MessageCircle, Sprout } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SECTION_IDS, YOUR_JOURNEY } from "../prelaunch.content";
import { FoundingMemberCta, Reveal, SectionHeader, SectionBackdrop } from "../PrelaunchPrimitives";
import { useFoundingMemberSignup } from "../FoundingMemberSignupContext";
import { PRELAUNCH_JOURNEY_BG } from "../prelaunch.imagery";

/**
 * Icons per Blueprint 7.3, which permits subtle icons for conversation,
 * reflection, and growth. `Sprout` is deliberate: an upward-trend or chart
 * glyph would read as analytics, which 7.3's visual guardrails exclude.
 */
const STEP_ICON: Record<string, LucideIcon> = {
  "talk-it-out": MessageCircle,
  reflect: Compass,
  grow: Sprout,
};

/**
 * Section 4 — Your Journey.
 *
 * A new chapter; copy is Appendix A, Page 4.
 *
 * Blueprint 7.2 — presented as "a calm path rather than a dashboard", with
 * progress that feels "organic rather than measured". The three steps are an
 * ordered list joined by a subtle connector (7.5 — Journey Connections), not a
 * progress bar, streak, badge, or milestone counter, all of which 7.5's motion
 * guardrails exclude.
 *
 * Blueprint 7.6 — the journey order is identical on every device; the layout
 * stacks into a single column rather than reordering.
 *
 * Nothing beyond Appendix A renders: each step is a title and one description,
 * and no step numerals, timelines, outcomes, or account states are invented.
 */
export function YourJourneySection() {
  const { openSignup } = useFoundingMemberSignup();

  return (
    <section
      id={SECTION_IDS.yourJourney}
      aria-labelledby="prelaunch-your-journey-heading"
      className="relative overflow-hidden py-20 md:py-28"
    >
      <SectionBackdrop src={PRELAUNCH_JOURNEY_BG} />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_10%,rgba(88,28,135,0.16)_0%,transparent_60%)]"
        aria-hidden
      />

      <div className="landing-section relative z-10">
        <SectionHeader
          badge={YOUR_JOURNEY.badge}
          heading={YOUR_JOURNEY.heading}
          supportingCopy={[YOUR_JOURNEY.supportingLine]}
          headingId="prelaunch-your-journey-heading"
        />

        {/* An ordered list: the sequence is conveyed semantically, not by numerals. */}
        <ol className="prelaunch-journey mx-auto mt-14 max-w-5xl">
          {YOUR_JOURNEY.steps.map((step, index) => {
            const Icon = STEP_ICON[step.id];

            return (
              <Reveal
                as="li"
                key={step.id}
                delay={index * 0.1}
                className="prelaunch-journey-step flex flex-col items-center text-center"
              >
                <span className="prelaunch-journey-marker">
                  <Icon className="h-6 w-6 text-violet-200" aria-hidden />
                </span>

                <h3 className="landing-serif mt-5 text-xl font-semibold text-white sm:text-[22px]">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xs text-[15px] text-[var(--solace-ds-text-muted)]">
                  {step.description}
                </p>
              </Reveal>
            );
          })}
        </ol>

        {/* Transition, then the gentle invitation to begin (7.2). */}
        <Reveal delay={0.14} className="mt-16">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <p className="landing-serif text-xl text-white sm:text-2xl md:text-[28px]">
              {YOUR_JOURNEY.transition}
            </p>

            <div className="mt-8 flex w-full flex-col items-center">
              <FoundingMemberCta onClick={() => openSignup("your_journey")} />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
