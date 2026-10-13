import type { PublicAuthorityPageProps } from "@/app/components/PublicAuthorityPage";

export const SAFETY_CONTENT: PublicAuthorityPageProps = {
  eyebrow: "Product boundaries",
  title: "Safety and Support at Solace",
  lead: "Solace is designed for everyday conversation and reflection, with clear limits on what an AI-assisted experience can provide.",
  summary: "Understanding those limits helps you choose the right kind of support for the moment you are in.",
  notice: {
    title: "If there may be immediate danger",
    body: "If you or someone else may be in immediate danger, contact local emergency services now. Solace cannot contact emergency services for you.",
  },
  sections: [
    {
      title: "What Solace does not provide",
      paragraphs: [
        "Solace is not therapy, medical care, crisis support, diagnosis, or treatment. It cannot assess your circumstances in the way a qualified professional or local emergency service can.",
        "Do not use Solace as the sole source of support for urgent safety concerns, medical questions, medication decisions, or emergencies.",
      ],
      glow: "pink",
    },
    {
      title: "Automated safety responses",
      paragraphs: [
        "Solace may show region-relevant resource links when certain safety concerns are detected or when you open Emergency Resources. These automated responses can miss or misinterpret language and are not a substitute for professional judgment.",
        "Resource availability and details can change. Confirm the appropriate service for your location before relying on a listed resource.",
      ],
      links: [{ href: "/resources", label: "Browse public resources" }],
      glow: "amber",
    },
    {
      title: "AI limitations",
      paragraphs: [
        "AI responses may be incomplete or inaccurate. Do not rely on Solace for diagnosis, treatment, medication decisions, or emergency decisions.",
        "If a response does not fit your situation, stop and seek information or support from a suitable human professional or service.",
      ],
      glow: "purple",
    },
    {
      title: "Conversation content and history",
      paragraphs: [
        "Conversation content may be processed and session transcripts may be stored to provide features such as session history. See the Privacy Policy for the governing details about data processing and retention.",
        "Avoid sharing information you do not want processed as part of the service. Solace does not promise absolute confidentiality or security.",
      ],
      links: [{ href: "/privacy", label: "Read the Privacy Policy" }],
      glow: "blue",
    },
    {
      title: "Available account controls",
      paragraphs: [
        "Signed-in members can use the controls currently available in account settings, including account deletion and the available profile-data export. The product does not currently represent that export as a complete copy of every kind of account data.",
        "The Privacy Policy governs the details and any applicable limitations. No specific backup-deletion or retention period is promised here.",
      ],
      glow: "green",
    },
    {
      title: "Choosing the right support",
      paragraphs: [
        "For everyday reflection, Solace can provide a place to begin a conversation. For professional, medical, or urgent needs, contact a qualified provider, a trusted local service, or emergency services as appropriate.",
        "The in-app support form is available only to authenticated members, so no public support contact is presented on this page.",
      ],
      glow: "purple",
    },
  ],
  cta: {
    title: "Use Solace with its boundaries in view",
    body: "See how the conversation experience works, or review public informational resources without entering the private member application.",
    links: [
      { href: "/how-it-works", label: "How It Works", primary: true },
      { href: "/resources", label: "Resources" },
    ],
  },
};
