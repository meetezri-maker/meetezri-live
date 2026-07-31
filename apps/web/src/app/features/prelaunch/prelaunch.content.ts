/**
 * Approved copy for the Solace Pre-Launch Founding Member landing page.
 *
 * Every string here is transcribed from the approved "Solace Pre-Launch Website"
 * content document. Do not edit, shorten, or reword — the document is the source
 * of truth and the section tests assert against these values.
 */

/** The single primary conversion label. Every primary CTA on the page uses it. */
export const PRIMARY_CTA_LABEL = "Become a Founding Member";

/** The locked brand promise. Appears in Section 1 and repeats in Section 11. */
export const BRAND_PROMISE = "Every conversation brings you closer to yourself.";

export const PRELAUNCH_ROUTE = "/early-access";

/**
 * There is no public contact route in this app; the public Terms page publishes
 * this address, so "Contact Us" resolves to it rather than a dead link.
 */
export const CONTACT_HREF = "mailto:support@solace.com";

/** Anchors used by the navigation and by every CTA that scrolls rather than opens. */
export const SECTION_IDS = {
  hero: "home",
  /** Consolidates the former "recognition" and "everyday-moments" anchors. */
  humanMoments: "human-moments",
  /** Consolidates the former "how-it-works" and "experience" anchors. */
  talkItOut: "talk-it-out",
  yourJourney: "your-journey",
  /**
   * The standalone "Why We Built Solace" section and its `about` anchor were
   * retired: Appendix A has no Purpose page, and the founder story now carries
   * the page's "about" intent. Navigation points "About" at the founder.
   */
  founder: "founder",
  foundingCircle: "membership",
  trust: "trust",
  /** The final invitation is folded into the end of this section. */
  faq: "faq",
} as const;

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export const NAV_ITEMS = [
  { label: "Home", targetId: SECTION_IDS.hero },
  { label: "How It Works", targetId: SECTION_IDS.talkItOut },
  { label: "About", targetId: SECTION_IDS.founder },
  { label: "Membership", targetId: SECTION_IDS.foundingCircle },
  { label: "FAQ", targetId: SECTION_IDS.faq },
] as const;

/* ------------------------------------------------------------------ */
/* Section 1 — Hero                                                    */
/* ------------------------------------------------------------------ */

/**
 * Section 1 — Hero. Copy from "Appendix A — Final Landing Page Copy", Page 1.
 *
 * Two approved production-safety exceptions apply on this page:
 *
 *  - The primary CTA keeps `PRIMARY_CTA_LABEL` ("Become a Founding Member")
 *    instead of Appendix A's "Start Talking Free". This flow captures a
 *    waitlist email; it creates no account and grants no immediate access, so
 *    Appendix A's label would not be truthful here.
 *  - The secondary CTA reads "Meet the Founder" and opens the existing founder
 *    video, because the 90-120 second product video Appendix A refers to does
 *    not exist yet. The implementation swaps to it by changing the asset only.
 *
 * The badge is retained from the existing page: Appendix A supplies none, and
 * it carries pre-launch context the approved copy assumes.
 */
export const HERO = {
  badge: "EARLY ACCESS NOW OPEN",

  /** PRIMARY HOOK — the page-level H1. */
  headline: "Some conversations change everything.",
  /**
   * The headline renders in two parts so the accent gradient can be applied
   * without altering the approved wording. `headlineLead + " " + headlineAccent`
   * must equal `headline`; a test asserts it.
   */
  headlineLead: "Some Conversations",
  headlineAccent: "Change Everything",

  /** SUPPORTING LINE. */
  supportingLine:
    "Talk through what's on your mind, celebrate life's wins, reflect on your day, and build healthier habits with an AI companion designed for everyday life.",

  /** TRUST INDICATORS. The check mark renders as a decorative icon. */
  trustIndicators: [
    "Private Conversations",
    "Built for Everyday Life",
    "Reflect • Grow • Feel Better",
  ],

  /**
   * MICROCOPY — approved production-truthfulness exception to Appendix A,
   * consistent with the CTA-label exception above.
   *
   * Appendix A reads "No appointment required. Start your first conversation in
   * minutes." This page only captures Founding Circle registrations; it grants
   * no immediate access, and that line would sit directly above a "Become a
   * Founding Member" button and contradict the form's own promise to notify
   * visitors when Solace is ready. The retained line is the truthful
   * pre-launch equivalent.
   */
  microcopy: "Join our early community and help shape the future of Solace.",

  /** SECONDARY CTA — see the exception note above. */
  secondaryCta: "Meet the Founder",
} as const;

