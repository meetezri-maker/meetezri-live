import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/app/components/ui/accordion";
import { CONTACT_HREF, FAQ, SECTION_IDS } from "../prelaunch.content";
import { Reveal, SectionHeader } from "../PrelaunchPrimitives";
import { trackPrelaunchEvent } from "../prelaunch.analytics";

/**
 * Section 10 — Frequently Asked Questions.
 *
 * Radix single-type accordion: one item open at a time, with the ARIA wiring,
 * keyboard support, and focus states the primitive already provides. The
 * "Is Solace therapy?" answer stays a clear No.
 */
export function FaqSection() {
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
      className="relative overflow-hidden py-20 md:py-28"
    >
      <div className="landing-section relative z-10">
        <SectionHeader
          badge={FAQ.badge}
          heading={FAQ.heading}
          supportingCopy={FAQ.supportingCopy}
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
                  <div className="space-y-2.5 text-[15px] leading-[1.75] text-[var(--solace-ds-text-muted)]">
                    {item.answer.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    {item.link ? (
                      <p>
                        <Link
                          to={item.link.to}
                          className="text-violet-300 underline underline-offset-4 hover:text-violet-200"
                        >
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
            <div className="mt-2 space-y-1 text-[15px] leading-relaxed text-[var(--solace-ds-text-muted)]">
              {FAQ.closingSupportingCopy.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>

            <a
              href={CONTACT_HREF}
              className="mt-6 inline-flex items-center justify-center rounded-xl border border-white/20 bg-black/25 px-7 py-3 text-sm font-semibold text-white/90 backdrop-blur-sm transition-[box-shadow,border-color] hover:border-white/35 hover:shadow-[0_0_24px_-8px_rgba(168,85,247,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {FAQ.secondaryCta}
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
