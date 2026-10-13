import type { PublicAuthorityPageProps } from "@/app/components/PublicAuthorityPage";

export const ABOUT_CONTENT: PublicAuthorityPageProps = {
  eyebrow: "About Solace",
  title: "About Solace",
  lead: "Solace is an AI-assisted conversation experience for people who want somewhere to talk through what is on their mind and reflect at their own pace.",
  summary: "Solace was created to make space for honest reflection in everyday life.",
  notice: {
    title: "Clear boundaries matter",
    body: "It is designed for everyday reflection. Solace is not therapy, medical care, diagnosis, treatment, or emergency support.",
  },
  sections: [
    {
      title: "A place to begin",
      paragraphs: [
        "You do not need a polished explanation or a perfectly formed question to begin. Solace is designed to give everyday thoughts, decisions, worries, and feelings somewhere to go.",
        "The experience centers conversation and reflection. You can start with what is on your mind, use your own words, and move at your own pace.",
      ],
      glow: "pink",
    },
    {
      title: "Why Solace exists",
      paragraphs: [
        "Solace was created to make space for honest reflection in everyday life.",
        "Its purpose is to offer a structured conversation experience for moments when speaking a thought aloud may help you examine it more clearly. It does not promise a particular result and it does not replace support from qualified professionals.",
      ],
      glow: "purple",
    },
    {
      title: "Founded by Rosalind Mitchell",
      paragraphs: [
        "Rosalind Mitchell is the Founder of Solace.",
        "This page intentionally limits that introduction to the verified founder identity. It does not make claims about credentials, clinical experience, company history, awards, partners, or certifications.",
      ],
      glow: "blue",
    },
    {
      title: "What Solace is — and is not",
      paragraphs: [
        "Solace is an AI-assisted product for conversation and reflection. AI responses may be incomplete or inaccurate, so the experience should be used with appropriate judgment.",
      ],
      points: [
        "Not therapy or professional mental-health care.",
        "Not medical care, diagnosis, or treatment.",
        "Not an emergency or crisis-support service.",
      ],
      links: [
        { href: "/safety", label: "Read about safety" },
        { href: "/how-it-works", label: "See how Solace works" },
      ],
      glow: "green",
    },
  ],
  cta: {
    title: "Start with the experience at the heart of Solace",
    body: "Learn how Talk It Out creates room to begin in your own words while keeping the product’s boundaries clear.",
    links: [{ href: "/talk-it-out", label: "Explore Talk It Out", primary: true }],
  },
};
