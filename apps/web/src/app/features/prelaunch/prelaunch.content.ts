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
  recognition: "recognition",
  meetSolace: "how-it-works",
  everydayMoments: "everyday-moments",
  experience: "experience",
  purpose: "about",
  founder: "founder",
  foundingCircle: "membership",
  trust: "trust",
  faq: "faq",
  finalInvitation: "begin",
} as const;

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export const NAV_ITEMS = [
  { label: "Home", targetId: SECTION_IDS.hero },
  { label: "How It Works", targetId: SECTION_IDS.meetSolace },
  { label: "Membership", targetId: SECTION_IDS.foundingCircle },
  { label: "About", targetId: SECTION_IDS.purpose },
  { label: "FAQ", targetId: SECTION_IDS.faq },
] as const;

/* ------------------------------------------------------------------ */
/* Section 1 — Hero                                                    */
/* ------------------------------------------------------------------ */

export const HERO = {
  badge: "EARLY ACCESS NOW OPEN",
  headline: BRAND_PROMISE,
  supportingCopy: [
    "Some thoughts stay with us longer than we’d like.",
    "The conversations we replay.",
    "The emotions we struggle to put into words.",
    "Solace gives you a calm, private space to talk through what you’re carrying, reflect on your experiences, and build healthier habits—one conversation at a time.",
  ],
  secondaryCta: "Watch Our Story",
  trustLine: "Join our early community and help shape the future of Solace.",
} as const;

/* ------------------------------------------------------------------ */
/* Section 2 — You're Not the Only One                                 */
/* ------------------------------------------------------------------ */

export const RECOGNITION = {
  badge: "YOU’RE NOT ALONE",
  heading: "Some conversations never leave our minds.",
  supportingCopy: [
    "We all carry moments that stay with us.",
    "Conversations we wish had gone differently.",
    "Feelings we struggle to explain.",
    "Questions we quietly ask ourselves when no one else is around.",
    "Whatever you’re carrying, you’re not alone—and you don’t have to figure it all out by yourself.",
  ],
  cards: [
    {
      emoji: "🌙",
      title: "Late Nights",
      description: "Sometimes the world gets quieter... but your thoughts don’t.",
      glow: "purple",
    },
    {
      emoji: "💭",
      title: "Overthinking",
      description:
        "You replay conversations, wondering what you could have said differently.",
      glow: "pink",
    },
    {
      emoji: "🎭",
      title: "Carrying More Than People See",
      description:
        "You smile, show up, and keep going—even when you’re carrying more than anyone realizes.",
      glow: "blue",
    },
    {
      emoji: "🤝",
      title: "Wanting Someone to Listen",
      description:
        "Sometimes you don’t need advice. You simply need a space to say things out loud.",
      glow: "cyan",
    },
    {
      emoji: "🌱",
      title: "Trying to Grow",
      description:
        "You’re not looking for perfection. You’re simply trying to become a healthier, stronger version of yourself.",
      glow: "green",
    },
    {
      emoji: "❤️",
      title: "Understanding Yourself",
      description:
        "You’ve wondered why you feel the way you do and wished you understood yourself a little better.",
      glow: "amber",
    },
  ],
  transition: [
    "Every one of these moments has something in common.",
    "They begin with a conversation.",
  ],
} as const;

/* ------------------------------------------------------------------ */
/* Section 3 — Meet Solace                                             */
/* ------------------------------------------------------------------ */

