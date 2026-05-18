import { Link } from "react-router";
import { motion } from "motion/react";
import {
  Shield,
  Lock,
  Heart,
  Accessibility,
  Info,
  Twitter,
  Instagram,
  Facebook,
  Youtube,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PublicNav } from "../components/PublicNav";
import { BrandLogo } from "../components/BrandLogo";
import { LandingBackground } from "../landing/LandingBackground";
import { LANDING_HERO_BG } from "../landing/landingImagery";
import {
  PRIVACY_HOLOGRAM_ACCESSIBILITY,
  PRIVACY_HOLOGRAM_SAFETY,
  PRIVACY_HOLOGRAM_SHIELD,
} from "../landing/privacyImagery";
import { cn } from "@/lib/utils";

type AccentTone = "pink" | "cyan" | "purple";

interface PrivacySection {
  title: string;
  description: string;
  bullets: string[];
  icon: LucideIcon;
  tone: AccentTone;
  hologramSrc: string;
  hologramAlt: string;
  importantNote?: string;
}

const SECTIONS: PrivacySection[] = [
  {
    title: "Privacy & Security",
    description:
      "At Solace, we take your privacy seriously. All conversations are encrypted end-to-end, and your personal data is protected with industry-standard security measures.",
    bullets: [
      "End-to-end encryption for all sessions",
      "HIPAA-compliant data storage",
      "No third-party data sharing without your consent",
      "Regular security audits and updates",
      "You control your data and can delete it anytime",
    ],
    icon: Lock,
    tone: "pink",
    hologramSrc: PRIVACY_HOLOGRAM_SHIELD,
    hologramAlt: "Glowing holographic shield protecting your data",
  },
  {
    title: "Safety Features",
    description:
      "Your safety is paramount. Solace includes several features to ensure you get the help you need:",
    bullets: [
      "Emergency detection and immediate resource provision",
      "Emergency contact integration",
      "24/7 access to emergency and mental-health hotlines",
      "Content moderation and safety protocols",
      "Option to pause or end sessions anytime",
    ],
    icon: Heart,
    tone: "cyan",
    hologramSrc: PRIVACY_HOLOGRAM_SAFETY,
    hologramAlt: "Glowing hands gently holding a heart of light",
    importantNote:
      "Important: Solace is not a replacement for professional medical or mental health services. In case of emergency, please call 911 or your local emergency services.",
  },
  {
    title: "Accessibility",
    description: "We're committed to making Solace accessible to everyone:",
    bullets: [
      "Screen reader compatibility",
      "Keyboard navigation support",
      "Adjustable text sizes and contrast",
      "Closed captions for video sessions",
      "Multiple language support",
    ],
    icon: Accessibility,
    tone: "purple",
    hologramSrc: PRIVACY_HOLOGRAM_ACCESSIBILITY,
    hologramAlt: "Accessibility hologram with captions, text, and language indicators",
  },
];

const TONE: Record<
  AccentTone,
  {
    border: string;
    borderHover: string;
    shadowRgb: string;
    iconBorder: string;
    iconGlow: string;
    iconColor: string;
    bullet: string;
    hologramWash: string;
  }
> = {
  pink: {
    border: "border-pink-400/26",
    borderHover: "group-hover:border-pink-400/38",
    shadowRgb: "236, 72, 153",
    iconBorder: "border-pink-400/28",
    iconGlow: "shadow-[0_0_22px_rgba(236,72,153,0.22)]",
    iconColor: "text-pink-200/90",
    bullet: "bg-pink-300/90 shadow-[0_0_6px_rgba(236,72,153,0.55)]",
    hologramWash: "rgba(236, 72, 153, 0.14)",
  },
  cyan: {
    border: "border-cyan-400/24",
    borderHover: "group-hover:border-cyan-400/36",
    shadowRgb: "34, 211, 238",
    iconBorder: "border-cyan-400/26",
    iconGlow: "shadow-[0_0_22px_rgba(34,211,238,0.2)]",
    iconColor: "text-cyan-200/90",
    bullet: "bg-cyan-300/90 shadow-[0_0_6px_rgba(34,211,238,0.5)]",
    hologramWash: "rgba(34, 211, 238, 0.12)",
  },
  purple: {
    border: "border-violet-400/26",
    borderHover: "group-hover:border-violet-400/38",
    shadowRgb: "168, 85, 247",
    iconBorder: "border-violet-400/28",
    iconGlow: "shadow-[0_0_22px_rgba(168,85,247,0.22)]",
    iconColor: "text-violet-200/90",
    bullet: "bg-violet-300/90 shadow-[0_0_6px_rgba(168,85,247,0.5)]",
    hologramWash: "rgba(168, 85, 247, 0.13)",
  },
};

function HologramArt({
  src,
  alt,
  tone,
}: {
  src: string;
  alt: string;
  tone: AccentTone;
}) {
  const t = TONE[tone];

  return (
    <div
      className="relative flex min-h-[240px] w-full items-center justify-center md:min-h-[300px] lg:min-h-[320px]"
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background: `radial-gradient(ellipse 75% 70% at 50% 50%, ${t.hologramWash} 0%, transparent 72%)`,
        }}
        aria-hidden
      />
      <motion.img
        src={src}
        alt={alt}
        width={640}
        height={640}
        className="relative z-[1] h-auto w-full max-w-[min(440px,100%)] object-contain object-center"
        loading="lazy"
        decoding="async"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

