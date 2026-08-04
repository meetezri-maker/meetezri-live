import { useState } from "react";
import { Quote } from "lucide-react";
import { LandingGlowCard } from "@/app/landing/LandingGlowCard";
import { FOUNDER, SECTION_IDS } from "../prelaunch.content";
import { PRELAUNCH_FOUNDER_BG } from "../prelaunch.imagery";
import {
  CtaSupportingText,
  FoundingMemberCta,
  Reveal,
  SectionBackdrop,
  SectionBadge,
} from "../PrelaunchPrimitives";
import { FounderVideoModal, FounderVideoThumbnail } from "../FounderVideoModal";
import { useFoundingMemberSignup } from "../FoundingMemberSignupContext";
import { trackPrelaunchEvent } from "../prelaunch.analytics";

/**
 * Section 7 — Meet the Founder.
 *
 * Split layout: video left (55%), story right (45%). On mobile the video comes
 * first, then the story, quote, and CTA — the order the document specifies.
 */
export function FounderSection() {
  const { openSignup } = useFoundingMemberSignup();
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <section
      id={SECTION_IDS.founder}
      aria-labelledby="prelaunch-founder-heading"
      className="relative overflow-hidden py-20 md:py-28"
    >
      <SectionBackdrop
        src={PRELAUNCH_FOUNDER_BG}
        overlayClassName="bg-[linear-gradient(180deg,rgba(10,7,18,0.86)_0%,rgba(8,7,20,0.9)_50%,rgba(5,8,22,0.94)_100%)]"
      />

      <div className="landing-section relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <SectionBadge>{FOUNDER.badge}</SectionBadge>
          </Reveal>
          <Reveal delay={0.06}>
            <h2
              id="prelaunch-founder-heading"
              className="landing-serif mt-5 text-[28px] font-semibold leading-tight text-white sm:text-4xl md:text-[42px]"
            >
              {FOUNDER.heading}
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 text-[15px] text-[var(--solace-ds-text-muted)] sm:text-[17px]">
              {FOUNDER.supportingLine}
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[55fr_45fr] lg:gap-12">
          <Reveal className="order-1">
            <FounderVideoThumbnail
              onOpen={() => {
                trackPrelaunchEvent("founder_video_opened", { origin: "founder_section" });
                setVideoOpen(true);
              }}
            />
          </Reveal>

          <div className="order-2 flex flex-col gap-6">
            <Reveal delay={0.1}>
              <div>
                <p className="text-lg font-semibold text-white">{FOUNDER.name}</p>
                <p className="text-sm text-[var(--solace-ds-text-muted)]">{FOUNDER.role}</p>
              </div>
            </Reveal>

            <Reveal delay={0.14}>
              <div className="space-y-2.5 text-[15px] leading-[1.75] text-[var(--solace-ds-text-muted)]">
                {FOUNDER.story.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </Reveal>
          </div>
        </div>

        <Reveal delay={0.12} className="mt-14">
          <LandingGlowCard glow="pink" className="mx-auto max-w-3xl p-8 sm:p-10">
            <blockquote className="flex flex-col items-center gap-4 text-center">
              <Quote className="h-7 w-7 text-pink-300/70" aria-hidden />
              <p className="landing-serif text-xl leading-snug text-white sm:text-2xl md:text-[28px]">
                {FOUNDER.quote}
              </p>
              <footer className="text-sm text-[var(--solace-ds-text-muted)]">
                — {FOUNDER.name}, {FOUNDER.role}
              </footer>
            </blockquote>
          </LandingGlowCard>
        </Reveal>

        {/* TRANSITION, then the invitation (Appendix A places it last). */}
        <Reveal delay={0.16} className="mt-14">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <p className="landing-serif text-xl text-white sm:text-2xl md:text-[28px]">
              {FOUNDER.transition}
            </p>

            <div className="mt-8 flex w-full flex-col items-center">
              <FoundingMemberCta onClick={() => openSignup("founder")} />
              <CtaSupportingText>{FOUNDER.ctaSupportingText}</CtaSupportingText>
            </div>
          </div>
        </Reveal>
      </div>

      {/* The modal owns focus restoration for every caller. */}
      <FounderVideoModal open={videoOpen} onOpenChange={setVideoOpen} />
    </section>
  );
}