/* ------------------------------------------------------------------ */
/* Section 2 — Human Moments                                           */
/* ------------------------------------------------------------------ */

/**
 * Section 2 — Human Moments. Copy from Appendix A, Page 2.
 *
 * Consolidates the previous "You're Not the Only One" (Recognition) and
 * "Everyday Moments" sections into the single approved chapter.
 *
 * Retained from the existing page, because Appendix A supplies neither and both
 * are truthful for a pre-launch registration page:
 *  - the section badge
 *  - the supporting line beneath the call to action
 *
 * The call to action keeps `PRIMARY_CTA_LABEL` and the existing
 * `everyday_moments` analytics origin, per the approved CTA-label exception.
 */
export const HUMAN_MOMENTS = {
  badge: "EVERYDAY MOMENTS",

  /** SECTION HOOK. */
  heading: "Because life isn't just about getting through hard days.",

  /** SUPPORTING LINE. */
  supportingLine:
    "Some conversations help you process. Others help you celebrate, reflect, dream, and grow.",

  /**
   * MOMENT 1-4, verbatim and in Appendix A order.
   *
   * Appendix A gives each moment a title and a single narrative line, and that
   * is all that renders — no reflection, takeaway, or tag copy is invented.
   */
  moments: [
    {
      id: "quiet-day",
      title: "When the day is finally quiet...",
      narrative: "Some nights, your thoughts are louder than the silence.",
      glow: "purple",
    },
    {
      id: "small-win",
      title: "After a small win...",
      narrative: "Growth deserves to be noticed.",
      glow: "amber",
    },
    {
      id: "big-decision",
      title: "Before a big decision...",
      narrative: "Sometimes clarity begins with a conversation.",
      glow: "cyan",
    },
    {
      id: "everyday-life",
      title: "During everyday life...",
      narrative: "Not every conversation starts with something difficult.",
      glow: "green",
    },
  ],

  /** SECTION TRANSITION. */
  transition:
    "Whatever is on your mind, there's always a place to start the conversation.",

  /**
   * CTA — navigational only. Appendix A: "(Scrolls to the Talk It Out
   * section.)" It never opens the signup flow; the Founding Member button
   * beside it remains the only conversion control.
   */
  secondaryCta: "See How a Conversation Begins",

  /** Retained supporting line beneath the CTA. */
  ctaSupportingText:
    "Start your journey with Solace and help shape the future of a space built for reflection, growth, and meaningful conversations.",
} as const;

/* ------------------------------------------------------------------ */
/* Section 3 — Talk It Out                                             */
/* ------------------------------------------------------------------ */

/**
 * Section 3 — Talk It Out. Copy from Appendix A, Page 3.
 *
 * Consolidates the previous "Meet Solace" and "More Than a Conversation"
 * sections. The old product-screenshot carousel is gone: Appendix A makes the
 * video the product demonstration, and most of those screenshots did not exist.
 *
 * Appendix A's primary and secondary CTAs ("Start Your First Conversation" and
 * "Create Your Free Account") collapse into a single `PRIMARY_CTA_LABEL` button
 * under the approved CTA-label exception — this page registers Founding Members
 * and grants no immediate access.
 *
 * ANALYTICS: this section has exactly one conversion control, carrying the
 * `meet_solace` origin. The `experience` origin is INTENTIONALLY RETIRED as
 * part of the Meet Solace + More Than a Conversation consolidation: that
 * placement no longer exists, so keeping it alive would have required a
 * duplicate button and would have reported an inaccurate placement. It is not
 * reassigned to any other control or section.
 *
 * Badge and the CTA supporting line are retained from the sections replaced.
 */
export const TALK_IT_OUT = {
  badge: "MEET SOLACE",

  /** SECTION HOOK. */
  heading: "Sometimes the best place to begin... is simply talking.",

  /** SUPPORTING LINE. */
  supportingLine:
    "Meet your AI companion and discover how a simple conversation can help you reflect, understand yourself, and move forward.",

  /** VIDEO TITLE. */
  videoTitle: "See Solace in Action",

  /** VIDEO INTRO. */
  videoIntro:
    "Watch how a conversation naturally unfolds—from everyday thoughts to meaningful reflection.",

  /** KEY HIGHLIGHTS. The check mark renders as a decorative icon. */
  highlights: [
    "Talk about anything that's on your mind.",
    "Celebrate your wins, no matter how small.",
    "Reflect on your day without judgment.",
    "Explore ideas, goals, and personal growth.",
    "Build healthier habits one conversation at a time.",
    "Private, supportive, and available whenever you need it.",
  ],

  /** TRANSITION. */
  transition:
    "One conversation can become the beginning of a healthier relationship with yourself.",

  /** Retained supporting line beneath the section's single call to action. */
  ctaSupportingText:
    "Be among the first to experience Solace and help shape what comes next.",
} as const;