export const MEET_SOLACE = {
  badge: "MEET SOLACE",
  heading:
    "A space where every conversation helps you understand yourself a little more.",
  supportingCopy: [
    "Life doesn’t come with a pause button.",
    "Thoughts build up.",
    "Emotions change.",
    "Some days feel lighter than others.",
    "Solace is your private space to slow down, reflect, and work through what’s on your mind—without judgment, pressure, or expectations.",
    "Whether you’re celebrating a win, navigating a challenge, building healthier habits, or simply checking in with yourself, Solace is there to help you understand your journey, one conversation at a time.",
  ],
  introductions: [
    {
      title: "Talk It Out",
      copy: [
        "Sometimes the hardest part is simply knowing where to begin.",
        "Talk It Out gives you a calm, supportive space to express what’s on your mind, helping you process thoughts and emotions through meaningful conversation.",
      ],
    },
    {
      title: "Reflect & Grow",
      copy: [
        "Every conversation becomes an opportunity to notice patterns, celebrate progress, and better understand yourself over time.",
      ],
    },
    {
      title: "Build Healthier Habits",
      copy: [
        "Track your mood, journal your thoughts, build positive routines, improve your sleep, and create habits that support your wellbeing—one small step at a time.",
      ],
    },
  ],
  benefits: [
    {
      emoji: "🗣",
      title: "Talk freely",
      description: "Speak openly whenever you need a moment to reflect.",
      glow: "purple",
      previewId: "talk-it-out",
    },
    {
      emoji: "📖",
      title: "Capture your journey",
      description: "Journal your thoughts and experiences as life unfolds.",
      glow: "pink",
      previewId: "journal",
    },
    {
      emoji: "🌱",
      title: "Build healthy habits",
      description: "Small daily actions can lead to meaningful change.",
      glow: "green",
      previewId: "habits",
    },
    {
      emoji: "📈",
      title: "See your progress",
      description: "Recognize patterns, milestones, and personal growth over time.",
      glow: "cyan",
      previewId: "progress",
    },
    {
      emoji: "😴",
      title: "Support your wellbeing",
      description: "Track your mood, sleep, and routines to better understand yourself.",
      glow: "blue",
      previewId: "sleep",
    },
    {
      emoji: "🛡",
      title: "Private by design",
      description:
        "Your conversations remain personal, protected, and always under your control.",
      glow: "amber",
      previewId: "dashboard",
    },
  ],
  ctaSupportingText:
    "Be among the first to experience Solace and help shape what comes next.",
} as const;

/* ------------------------------------------------------------------ */
/* Section 4 — Everyday Moments                                        */
/* ------------------------------------------------------------------ */

export const EVERYDAY_MOMENTS = {
  badge: "EVERYDAY MOMENTS",
  heading: "Life gives us moments worth talking through.",
  supportingCopy: [
    "Some moments change us.",
    "Others simply ask us to slow down, take a breath, and understand what we’re feeling.",
    "Solace is designed to meet you in those everyday moments—not just when life feels difficult, but whenever you want to reflect, grow, or simply check in with yourself.",
  ],
  stories: [
    {
      emoji: "🌙",
      label: "When the day is finally quiet...",
      title: "Some nights, your thoughts are louder than the room around you.",
      copy: [
        "The world has gone quiet, but your mind hasn’t.",
        "You replay conversations.",
        "Wonder if you said the right thing.",
        "Think about tomorrow before today has even ended.",
        "Instead of carrying those thoughts into the night, Solace gives you a space to talk through them, reflect, and find a little more clarity before tomorrow begins.",
      ],
      perfectFor: ["Talk It Out", "Journal", "Mood Check-In"],
      /** Approved direction: a calm bedroom with soft lighting, rain outside the window. */
      imageAlt:
        "A calm bedroom at night with soft lamplight and rain against the window",
      glow: "purple",
    },
    {
      emoji: "🌱",
      label: "After a small win",
      title: "Growth deserves to be noticed, too.",
      copy: [
        "Not every conversation starts with something difficult.",
        "Sometimes you finally kept a promise to yourself.",
        "Reached a goal.",
        "Felt a little stronger than you did yesterday.",
        "Solace helps you celebrate those moments, recognize your progress, and remember how far you’ve come.",
      ],
      perfectFor: ["Goals", "Achievements", "Progress", "Habits"],
      /** Approved direction: someone walking through a park at sunrise with a quiet smile. */
      imageAlt: "A peaceful landscape at sunrise, warm light across an open path",
      glow: "green",
    },
    {
      emoji: "❤️",
      label: "When life feels overwhelming",
      title: "You don’t always need answers. Sometimes you just need somewhere to begin.",
      copy: [
        "There are days when everything feels heavier than usual.",
        "You don’t have all the words.",
        "You don’t even know where to start.",
        "Solace isn’t there to judge or rush you.",
        "It’s there to listen, help you organize your thoughts, and support you as you work through them at your own pace.",
      ],
      perfectFor: ["Talk It Out", "Journal", "Mood", "Reflection"],
      /** Approved direction: a person by a window with a cup of tea, looking out as rain falls. */
      imageAlt: "A quiet forest under soft rain, still and unhurried",
      glow: "pink",
    },
    {
      emoji: "🌅",
      label: "Looking back",
      title: "The conversations you have today become the story you’ll understand tomorrow.",
      copy: [
        "Growth rarely happens all at once.",
        "It happens one conversation.",
        "One journal entry.",
        "One small habit.",
        "One reflection at a time.",
        "Looking back reminds us that even the smallest steps can lead somewhere meaningful.",
      ],
      perfectFor: ["Progress", "Insights", "Journal Timeline", "Personal Growth"],
      /** Approved direction: a peaceful lake at sunrise with a journal resting nearby. */
      imageAlt: "A peaceful lake at sunrise with light spreading across still water",
      glow: "amber",
    },
  ],
  closingStatement: "Whatever life brings, you don’t have to carry it alone.",
  closingSupportingCopy:
    "Solace is there for the difficult days, the hopeful days, and all the ordinary moments in between.",
  ctaSupportingText:
    "Start your journey with Solace and help shape the future of a space built for reflection, growth, and meaningful conversations.",
} as const;

