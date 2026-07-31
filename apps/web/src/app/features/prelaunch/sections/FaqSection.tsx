import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/app/components/ui/accordion";
import { cn } from "@/lib/utils";
import { CONTACT_HREF, FAQ, SECTION_IDS } from "../prelaunch.content";
import {
  CtaSupportingText,
  FoundingMemberCta,
  Reveal,
  SectionHeader,
} from "../PrelaunchPrimitives";
import { useFoundingMemberSignup } from "../FoundingMemberSignupContext";
import { trackPrelaunchEvent } from "../prelaunch.analytics";
import { scrollToPrelaunchSection } from "../prelaunch.scroll";

/**
 * Section 8 — Frequently Asked Questions, closing with the final invitation.
 *
 * Copy is Appendix A, Page 7. The former standalone "Your Journey Starts Here"
 * section is folded in here, so the page ends on one invitation rather than
 * two competing ones. That CTA keeps the `final_invitation` origin.
 *
 * The accordion is the shared Radix primitive: native `<button>` triggers with
 * `aria-expanded`, `aria-controls`, and stable panel ids, full keyboard
 * support, and content that stays readable without animation. Nothing here is
 * a clickable div.
 *
 * "Is SOLACE therapy?" keeps its clear No, and the immediate-help answer is
 * retained even though Appendix A omits it — safety disclaimers are not
 * weakened.
 */

/** Shared focus treatment for every link and text control in this section. */
const linkClass = cn(
  "rounded-sm text-violet-300 underline underline-offset-4 transition-colors",
  "hover:text-violet-200",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
  "focus-visible:ring-offset-2 focus-visible:ring-offset-[#050816]",
);

export function FaqSection() {
  const { openSignup } = useFoundingMemberSignup();
  const [openItem, setOpenItem] = useState<string>("");

  function handleValueChange(value: string) {
    setOpenItem(value);
    if (value) {
      trackPrelaunchEvent("faq_item_opened", { question_id: value });
    }
  }

  return (
    <section
      id={SECTION_IDS.faq}
      aria-labelledby="prelaunch-faq-heading"
      className="relative overflow-hidden py-20 md:py-8"
    >
      <div className="landing-section relative z-10">
        <SectionHeader
          badge={FAQ.badge}
          heading={FAQ.heading}
          headingId="prelaunch-faq-heading"
        />

        <Reveal delay={0.08} className="mt-12">
          <Accordion
            type="single"
            collapsible
            value={openItem}
            onValueChange={handleValueChange}
            className="mx-auto max-w-3xl"
          >
            {FAQ.items.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="mb-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm last:border-b"
              >
                <AccordionTrigger className="px-5 py-4 text-left text-[15px] font-semibold text-white transition-colors hover:bg-white/[0.04] hover:no-underline sm:px-6 sm:text-base">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5 sm:px-6">
                  <div className="space-y-2.5 text-[15px] text-[var(--solace-ds-text-muted)]">
                    {item.answer.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    {item.link ? (
                      <p>
                        <Link to={item.link.to} className={linkClass}>
                          {item.link.label}
                        </Link>
                      </p>
                    ) : null}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>

        <Reveal delay={0.12} className="mt-12">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-lg font-semibold text-white">{FAQ.closingStatement}</p>
            <div className="mt-2 space-y-1 text-[15px] text-[var(--solace-ds-text-muted)]">
              {FAQ.closingSupportingCopy.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>

            <a href={CONTACT_HREF} className={cn(linkClass, "mt-5 inline-block text-sm")}>
              {FAQ.secondaryCta}
            </a>
          </div>
        </Reveal>

        {/*
          Final invitation, folded in from the retired standalone section. One
          CTA, no second form, and no repeat of the Founding Circle benefits.
        */}
        <Reveal delay={0.16} className="mt-16 md:mt-20">
          <div className="mx-auto flex flex-col items-center text-center">
            <p className="landing-serif text-balance text-2xl font-semibold text-white sm:text-3xl md:text-[36px]">
              {FAQ.finalHeading}
            </p>
            <p className="mt-4 text-[15px] text-white/80 sm:text-base">
              {FAQ.finalClosingInvitation}
            </p>

            <div className="mt-8 flex w-full flex-col items-center">
              <FoundingMemberCta onClick={() => openSignup("final_invitation")} />
              <CtaSupportingText>{FAQ.finalCtaSupportingText}</CtaSupportingText>
            </div>

            <button
              type="button"
              onClick={() => scrollToPrelaunchSection(FAQ.finalSecondaryLink.targetId)}
              className={cn(linkClass, "mt-6 text-sm")}
            >
              {FAQ.finalSecondaryLink.label}
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