/* ------------------------------------------------------------------ */
/* Section 4 — Your Journey                                            */
/* ------------------------------------------------------------------ */

/**
 * Section 4 — Your Journey. Copy from Appendix A, Page 4.
 *
 * A new chapter: it replaces no existing section, so no production behaviour
 * moves here. Appendix A specifies a primary CTA ("Start Your Journey"), which
 * renders as `PRIMARY_CTA_LABEL` under the approved CTA-label exception and
 * opens the existing Founding Circle flow.
 *
 * Because nothing is being re-homed, the CTA needs its own analytics origin.
 * `your_journey` is added deliberately rather than reusing an existing origin,
 * which would corrupt the conversion data of the section that owns it.
 *
 * "STEP 1/2/3" are Appendix A's structural labels, not visible copy — the same
 * convention as "MOMENT 1-4" on Page 2. The order is conveyed by an ordered
 * list and a visual connector rather than printed numerals, which also keeps
 * Blueprint 7.2's "organic rather than measured" progression.
 */
export const YOUR_JOURNEY = {
  badge: "YOUR JOURNEY",

  /** SECTION HOOK. */
  heading: "Small conversations. Meaningful change.",

  /** SUPPORTING LINE. */
  supportingLine:
    "Every conversation becomes another step toward understanding yourself, building healthier habits, and growing over time.",

  /** STEP 1-3, verbatim and in Appendix A order. */
  steps: [
    {
      id: "talk-it-out",
      title: "Talk It Out",
      description: "Speak honestly about whatever is on your mind.",
    },
    {
      id: "reflect",
      title: "Reflect",
      description:
        "Discover patterns, thoughts, and emotions you may not have noticed before.",
    },
    {
      id: "grow",
      title: "Grow",
      description:
        "Turn small moments into healthier habits and lasting personal growth.",
    },
  ],

  /** SECTION TRANSITION. */
  transition:
    "Growth doesn't happen all at once. It happens one conversation at a time.",

  /*
   * No supporting line beneath the call to action. Appendix A supplies none for
   * this page, and unlike the converted sections there is no existing line to
   * retain, so nothing is written to fill the slot.
   */
} as const;

/*
 * The standalone "Why We Built Solace" section was retired. Appendix A has no
 * Purpose page, and its intent — why Solace exists — is carried by the founder
 * story, which navigation now treats as this page's "About".
 */

/* ------------------------------------------------------------------ */
/* Section 7 — Meet the Founder                                        */
/* ------------------------------------------------------------------ */

/**
 * Section 5 — Founder. The visible frame comes from Appendix A, Page 5:
 * heading, supporting line, video title, transition, and CTA placement.
 *
 * Everything identifying the founder is retained from the existing page and
 * must not be rewritten: name, role, story, quote, and the video transcript.
 * No biography, achievement, or testimonial is invented.
 *
 * `videoLength` deliberately keeps the existing "60–90 seconds" rather than
 * Appendix A's "15–30 Seconds": the retained transcript plainly runs longer
 * than thirty seconds, so Appendix A's figure would misdescribe the very
 * content this section ships.
 */
export const FOUNDER = {
  badge: "MEET THE FOUNDER",

  /** SECTION HOOK. */
  heading: "Solace was created for the conversations we often keep to ourselves.",

  /** SUPPORTING LINE. */
  supportingLine:
    "A short message from our founder about why Solace exists and the vision behind creating a space where every conversation matters.",

  /** TRANSITION. */
  transition: "Every meaningful journey begins with a single conversation.",

  name: "Rosalind Mitchell",
  role: "Founder, Solace",
  story: [
    "Throughout my work, I’ve had the privilege of listening to people’s stories. Different lives.",
    "Different experiences. Different challenges. Yet one thing remained remarkably similar. People weren’t always looking for someone to solve every problem. They were looking for somewhere they could slow down, think clearly, and feel heard. That realization stayed with me. I began wondering what it would look like if people had access to a space like that every day—not only during life’s biggest moments, but also in the quiet moments in between.That question eventually became Solace.",
  ],
  quote:
    "Sometimes the most important conversation isn’t the one you have with someone else. It’s the one that helps you better understand yourself.",
  /** VIDEO TITLE, per Appendix A. Replaces the former "Why I Built Solace". */
  videoTitle: "Meet the Founder",
  videoLength: "60–90 seconds",
  ctaSupportingText:
    "Join us from the very beginning and help shape the future of Solace.",
} as const;