/* ------------------------------------------------------------------ */
/* Section 5 — More Than a Conversation                                */
/* ------------------------------------------------------------------ */

export const EXPERIENCE = {
  badge: "THE SOLACE EXPERIENCE",
  heading:
    "One conversation can change your day. Consistent reflection can change your life.",
  supportingCopy: [
    "Growth doesn’t happen because of one conversation.",
    "It happens when you begin to notice patterns, celebrate progress, and make space to check in with yourself again and again.",
    "Solace brings those moments together into one place, helping every conversation become part of a bigger journey.",
  ],
  featured: {
    emoji: "🗣",
    name: "Talk It Out",
    title: "Every journey begins with a conversation.",
    copy: [
      "Some conversations help us find answers.",
      "Others simply help us understand ourselves a little better.",
      "Talk It Out is your calm, private space to speak freely, organize your thoughts, and explore what’s on your mind without judgment or pressure.",
    ],
    previewId: "talk-it-out",
  },
  cards: [
    {
      emoji: "📖",
      name: "Journal",
      title: "Capture today before it becomes a memory.",
      description:
        "Write about your experiences, your gratitude, your challenges, and everything in between.",
      glow: "pink",
      previewId: "journal",
    },
    {
      emoji: "😊",
      name: "Mood",
      title: "Notice how you’re really feeling.",
      description:
        "Track emotional patterns over time and understand what influences your wellbeing.",
      glow: "amber",
      previewId: "mood",
    },
    {
      emoji: "🌱",
      name: "Habits",
      title: "Small routines become lasting change.",
      description: "Build meaningful daily habits one step at a time.",
      glow: "green",
      previewId: "habits",
    },
    {
      emoji: "😴",
      name: "Sleep",
      title: "Rest is part of growth.",
      description:
        "Better sleep helps create better days. Track your sleep and understand its impact on your wellbeing.",
      glow: "blue",
      previewId: "sleep",
    },
    {
      emoji: "🎯",
      name: "Goals & Achievements",
      title: "Celebrate every step forward.",
      description: "Because meaningful progress deserves to be seen.",
      glow: "purple",
      previewId: "goals",
    },
    {
      emoji: "📈",
      name: "Progress & Insights",
      title: "Growth becomes clearer when you can look back.",
      description:
        "Visualize your journey and discover patterns that help you understand yourself.",
      glow: "cyan",
      previewId: "progress",
    },
    {
      emoji: "🤝",
      name: "Community",
      title: "Grow alongside people who understand the journey.",
      description:
        "Share encouragement, celebrate milestones, and remember that you’re never alone.",
      glow: "pink",
      previewId: "community",
    },
    {
      emoji: "🛟",
      name: "Safety & Support",
      title: "Because your wellbeing always comes first.",
      description:
        "Access trusted guidance and support resources whenever you need them.",
      glow: "blue",
      previewId: "dashboard",
    },
  ],
  closingStatement: "No matter where you are today, Solace grows with you.",
  closingSupportingCopy: [
    "Some days you’ll need someone to listen.",
    "Some days you’ll celebrate progress.",
    "Some days you’ll simply check in with yourself.",
    "Every one of those moments matters.",
  ],
  ctaSupportingText:
    "Join our early community and experience everything Solace has to offer before launch.",
} as const;

