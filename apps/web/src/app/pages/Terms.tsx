import { Link } from "react-router";
import { motion } from "motion/react";
import {
  FileText,
  Calendar,
  Twitter,
  Instagram,
  Facebook,
  Youtube,
} from "lucide-react";
import { PublicNav } from "../components/PublicNav";
import { BrandLogo } from "../components/BrandLogo";
import { LandingBackground } from "../landing/LandingBackground";
import { LANDING_HERO_BG } from "../landing/landingImagery";
import { cn } from "@/lib/utils";

type TermsIconVisual =
  | "shieldCheck"
  | "starBadge"
  | "userSilhouette"
  | "lock"
  | "creditCard"
  | "copyright"
  | "warning"
  | "refresh"
  | "envelope";

type AccentTone =
  | "pink"
  | "purple"
  | "blue"
  | "cyan"
  | "amber"
  | "violet"
  | "gold"
  | "electric"
  | "magenta";

interface TermsSection {
  number: number;
  title: string;
  body: string;
  tone: AccentTone;
  visual: TermsIconVisual;
  emailHighlight?: string;
}

const SECTIONS: TermsSection[] = [
  {
    number: 1,
    title: "Acceptance of Terms",
    body: "By accessing or using Solace, you agree to be bound by these Terms & Conditions. If you disagree with any part of these terms, you may not access the service.",
    tone: "pink",
    visual: "shieldCheck",
  },
  {
    number: 2,
    title: "Description of Service",
    body: "Solace provides an AI-powered wellness companion platform offering video sessions, mood tracking, journaling, and wellness tools. This service is not a substitute for professional medical or mental health services.",
    tone: "purple",
    visual: "starBadge",
  },
  {
    number: 3,
    title: "User Responsibilities",
    body: "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 18 years old to use this service.",
    tone: "blue",
    visual: "userSilhouette",
  },
  {
    number: 4,
    title: "Privacy & Data",
    body: "Your use of Solace is also governed by our Privacy Policy. We collect and process personal data in accordance with applicable privacy laws and regulations.",
    tone: "cyan",
    visual: "lock",
  },
  {
    number: 5,
    title: "Subscription & Payment",
    body: "Solace offers a 7-day trial period. After the trial, your subscription will automatically renew unless cancelled. You may cancel at any time through your account settings.",
    tone: "amber",
    visual: "creditCard",
  },
  {
    number: 6,
    title: "Intellectual Property",
    body: "All content, features, and functionality of Solace are owned by us and are protected by international copyright, trademark, and other intellectual property laws.",
    tone: "violet",
    visual: "copyright",
  },
  {
    number: 7,
    title: "Limitation of Liability",
    body: 'Solace is provided "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.',
    tone: "gold",
    visual: "warning",
  },
  {
    number: 8,
    title: "Changes to Terms",
    body: "We reserve the right to modify these terms at any time. We will notify users of any material changes via email or through the service.",
    tone: "electric",
    visual: "refresh",
  },
  {
    number: 9,
    title: "Contact Us",
    body: "If you have any questions about these Terms & Conditions, please contact us at support@solace.com",
    tone: "magenta",
    visual: "envelope",
    emailHighlight: "support@solace.com",
  },
];

const TONE: Record<
  AccentTone,
  {
    border: string;
    borderHover: string;
    shadowRgb: string;
    bubbleBorder: string;
    bubbleNum: string;
    iconStroke: string;
  }