/**
 * Approved founder video script, used verbatim as the accessible transcript.
 * If the final recorded video differs, align the transcript to the recording.
 */
export const FOUNDER_VIDEO_TRANSCRIPT = [
  {
    heading: "Opening",
    lines: [
      "Hi, and thank you for being here.",
      "If you’ve made it this far, you’ve probably seen a little of what Solace is.",
      "What I’d really love to share with you is why it exists.",
    ],
  },
  {
    heading: "The Story",
    lines: [
      "Over the years, I’ve listened to countless conversations.",
      "Some were joyful.",
      "Some were difficult.",
      "Many were simply people trying to make sense of what they were feeling.",
      "What stood out wasn’t that people always needed answers.",
      "It was that they needed space.",
      "Space to think.",
      "Space to reflect.",
      "Space to simply be heard without feeling judged.",
      "That stayed with me long after those conversations ended.",
    ],
  },
  {
    heading: "Why Solace",
    lines: [
      "That’s what inspired Solace.",
      "Not to replace human connection.",
      "Not to replace therapy.",
      "Not to tell people how they should feel.",
      "But to create a place where reflection becomes part of everyday life.",
      "A place where people can slow down, understand themselves a little better, and recognize that growth often begins with a single honest conversation.",
    ],
  },
  {
    heading: "The Vision",
    lines: [
      "My hope is that Solace becomes something people return to—not because life is always difficult, but because taking time to understand ourselves should be part of living well.",
      "Whether you’re celebrating a win, navigating uncertainty, or simply checking in with yourself, I hope Solace becomes a place that always feels welcoming.",
    ],
  },
  {
    heading: "Closing",
    lines: [
      "We’re still at the beginning of this journey.",
      "Every Founding Member helps shape what Solace becomes.",
      "Your ideas, your experiences, and your feedback matter.",
      "I’d genuinely love for you to be part of what we’re building.",
      "Thank you for believing in this mission.",
      "I can’t wait to welcome you to Solace.",
    ],
  },
] as const;

/* ------------------------------------------------------------------ */
/* Section 8 — Become a Founding Member                                */
/* ------------------------------------------------------------------ */

export const FOUNDING_MEMBER_DISCOUNT_PERCENTAGE = 20;

export const FOUNDING_CIRCLE = {
  badge: "FOUNDING CIRCLE",
  heading: "Help shape the future of Solace.",
  supportingCopy: [
    "Every meaningful journey begins with a small group of people who believe in the idea before anyone else.",
    "As one of our Founding Members, you’ll experience Solace before its public launch, receive exclusive early-member benefits, and help us shape the future through your feedback. You’re not simply signing up for early access. You’re helping build a place that could support thousands of people for years to come.",
  ],
  cardTitle: "What’s Included",
  benefits: [
    {
      title: "30-Day Premium Trial",
      description:
        "Take your time exploring Solace with an extended trial instead of the standard experience.",
    },
    {
      title: "100 Talk It Out Minutes",
      description:
        "More conversations. More reflection. More opportunity to experience everything Solace has to offer.",
    },
    {
      title: `${FOUNDING_MEMBER_DISCOUNT_PERCENTAGE}% Lifetime Founding Member Discount`,
      description:
        "A thank-you for believing in Solace from the very beginning. (Applied while you maintain an active membership.)",
    },
    {
      title: "Early Access to New Features",
      description:
        "Be among the first to explore new experiences as Solace continues to grow.",
    },
    {
      title: "Direct Influence",
      description:
        "Your feedback will directly shape future updates, improvements, and new features.",
    },
    {
      title: "Exclusive Founder Updates",
      description:
        "Receive behind-the-scenes updates from Rosalind about what’s being built and what’s coming next.",
    },
  ],
  invitationHeading: "Why We’re Inviting Founding Members",
  invitation: [
    "We’re not looking for thousands of people today. We’re looking for the right people. People who believe that reflection, growth, and meaningful conversations deserve a better home. If that sounds like you, we’d love to welcome you.",
  ],
  ctaSupportingText: [
    "No payment required today.",
    "Reserve your place and we’ll let you know the moment Solace is ready.",
  ],
} as const;