interface PrivacySectionCardProps {
  section: PrivacySection;
  index: number;
}

function PrivacySectionCard({ section, index }: PrivacySectionCardProps) {
  const tone = TONE[section.tone];
  const Icon = section.icon;

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-48px" }}
      transition={{ delay: index * 0.06, duration: 0.45 }}
      className={cn(
        "group relative min-h-[320px] overflow-hidden rounded-[32px] border bg-[rgba(8,10,26,0.48)] backdrop-blur-[16px] transition-[transform,box-shadow,border-color] duration-400 ease-out md:min-h-[360px]",
        tone.border,
        tone.borderHover,
        "hover:-translate-y-0.5",
      )}
      style={{
        boxShadow: `0 8px 48px -16px rgba(0,0,0,0.55), 0 0 40px rgba(${tone.shadowRgb}, 0.14), inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 12px 56px -14px rgba(0,0,0,0.58), 0 0 52px rgba(${tone.shadowRgb}, 0.2), inset 0 1px 0 rgba(255,255,255,0.08)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = `0 8px 48px -16px rgba(0,0,0,0.55), 0 0 40px rgba(${tone.shadowRgb}, 0.14), inset 0 1px 0 rgba(255,255,255,0.06)`;
      }}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-90 transition-opacity duration-400 group-hover:opacity-100"
        style={{
          background: `radial-gradient(ellipse 48% 55% at 6% 8%, rgba(${tone.shadowRgb}, 0.11) 0%, transparent 58%), radial-gradient(ellipse 40% 50% at 96% 88%, rgba(${tone.shadowRgb}, 0.07) 0%, transparent 55%)`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent"
        aria-hidden
      />

      <motion.div className="relative z-[1] flex flex-col gap-10 p-10 sm:p-12 md:gap-12 md:p-14 lg:flex-row lg:items-stretch lg:gap-14 lg:p-16">
        <div className="flex min-w-0 flex-[1.5] flex-col">
          <div
            className={cn(
              "mb-7 flex h-[52px] w-[52px] items-center justify-center rounded-xl border bg-[rgba(6,8,22,0.55)] backdrop-blur-sm",
              tone.iconBorder,
              tone.iconGlow,
            )}
          >
            <Icon className={cn("h-6 w-6", tone.iconColor)} strokeWidth={1.65} />
          </div>

          <h2 className="landing-serif mb-4 text-[1.65rem] font-semibold leading-snug text-white sm:text-[1.85rem] md:text-[2rem]">
            {section.title}
          </h2>
          <p className="mb-7 max-w-xl text-[0.9375rem] leading-[1.75] text-white/62 sm:text-base">
            {section.description}
          </p>

          <ul className="space-y-3.5 text-[0.9375rem] leading-relaxed text-white/72 sm:text-[15px]">
            {section.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3.5">
                <span
                  className={cn("mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full", tone.bullet)}
                />
                {bullet}
              </li>
            ))}
          </ul>

          {section.importantNote ? (
            <div className="mt-8 flex gap-3.5 rounded-xl border border-cyan-400/22 bg-[rgba(6,14,22,0.62)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_28px_-8px_rgba(34,211,238,0.22)]">
              <Info
                className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200/85"
                strokeWidth={1.65}
                aria-hidden
              />
              <p className="text-sm leading-[1.7] text-cyan-50/78">{section.importantNote}</p>
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center lg:max-w-[42%]">
          <HologramArt src={section.hologramSrc} alt={section.hologramAlt} tone={section.tone} />
        </div>
      </motion.div>
    </motion.article>
  );
}

export function Privacy() {
  return (
    <motion.div
      className="solace-landing relative min-h-screen overflow-x-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <LandingBackground />

      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <img
          src={LANDING_HERO_BG}
          alt=""
          className="absolute inset-0 h-full w-full scale-[1.02] object-cover object-[center_42%] opacity-[0.24] blur-[0.5px]"
          width={2400}
          height={1350}
        />
        <div className="absolute inset-0 bg-[rgba(5,8,20,0.48)]" />
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(ellipse_75%_48%_at_50%_8%,rgba(88,28,135,0.16)_0%,transparent_58%)]"
          animate={{ opacity: [0.88, 1, 0.88] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(ellipse_36%_40%_at_6%_52%,rgba(251,191,36,0.1)_0%,transparent_52%)]"
          animate={{ opacity: [0.7, 0.95, 0.7] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(ellipse_36%_40%_at_94%_52%,rgba(251,191,36,0.09)_0%,transparent_52%)]"
          animate={{ opacity: [0.65, 0.9, 0.65] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_90%_at_50%_50%,transparent_42%,rgba(4,6,16,0.42)_78%,rgba(3,5,14,0.72)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,20,0.28)_0%,rgba(5,8,20,0.52)_48%,rgba(4,6,14,0.78)_100%)]" />
      </div>

      <div className="relative z-10">
        <PublicNav variant="cinematic" />

        <main className="mx-auto w-full max-w-[1380px] px-5 pb-20 pt-14 sm:px-8 sm:pt-16 lg:px-10 lg:pb-24">
          <section className="relative mx-auto mb-14 max-w-3xl text-center sm:mb-16 md:mb-[4.5rem]">
            <div
              className="pointer-events-none absolute left-1/2 top-2 h-44 w-[min(100%,28rem)] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.1)_0%,transparent_72%)] blur-3xl"
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="relative"
            >
              <div className="mx-auto mb-7 flex h-14 w-14 items-center justify-center rounded-xl border border-cyan-400/22 bg-[rgba(8,12,24,0.5)] shadow-[0_0_20px_rgba(34,211,238,0.14)] backdrop-blur-md sm:h-[3.75rem] sm:w-[3.75rem]">
                <Shield className="h-7 w-7 text-cyan-200/90" strokeWidth={1.55} />
              </div>
              <h1 className="landing-serif mb-5 text-[2.35rem] font-semibold leading-[1.12] tracking-tight text-white sm:text-[2.85rem] md:text-[3.25rem]">
                Privacy,{" "}
                <span className="text-[#f4a4c8] drop-shadow-[0_0_20px_rgba(244,164,200,0.18)]">
                  Safety &amp; Accessibility
                </span>
              </h1>
              <p className="mx-auto max-w-xl text-base leading-relaxed text-white/58 sm:text-[1.05rem]">
                Your privacy and safety are our top priorities
              </p>
            </motion.div>
          </section>

          <motion.div
            className="flex flex-col gap-10 sm:gap-11"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.08 }}
          >
            {SECTIONS.map((section, index) => (
              <PrivacySectionCard key={section.title} section={section} index={index} />
            ))}
          </motion.div>
        </main>

        <footer className="relative border-t border-white/[0.06]">
          <div className="pointer-events-none mx-auto h-px max-w-[1380px] bg-gradient-to-r from-transparent via-violet-500/22 to-transparent" />
          <div className="mx-auto max-w-[1380px] px-5 py-12 sm:px-8 md:py-14 lg:px-10">
            <motion.div className="grid grid-cols-2 gap-10 md:grid-cols-4 md:gap-8">
              <div className="col-span-2 md:col-span-1">
                <BrandLogo heightClass="h-14" />
                <p className="mt-3 text-sm leading-relaxed text-white/52">
                  Your AI-powered wellness companion, available 24/7
                </p>
                <div className="mt-5 flex gap-2.5">
                  {[
                    { Icon: Twitter, label: "Twitter" },
                    { Icon: Instagram, label: "Instagram" },
                    { Icon: Facebook, label: "Facebook" },
                    { Icon: Youtube, label: "YouTube" },
                  ].map(({ Icon, label }) => (
                    <span
                      key={label}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-white/48 transition-colors hover:border-white/14 hover:text-white/80"
                      aria-label={label}
                      role="img"
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-semibold text-white/92">Product</h4>
                <ul className="space-y-2 text-sm text-white/52">
                  <li>
                    <Link to="/how-it-works" className="transition-colors hover:text-white/88">
                      How It Works
                    </Link>
                  </li>
                  <li>
                    <Link to="/pricing" className="transition-colors hover:text-white/88">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/privacy"
                      className="font-medium text-[#f4a4c8] transition-colors hover:text-[#f8bdd6]"
                    >
                      Privacy &amp; Safety
                    </Link>
                  </li>
                  {/* <li>
                    <Link to="/accessibility" className="transition-colors hover:text-white/88">
                      Accessibility
                    </Link>
                  </li> */}
                </ul>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-semibold text-white/92">Legal</h4>
                <ul className="space-y-2 text-sm text-white/52">
                  <li>
                    <Link to="/terms" className="transition-colors hover:text-white/88">
                      Terms &amp; Conditions
                    </Link>
                  </li>
                  <li>
                    <Link to="/privacy" className="transition-colors hover:text-white/88">
                      Privacy Policy
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-semibold text-white/92">Get Started</h4>
                <ul className="space-y-2 text-sm text-white/52">
                  <li>
                    <Link to="/signup" className="transition-colors hover:text-white/88">
                      Sign Up
                    </Link>
                  </li>
                  <li>
                    <Link to="/login" className="transition-colors hover:text-white/88">
                      Log In
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/admin/credentials"
                      className="font-medium text-violet-300/90 transition-colors hover:text-violet-200"
                    >
                      Admin Credentials
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/admin/login"
                      className="text-violet-300/80 transition-colors hover:text-violet-200"
                    >
                      Admin Portal
                    </Link>
                  </li>
                </ul>
              </div>
            </motion.div>

            <div className="mt-10 border-t border-white/[0.05] pt-7 text-center text-xs text-white/45 sm:text-sm">
              <p>&copy; 2024 Solace. All rights reserved.</p>
              <p className="mt-2 leading-relaxed">
                This is not a replacement for professional medical or mental health services.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </motion.div>
  );
}