/* ------------------------------------------------------------------ */
/* Section 6 — Why We Built Solace                                     */
/* ------------------------------------------------------------------ */

export const PURPOSE = {
  badge: "OUR PURPOSE",
  heading: "Because everyone deserves a space to simply be human.",
  story: [
    "We live in a world that constantly asks us to move faster.",
    "To respond quicker.",
    "To do more.",
    "To hold everything together.",
    "Somewhere along the way, many of us stopped giving ourselves permission to pause.",
    "To sit with our thoughts.",
    "To celebrate the good days.",
    "To work through the difficult ones.",
    "To understand ourselves with kindness instead of criticism.",
    "We didn’t build Solace to give people all the answers.",
    "We built it to create a space where better questions could be asked, honest conversations could happen, and personal growth could unfold naturally.",
  ],
  missionStatement:
    "Every conversation is an opportunity to better understand yourself.",
  beliefs: [
    {
      emoji: "🌱",
      title: "Growth takes time.",
      copy: [
        "There is no finish line for becoming a healthier version of yourself.",
        "Every small step matters.",
      ],
    },
    {
      emoji: "❤️",
      title: "Compassion comes before judgment.",
      copy: [
        "Real growth begins when we stop criticizing ourselves and start listening with kindness.",
      ],
    },
    {
      emoji: "🤝",
      title: "Everyone deserves to feel heard.",
      copy: [
        "Whether you’re celebrating a win or working through a difficult day, your experiences matter.",
      ],
    },
    {
      emoji: "🔒",
      title: "Trust is earned.",
      copy: [
        "Privacy, transparency, and respect aren’t features—they’re the foundation of every conversation inside Solace.",
      ],
    },
  ],
  closingReflection: [
    "Maybe what we’ve all needed wasn’t another app.",
    "Maybe we simply needed a place that reminded us to slow down, reflect, and reconnect with ourselves.",
  ],
  transition:
    "And every meaningful journey begins with someone who believes in that mission.",
} as const;

/* ------------------------------------------------------------------ */
/* Section 7 — Meet the Founder                                        */
/* ------------------------------------------------------------------ */