/* ------------------------------------------------------------------ */
/* Founding Member form                                                */
/* ------------------------------------------------------------------ */

export const FOUNDING_FORM = {
  heading: "Reserve your place",
  emailLabel: "Email address",
  emailPlaceholder: "you@example.com",
  firstNameLabel: "First name",
  firstNameOptional: "optional",
  firstNamePlaceholder: "Alex",
  submitLabel: PRIMARY_CTA_LABEL,
  submittingLabel: "Reserving your place…",
  consent:
    "By joining, you agree to receive Solace launch and Founding Member updates. You can unsubscribe at any time.",
  successHeading: "Welcome to the Founding Circle",
  successBody: [
    "Thank you for joining Solace from the very beginning.",
    "Your place has been reserved. We’ll keep you updated as we move toward launch, and you’ll receive your Founding Member benefits when Solace is ready.",
  ],
  existingHeading: "You’re already part of the Founding Circle",
  existingBody: [
    "We’ll keep you updated as Solace gets closer to launch.",
  ],
  errorFallback:
    "We could not save your place just now. Please try again in a moment.",
} as const;

/* ------------------------------------------------------------------ */
/* Section 9 — Privacy, Safety & Trust                                 */
/* ------------------------------------------------------------------ */

/**
 * Section 7 — Trust, Privacy & Safety. Copy from Appendix A, Page 6.
 *
 * ANALYTICS: this section previously had no conversion control. Appendix A adds
 * one, so it carries a new documented origin, `trust`. No other section's origin
 * is reused or reassigned.
 *
 * Claims retired in this reframe, none of which are supported by approved
 * product documentation:
 *  - a crisis-response capability ("if a conversation suggests you may need
 *    immediate professional help… provides guidance toward trusted crisis
 *    resources"), which implied risk detection and a crisis-resource service;
 *  - decorative lock and shield symbols implying security certification.
 *
 * The former "What Solace Isn't" disclaimers are not lost: Appendix A places
 * that statement in the FAQ ("Is SOLACE therapy? No. SOLACE is not a
 * replacement for therapy or professional mental health care").
 *
 * No encryption, certification, compliance, clinical, or security guarantee is
 * stated anywhere here, and the badge is retained from the existing page.
 */
export const TRUST = {
  badge: "PRIVACY • SAFETY • TRUST",

  /** SECTION HOOK. */
  heading: "A space where you can simply be yourself.",

  /** SUPPORTING LINE. */
  supportingLine:
    "Your conversations are private, your wellbeing comes first, and you're always in control of your journey.",

  /** TRUST, PRIVACY, and SAFETY pillars — verbatim and in Appendix A order. */
  pillars: [
    {
      id: "private-by-design",
      title: "Private by Design",
      description: "Your conversations stay personal and protected.",
      glow: "purple",
    },
    {
      id: "in-control",
      title: "You're Always in Control",
      description: "Choose when to talk, what to share, and how you use SOLACE.",
      glow: "blue",
    },
    {
      id: "support",
      title: "Support When It Matters Most",
      description:
        "SOLACE encourages healthier conversations while helping guide you toward additional support when needed.",
      glow: "green",
    },
  ],

  /** SECTION TRANSITION. */
  transition: "Because meaningful conversations begin with trust.",

  /** Legal destinations, retained exactly as they were. */
  links: [
    { label: "Privacy Policy", to: "/privacy" },
    { label: "Terms of Service", to: "/terms" },
    { label: "Safety Information", to: "/privacy#safety" },
  ],
} as const;

/* ------------------------------------------------------------------ */
/* Section 10 — Frequently Asked Questions                             */
/* ------------------------------------------------------------------ */

export type FaqItem = {
  id: string;
  question: string;
  answer: string[];
  /** Optional in-answer link required by the approved copy. */
  link?: { label: string; to: string };
};