> = {
  pink: {
    border: "border-pink-400/28",
    borderHover: "group-hover:border-pink-400/38",
    shadowRgb: "236, 72, 153",
    bubbleBorder: "border-pink-400/40",
    bubbleNum: "text-pink-200",
    iconStroke: "rgba(244, 114, 182, 0.58)",
  },
  purple: {
    border: "border-violet-400/28",
    borderHover: "group-hover:border-violet-400/38",
    shadowRgb: "168, 85, 247",
    bubbleBorder: "border-violet-400/40",
    bubbleNum: "text-violet-200",
    iconStroke: "rgba(196, 181, 253, 0.58)",
  },
  blue: {
    border: "border-blue-400/28",
    borderHover: "group-hover:border-blue-400/38",
    shadowRgb: "96, 165, 250",
    bubbleBorder: "border-blue-400/40",
    bubbleNum: "text-blue-200",
    iconStroke: "rgba(147, 197, 253, 0.58)",
  },
  cyan: {
    border: "border-cyan-400/28",
    borderHover: "group-hover:border-cyan-400/38",
    shadowRgb: "34, 211, 238",
    bubbleBorder: "border-cyan-400/40",
    bubbleNum: "text-cyan-200",
    iconStroke: "rgba(103, 232, 249, 0.58)",
  },
  amber: {
    border: "border-amber-400/28",
    borderHover: "group-hover:border-amber-400/38",
    shadowRgb: "251, 191, 36",
    bubbleBorder: "border-amber-400/40",
    bubbleNum: "text-amber-200",
    iconStroke: "rgba(252, 211, 77, 0.56)",
  },
  violet: {
    border: "border-indigo-400/28",
    borderHover: "group-hover:border-indigo-400/38",
    shadowRgb: "129, 140, 248",
    bubbleBorder: "border-indigo-400/40",
    bubbleNum: "text-indigo-200",
    iconStroke: "rgba(165, 180, 252, 0.58)",
  },
  gold: {
    border: "border-yellow-500/26",
    borderHover: "group-hover:border-yellow-500/36",
    shadowRgb: "234, 179, 8",
    bubbleBorder: "border-yellow-500/38",
    bubbleNum: "text-yellow-200",
    iconStroke: "rgba(250, 204, 21, 0.56)",
  },
  electric: {
    border: "border-sky-400/28",
    borderHover: "group-hover:border-sky-400/38",
    shadowRgb: "56, 189, 248",
    bubbleBorder: "border-sky-400/40",
    bubbleNum: "text-sky-200",
    iconStroke: "rgba(125, 211, 252, 0.58)",
  },
  magenta: {
    border: "border-fuchsia-400/28",
    borderHover: "group-hover:border-fuchsia-400/38",
    shadowRgb: "232, 121, 249",
    bubbleBorder: "border-fuchsia-400/40",
    bubbleNum: "text-fuchsia-200",
    iconStroke: "rgba(240, 171, 252, 0.58)",
  },
};

