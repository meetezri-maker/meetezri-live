import type { PublicAuthorityPageProps } from "@/app/components/PublicAuthorityPage";

export const TALK_IT_OUT_CONTENT: PublicAuthorityPageProps = {
  eyebrow: "The conversation experience at the heart of Solace",
  title: "Talk It Out",
  lead: "Talk It Out gives you somewhere to start when a thought, feeling, decision, or everyday concern has been circling in your mind.",
  summary: "You do not need the perfect words. Begin with what is on your mind, speak naturally, and reflect at your own pace.",
  heroImage: {
    src: "/talk-it-out/talk-it-out.jpg",
    alt: "A calm space representing the Talk It Out conversation experience",
  },
  notice: {
    title: "A conversation product, not professional care",
    body: "Talk It Out is designed for everyday reflection. It is not therapy, medical care, diagnosis, treatment, crisis support, or emergency support.",
  },
  sections: [
    {
      title: "Start where you are",
      paragraphs: [
        "You can begin with a single thought, a question, something that happened during the day, or a feeling you have not yet put into words. There is no script and no requirement to explain everything at once.",
        "Talk It Out is an AI-assisted experience. It is built to support a conversation, not to make decisions for you or claim certainty about what you should do.",
      ],
      glow: "pink",
    },
    {
      title: "Speak in your own words",
      paragraphs: [
        "The experience is intended to let you express as much or as little as you choose. You can take the conversation one step at a time rather than arriving with a completed explanation.",
        "AI responses may be incomplete or inaccurate. Use your own judgment, especially for important personal, medical, financial, legal, or safety decisions.",
      ],
      glow: "purple",
    },
    {
      title: "Make room for reflection",
      paragraphs: [
        "Putting a thought into words can create an opportunity to examine it from another angle. Talk It Out keeps the focus on conversation and reflection rather than promising a particular emotional, clinical, or wellness outcome.",
        "The public page explains the experience without exposing the private member interface, account data, session history, or authenticated conversation tools.",
      ],
      links: [
        { href: "/resources/why-do-i-keep-replaying-conversations-in-my-head", label: "Why conversations can keep replaying" },
        { href: "/resources/how-to-have-an-honest-conversation-with-yourself", label: "A practical approach to self-reflection" },
      ],
      glow: "blue",
    },
    {
      title: "Know when to use another kind of support",
      paragraphs: [
        "Talk It Out cannot provide professional judgment, diagnosis, treatment, or emergency intervention. If you or someone else may be in immediate danger, contact local emergency services now.",
      ],
      points: [
        "Do not rely on AI responses for emergency decisions.",
        "Automated responses can miss or misinterpret language.",
        "Review Solace’s public safety boundaries before using the experience.",
      ],
      links: [{ href: "/safety", label: "Safety and support boundaries" }],
      glow: "green",
    },
  ],
  cta: {
    title: "Ready to see whether Solace feels right for you?",
    body: "Create an account to enter the private member experience, or learn more about how Solace works before you begin.",
    links: [
      { href: "/signup", label: "Get Started", primary: true },
      { href: "/how-it-works", label: "How It Works" },
    ],
  },
};