/**
 * Section 8 — Frequently Asked Questions. Copy from Appendix A, Page 7.
 *
 * The former standalone "Your Journey Starts Here" section is folded in at the
 * end of this one, so the page closes on a single invitation. That CTA keeps
 * the existing `final_invitation` analytics origin; no FAQ-specific origin is
 * introduced because Appendix A describes one closing placement, not two.
 *
 * Two deliberate departures from Appendix A's six questions:
 *
 *  - "How do I get started?" keeps Appendix A's question but retains the
 *    existing truthful answer. Appendix A answers "Create your free account,
 *    begin your first conversation…", which is not possible on a pre-launch
 *    registration page — the same production-truthfulness exception already
 *    approved for the CTA labels and the Hero microcopy.
 *  - "What if I need immediate help?" is RETAINED as a seventh item. Appendix A
 *    omits it, but it is a safety disclaimer that directs people to emergency
 *    services, and safety disclaimers must not be weakened. It claims no
 *    capability: it states plainly that Solace is not the right place for
 *    urgent assistance.
 *
 * Nothing here states a clinical, diagnostic, crisis-monitoring, emergency
 * response, encryption, compliance, pricing, or availability capability.
 */
export const FAQ = {
  badge: "QUESTIONS & ANSWERS",

  /** SECTION HOOK. */
  heading: "Questions? We've answered the ones people ask most.",

  items: [
    {
      id: "what-is-solace",
      question: "What is SOLACE?",
      answer: [
        "SOLACE is an AI companion designed to help you talk through everyday thoughts, reflect on your experiences, celebrate personal wins, and build healthier habits through meaningful conversations.",
      ],
    },
    {
      id: "is-solace-therapy",
      question: "Is SOLACE therapy?",
      answer: [
        "No. SOLACE is not a replacement for therapy or professional mental health care. It is a supportive AI companion created to encourage reflection, personal growth, and healthier daily conversations.",
      ],
    },
    {
      id: "what-can-i-talk-about",
      question: "What can I talk about?",
      answer: [
        "Anything that's on your mind—from stressful days and difficult moments to exciting ideas, personal goals, relationships, achievements, or simply reflecting on your day.",
      ],
    },
    {
      id: "are-my-conversations-private",
      question: "Are my conversations private?",
      answer: [
        "Privacy is a core part of SOLACE. Your conversations are designed to remain personal, giving you a space where you can speak openly and honestly.",
      ],
      link: { label: "Read the Privacy Policy", to: "/privacy" },
    },
    {
      id: "do-i-need-to-be-struggling",
      question: "Do I need to be struggling to use SOLACE?",
      answer: [
        "Not at all. SOLACE is built for everyday life. Many conversations are about personal growth, decision-making, gratitude, celebrating wins, and understanding yourself better.",
      ],
    },
    {
      id: "how-do-i-get-started",
      question: "How do I get started?",
      answer: [
        "You'll reserve your place in our Founding Circle and receive updates as we prepare for launch.",
        "When your invitation is ready, you'll be among the first to experience Solace and enjoy the exclusive Founding Member benefits.",
      ],
    },
    {
      id: "what-if-i-need-immediate-help",
      question: "What if I need immediate help?",
      answer: [
        "If you're experiencing a crisis or believe you may be in immediate danger, Solace is not the right place to get urgent assistance.",
        "Please contact your local emergency services or a trusted crisis support resource immediately.",
      ],
      link: { label: "Safety & crisis resources", to: "/privacy#safety" },
    },
  ] satisfies FaqItem[],

  closingStatement: "Still have a question?",
  closingSupportingCopy: [
    "We're always happy to help.",
    "Reach out to us anytime and we'll do our best to point you in the right direction.",
  ],
  secondaryCta: "Contact Us",

  /* ---------------------------------------------------------------- */
  /* Folded-in final invitation                                        */
  /* ---------------------------------------------------------------- */

  /** The locked brand promise, now the page's closing statement. */
  finalHeading: BRAND_PROMISE,
  finalClosingInvitation: "We'd be honored to welcome you.",
  finalCtaSupportingText:
    "Join our Founding Circle and help shape the future of Solace from the very beginning.",
  /**
   * Retained from the former section. Its "Contact Us" and "Privacy & Safety"
   * links were dropped as duplicates: this section already links to both.
   */
  finalSecondaryLink: { label: "Learn More", targetId: SECTION_IDS.talkItOut },
} as const;

/* ------------------------------------------------------------------ */
/* SEO / social metadata                                               */
/* ------------------------------------------------------------------ */

export const PRELAUNCH_META = {
  title: "Join the Solace Founding Circle | Early Access",
  description:
    "Join the Solace Founding Circle and be among the first to experience a private space for reflection, meaningful conversations, and personal growth.",
  ogImage: "/community/hero-lake.jpg",
} as const;