function TermsAccentSymbol({
  visual,
  stroke,
  className,
}: {
  visual: TermsIconVisual;
  stroke: string;
  className?: string;
}) {
  const sw = 1.35;
  const base = cn(
    "opacity-[0.5] transition-[opacity,filter] duration-500 group-hover:opacity-[0.68] group-hover:drop-shadow-[0_0_14px_rgba(255,255,255,0.08)]",
    className,
  );

  return (
    <svg viewBox="0 0 64 64" className={cn("h-14 w-14 sm:h-16 sm:w-16", base)} fill="none" aria-hidden>
      {visual === "shieldCheck" && (
        <>
          <path
            d="M32 10 L52 18 V34 C52 46 42 54 32 58 C22 54 12 46 12 34 V18 Z"
            stroke={stroke}
            strokeWidth={sw}
          />
          <path d="M24 34 L29 39 L40 28" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {visual === "starBadge" && (
        <path
          d="M32 14 L35 26 L48 26 L38 34 L41 48 L32 40 L23 48 L26 34 L16 26 L29 26 Z"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      )}
      {visual === "userSilhouette" && (
        <>
          <circle cx="32" cy="22" r="8" stroke={stroke} strokeWidth={sw} />
          <path d="M16 52 C16 40 22 34 32 34 C42 34 48 40 48 52" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </>
      )}
      {visual === "lock" && (
        <>
          <rect x="22" y="30" width="20" height="18" rx="3" stroke={stroke} strokeWidth={sw} />
          <path d="M26 30 V24 C26 19 28 16 32 16 C36 16 38 19 38 24 V30" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </>
      )}
      {visual === "creditCard" && (
        <>
          <rect x="12" y="22" width="40" height="26" rx="4" stroke={stroke} strokeWidth={sw} />
          <path d="M12 30 H52" stroke={stroke} strokeWidth={sw} opacity="0.7" />
        </>
      )}
      {visual === "copyright" && (
        <>
          <circle cx="32" cy="32" r="16" stroke={stroke} strokeWidth={sw} />
          <text x="32" y="37" textAnchor="middle" fill={stroke} fontSize="14" fontWeight="500">
            ©
          </text>
        </>
      )}
      {visual === "warning" && (
        <>
          <path d="M32 14 L50 50 H14 Z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M32 26 V36" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <circle cx="32" cy="42" r="1.2" fill={stroke} />
        </>
      )}
      {visual === "refresh" && (
        <>
          <path d="M44 22 C40 16 34 13 27 14 C18 16 12 24 12 32" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <path d="M40 16 L44 22 L38 24" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 42 C24 48 30 51 37 50 C46 48 52 40 52 32" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <path d="M24 48 L20 42 L26 40" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {visual === "envelope" && (
        <>
          <rect x="12" y="20" width="40" height="26" rx="3" stroke={stroke} strokeWidth={sw} />
          <path d="M12 24 L32 38 L52 24" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

interface TermsSectionCardProps {
  section: TermsSection;
  index: number;
}

function TermsSectionCard({ section, index }: TermsSectionCardProps) {
  const tone = TONE[section.tone];

  const bodyContent = section.emailHighlight ? (
    <>
      If you have any questions about these Terms & Conditions, please contact us at{" "}
      <span className="font-medium text-[#f472b8]/95">{section.emailHighlight}</span>
    </>
  ) : (
    section.body
  );

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: index * 0.04, duration: 0.4 }}
      className={cn(
        "group relative min-h-[124px] rounded-[24px] border bg-[rgba(8,10,25,0.72)] backdrop-blur-[20px] transition-[transform,box-shadow,border-color] duration-300 ease-out",
        tone.border,
        tone.borderHover,
        "hover:-translate-y-0.5",
      )}
      style={{
        boxShadow: `0 4px 32px -12px rgba(0,0,0,0.55), 0 0 34px rgba(${tone.shadowRgb}, 0.13), inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 6px 36px -10px rgba(0,0,0,0.58), 0 0 42px rgba(${tone.shadowRgb}, 0.18), inset 0 1px 0 rgba(255,255,255,0.07)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = `0 4px 32px -12px rgba(0,0,0,0.55), 0 0 34px rgba(${tone.shadowRgb}, 0.13), inset 0 1px 0 rgba(255,255,255,0.05)`;
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-75 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(ellipse 42% 70% at 8% 50%, rgba(${tone.shadowRgb}, 0.1) 0%, transparent 58%), radial-gradient(ellipse 36% 65% at 94% 50%, rgba(${tone.shadowRgb}, 0.09) 0%, transparent 55%)`,
        }}
        aria-hidden
      />
      <div className="relative z-[1] grid min-h-[124px] grid-cols-1 items-center gap-5 px-6 py-6 sm:grid-cols-[72px_1fr_88px] sm:gap-7 sm:px-8 sm:py-7 md:min-h-[132px] md:grid-cols-[76px_1fr_96px] md:gap-8 md:px-9">
        <div className="relative shrink-0 self-start sm:self-center">
          <motion.div
            className="absolute -inset-1.5 rounded-full opacity-[0.55] blur-md transition-opacity duration-300 group-hover:opacity-[0.85]"
            style={{
              background: `radial-gradient(circle, rgba(${tone.shadowRgb}, 0.32) 0%, transparent 72%)`,
            }}
            aria-hidden
          />
          <div
            className={cn(
              "relative flex h-[60px] w-[60px] items-center justify-center rounded-full border bg-[rgba(6,8,22,0.65)] text-xl font-semibold backdrop-blur-sm transition-[box-shadow,border-color] duration-300 sm:h-[64px] sm:w-[64px] sm:text-[1.35rem]",
              tone.bubbleBorder,
              tone.bubbleNum,
            )}
            style={{
              boxShadow: `0 0 22px rgba(${tone.shadowRgb}, 0.18), inset 0 0 16px rgba(${tone.shadowRgb}, 0.1)`,
            }}
            aria-hidden
          >
            {section.number}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-2.5 flex items-start justify-between gap-4 sm:mb-3">
            <h2 className="text-lg font-semibold leading-snug text-white sm:text-[1.2rem]">
              {section.title}
            </h2>
            <div className="relative shrink-0 sm:hidden" aria-hidden>
              <div
                className="absolute inset-0 rounded-full opacity-45 blur-lg transition-opacity duration-300 group-hover:opacity-70"
                style={{
                  background: `radial-gradient(circle, rgba(${tone.shadowRgb}, 0.28) 0%, transparent 70%)`,
                }}
              />
              <TermsAccentSymbol
                visual={section.visual}
                stroke={tone.iconStroke}
                className="relative h-12 w-12"
              />
            </div>
          </div>
          <p className="text-[0.9375rem] leading-[1.7] text-white/62 sm:text-base">{bodyContent}</p>
        </div>

        <div className="relative hidden items-center justify-end sm:flex" aria-hidden>
          <div
            className="absolute inset-0 rounded-full opacity-45 blur-lg transition-opacity duration-300 group-hover:opacity-70"
            style={{
              background: `radial-gradient(circle, rgba(${tone.shadowRgb}, 0.28) 0%, transparent 70%)`,
            }}
          />
          <TermsAccentSymbol visual={section.visual} stroke={tone.iconStroke} className="relative" />
        </div>
      </div>
    </motion.article>
  );
}

export function Terms() {
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
          className="absolute inset-0 h-full w-full scale-[1.02] object-cover object-[center_40%] opacity-[0.22] blur-[1.5px]"
          width={2400}
          height={1350}
        />
        <motion.div className="absolute inset-0 bg-[rgba(5,8,20,0.52)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_12%,rgba(88,28,135,0.14)_0%,transparent_62%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_18%,rgba(236,72,153,0.06)_0%,transparent_58%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_38%_42%_at_8%_52%,rgba(251,191,36,0.08)_0%,transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_38%_42%_at_92%_52%,rgba(251,191,36,0.07)_0%,transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_130%_95%_at_50%_50%,transparent_38%,rgba(4,6,16,0.55)_82%,rgba(3,5,14,0.88)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,20,0.35)_0%,rgba(5,8,20,0.62)_50%,rgba(4,6,14,0.88)_100%)]" />
      </div>

      <div className="relative z-10">
        <PublicNav variant="cinematic" />

        <main className="mx-auto w-full max-w-[1180px] px-5 pb-20 pt-14 sm:px-8 sm:pt-16 lg:px-10 lg:pb-24">
          <section className="relative mx-auto mb-14 max-w-3xl text-center sm:mb-16 md:mb-[4.5rem]">
            <div
              className="pointer-events-none absolute left-1/2 top-0 h-48 w-[min(100%,32rem)] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.12)_0%,transparent_72%)] blur-3xl"
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="relative"
            >
              <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-2xl border border-pink-400/25 bg-[rgba(12,10,28,0.55)] shadow-[0_0_24px_rgba(236,72,153,0.14)] backdrop-blur-md sm:h-[5.25rem] sm:w-[5.25rem]">
                <FileText className="h-9 w-9 text-pink-200/90 sm:h-10 sm:w-10" strokeWidth={1.5} />
              </div>
              <h1 className="landing-serif mb-6 text-[2.5rem] font-semibold leading-[1.1] tracking-tight text-white sm:text-[3.25rem] md:text-[3.5rem]">
                Terms &{" "}
                <span className="text-[#f472b8] drop-shadow-[0_0_22px_rgba(244,114,182,0.22)]">
                  Conditions
                </span>
              </h1>
              {/* <motion.div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/60 backdrop-blur-md">
                <Calendar className="h-3.5 w-3.5 text-white/45" strokeWidth={1.5} />
                Last updated: December 29, 2024
              </motion.div> */}
            </motion.div>
          </section>

          <motion.div
            className="flex flex-col gap-5 sm:gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.08 }}
          >
            {SECTIONS.map((section, index) => (
              <TermsSectionCard key={section.title} section={section} index={index} />
            ))}
          </motion.div>
        </main>

        <footer className="border-t border-white/[0.06] bg-[#04060f]/90">
          <div className="pointer-events-none mx-auto h-px max-w-7xl bg-gradient-to-r from-transparent via-violet-500/25 to-transparent" />
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-12 lg:px-8">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              <div className="col-span-2 md:col-span-1">
                <BrandLogo heightClass="h-14" />
                <p className="mt-3 text-sm text-[var(--solace-ds-text-muted)]">
                  Your AI-powered wellness companion, available 24/7
                </p>
                <div className="mt-4 flex gap-2.5">
                  {[
                    { Icon: Twitter, label: "Twitter" },
                    { Icon: Instagram, label: "Instagram" },
                    { Icon: Facebook, label: "Facebook" },
                    { Icon: Youtube, label: "YouTube" },
                  ].map(({ Icon, label }) => (
                    <span
                      key={label}
                      className="flex h-8 w-8 cursor-default items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-white/50 transition-colors hover:border-white/12 hover:text-white/75"
                      aria-label={label}
                      role="img"
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-semibold text-white/90">Product</h4>
                <ul className="space-y-1.5 text-sm text-[var(--solace-ds-text-muted)]">
                  <li>
                    <Link to="/how-it-works" className="hover:text-white/90">
                      How It Works
                    </Link>
                  </li>
                  <li>
                    <Link to="/pricing" className="hover:text-white/90">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link to="/privacy" className="hover:text-white/90">
                      Privacy &amp; Safety
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-semibold text-white/90">Legal</h4>
                <ul className="space-y-1.5 text-sm text-[var(--solace-ds-text-muted)]">
                  <li>
                    <Link
                      to="/terms"
                      className="font-medium text-pink-300/85 hover:text-pink-200/90"
                      aria-current="page"
                    >
                      Terms &amp; Conditions
                    </Link>
                  </li>
                  <li>
                    <Link to="/privacy" className="hover:text-white/90">
                      Privacy Policy
                    </Link>
                  </li>
                </ul>
              </div>

              <motion.div>
                <h4 className="mb-3 text-sm font-semibold text-white/90">Get Started</h4>
                <ul className="space-y-1.5 text-sm text-[var(--solace-ds-text-muted)]">
                  <li>
                    <Link to="/signup" className="hover:text-white/90">
                      Sign Up
                    </Link>
                  </li>
                  <li>
                    <Link to="/login" className="hover:text-white/90">
                      Log In
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/admin/credentials"
                      className="font-semibold text-violet-300/85 hover:text-violet-200/90"
                    >
                      Admin Credentials
                    </Link>
                  </li>
                  <li>
                    <Link to="/admin/login" className="text-violet-300/80 hover:text-violet-200/90">
                      Admin Portal
                    </Link>
                  </li>
                </ul>
              </motion.div>
            </div>

            <div className="mt-8 border-t border-white/[0.05] pt-6 text-center text-xs text-[var(--solace-ds-text-muted)] sm:text-sm">
              <p>&copy; 2024 Solace. All rights reserved.</p>
              <p className="mt-1.5 opacity-90">
                This is not a replacement for professional medical or mental health services.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </motion.div>
  );
}