export const FOUNDER = {
  badge: "MEET THE FOUNDER",
  heading: "The heart behind Solace.",
  introduction: [
    "Before Solace became a platform, it began with a simple belief.",
    "That every person deserves a space where they can pause, reflect, and better understand themselves.",
    "I’m grateful you’re here, and I’d love to share why this journey means so much to me.",
  ],
  name: "Rosalind Mitchell",
  role: "Founder, Solace",
  story: [
    "Throughout my work, I’ve had the privilege of listening to people’s stories.",
    "Different lives.",
    "Different experiences.",
    "Different challenges.",
    "Yet one thing remained remarkably similar.",
    "People weren’t always looking for someone to solve every problem.",
    "They were looking for somewhere they could slow down, think clearly, and feel heard.",
    "That realization stayed with me.",
    "I began wondering what it would look like if people had access to a space like that every day—not only during life’s biggest moments, but also in the quiet moments in between.",
    "That question eventually became Solace.",
  ],
  quote:
    "Sometimes the most important conversation isn’t the one you have with someone else. It’s the one that helps you better understand yourself.",
  videoTitle: "Why I Built Solace",
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
    "As one of our Founding Members, you’ll experience Solace before its public launch, receive exclusive early-member benefits, and help us shape the future through your feedback.",
    "You’re not simply signing up for early access.",
    "You’re helping build a place that could support thousands of people for years to come.",
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
    "We’re not looking for thousands of people today.",
    "We’re looking for the right people.",
    "People who believe that reflection, growth, and meaningful conversations deserve a better home.",
    "If that sounds like you, we’d love to welcome you.",
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

export const TRUST = {
  badge: "PRIVACY • SAFETY • TRUST",
  heading: "A place where your conversations stay yours.",
  supportingCopy: [
    "Meaningful conversations require trust.",
    "That’s why privacy, transparency, and emotional safety aren’t optional features—they’re the foundation of everything we build.",
    "Whether you’re reflecting on a great day or working through something difficult, you should always know how your information is handled and what Solace is designed to do.",
  ],
  cards: [
    {
      emoji: "🔒",
      title: "Private by Design",
      copy: [
        "Your conversations are personal.",
        "They’re not shared publicly, and they’re handled with privacy in mind.",
      ],
      glow: "purple",
    },
    {
      emoji: "🛡",
      title: "Built for Wellbeing",
      copy: [
        "Solace is designed to support reflection, emotional wellbeing, and personal growth.",
        "It is not a replacement for licensed therapy, medical care, or emergency services.",
      ],
      glow: "blue",
    },
    {
      emoji: "🌍",
      title: "Available Whenever You Need It",
      copy: [
        "Whether it’s early morning or late at night, Solace is there whenever you want a space to pause and reflect.",
      ],
      glow: "cyan",
    },
    {
      emoji: "❤️",
      title: "Support When It Matters",
      copy: [
        "If a conversation suggests you may need immediate professional help, Solace encourages you to seek appropriate support and provides guidance toward trusted crisis resources where available.",
      ],
      glow: "pink",
    },
    {
      emoji: "👁",
      title: "Transparent Experience",
      copy: [
        "We’ll always be clear about what Solace can do—and what it can’t.",
        "No exaggerated promises.",
        "No pretending to replace human care.",
      ],
      glow: "amber",
    },
    {
      emoji: "🤝",
      title: "Built With Respect",
      copy: [
        "You stay in control of your journey.",
        "Our goal is to support reflection, not make decisions for you.",
      ],
      glow: "green",
    },
  ],
  isHeading: "What Solace Is",
  is: [
    "A place to reflect",
    "A companion for meaningful conversations",
    "A tool for building healthier habits",
    "A space for personal growth",
    "A place to celebrate progress",
  ],
  isntHeading: "What Solace Isn’t",
  isnt: [
    "A licensed therapist",
    "A crisis intervention service",
    "A medical diagnosis platform",
    "A replacement for professional care",
    "A platform that claims to have every answer",
  ],
  finalReassurance:
    "Trust isn’t something we ask for. It’s something we earn through every interaction.",
  finalReassuranceSupporting: [
    "Our commitment is simple:",
    "Create a space that feels calm, respectful, private, and worthy of your trust—every single time you return.",
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

export const FAQ = {
  badge: "QUESTIONS & ANSWERS",
  heading: "Everything you might be wondering.",
  supportingCopy: [
    "Choosing a new wellbeing companion is a personal decision.",
    "Here are answers to some of the questions we hear most often.",
  ],
  items: [
    {
      id: "is-solace-therapy",
      question: "Is Solace therapy?",
      answer: [
        "No.",
        "Solace is a wellbeing companion designed to support reflection, personal growth, and healthier daily habits.",
        "It is not a replacement for licensed therapy, medical advice, or emergency services.",
      ],
    },
    {
      id: "who-is-solace-for",
      question: "Who is Solace for?",
      answer: [
        "Solace is for anyone who wants a private space to pause, reflect, understand themselves better, and build healthier wellbeing habits.",
        "You don’t need to be going through a difficult time to benefit from using Solace.",
        "Many people use it simply to check in with themselves, celebrate progress, or create more intentional daily routines.",
      ],
    },
    {
      id: "is-what-i-share-private",
      question: "Is what I share private?",
      answer: [
        "Your privacy is important to us.",
        "We designed Solace with privacy and respect at its core. We encourage you to review our Privacy Policy to understand how your information is handled and protected.",
      ],
      link: { label: "Read the Privacy Policy", to: "/privacy" },
    },
    {
      id: "do-i-need-to-use-solace-every-day",
      question: "Do I need to use Solace every day?",
      answer: [
        "Not at all.",
        "Some people may choose to check in daily.",
        "Others may only return when they need a moment to reflect.",
        "Solace is designed to meet you wherever you are in your journey.",
      ],
    },
    {
      id: "what-happens-after-i-become-a-founding-member",
      question: "What happens after I become a Founding Member?",
      answer: [
        "You’ll reserve your place in our Founding Circle and receive updates as we prepare for launch.",
        "When your invitation is ready, you’ll be among the first to experience Solace and enjoy the exclusive Founding Member benefits.",
      ],
    },
    {
      id: "will-solace-continue-to-grow",
      question: "Will Solace continue to grow?",
      answer: [
        "Absolutely.",
        "We’re just getting started.",
        "New experiences, improvements, and features will continue to evolve based on thoughtful research, user feedback, and the needs of our community.",
      ],
    },
    {
      id: "can-i-share-feedback",
      question: "Can I share feedback?",
      answer: [
        "Yes—and we’d love you to.",
        "One of the biggest advantages of joining early is having the opportunity to help shape the future of Solace.",
        "Many of our future improvements will be inspired by the people who use it every day.",
      ],
    },
    {
      id: "what-if-i-need-immediate-help",
      question: "What if I need immediate help?",
      answer: [
        "If you’re experiencing a crisis or believe you may be in immediate danger, Solace is not the right place to get urgent assistance.",
        "Please contact your local emergency services or a trusted crisis support resource immediately.",
      ],
      link: { label: "Safety & crisis resources", to: "/privacy#safety" },
    },
  ] satisfies FaqItem[],
  closingStatement: "Still have a question?",
  closingSupportingCopy: [
    "We’re always happy to help.",
    "Reach out to us anytime and we’ll do our best to point you in the right direction.",
  ],
  secondaryCta: "Contact Us",
} as const;

/* ------------------------------------------------------------------ */
/* Section 11 — Your Journey Starts Here                               */
/* ------------------------------------------------------------------ */

export const FINAL_INVITATION = {
  badge: "BEGIN YOUR JOURNEY",
  heading: BRAND_PROMISE,
  supportingCopy: [
    "Every journey begins with a single step.",
    "Sometimes that step is simply giving yourself permission to pause.",
    "To reflect.",
    "To understand what you’re carrying.",
    "To celebrate how far you’ve already come.",
    "Wherever life has brought you today, we hope Solace becomes a place you can return to again and again—one conversation, one reflection, and one moment of growth at a time.",
  ],
  closingInvitation: "We’d be honored to welcome you.",
  ctaSupportingText:
    "Join our Founding Circle and help shape the future of Solace from the very beginning.",
  secondaryLinks: [
    { label: "Learn More", targetId: SECTION_IDS.meetSolace, href: null },
    { label: "Contact Us", targetId: null, href: CONTACT_HREF },
    { label: "Privacy & Safety", targetId: null, href: "/privacy" },
  ],
  closingLine: [
    "Thank you for taking the time to learn about Solace.",
    "We look forward to beginning this journey together.",
  ],
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
