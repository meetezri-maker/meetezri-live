import { motion, AnimatePresence } from "motion/react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Flower2,
  Heart,
  HelpCircle,
  Mail,
  MessageCircle,
  Phone,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  AlertCircle,
  FileText,
  Lock,
  Bell,
  Download,
} from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { SOLACE_SUPPORT_CARD_IMG, TALK_ENV_CANDLE } from "@/lib/solace/referenceImagery";

const HERO_IMG = "/community/hero-lake.jpg";
const BANNER_IMG = "/community/scene-water.jpg";
const COMFORT_IMG = TALK_ENV_CANDLE;
const LANTERN_IMG = SOLACE_SUPPORT_CARD_IMG;
const FOREST_IMG = "/community/scene-forest.jpg";
const STARS_IMG = "/community/scene-stars.jpg";

const actionCardShell = cn(
  "group relative isolate flex min-h-[210px] flex-col overflow-hidden rounded-[24px]",
  "border border-white/[0.09]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(168,85,247,0.1),0_24px_64px_-32px_rgba(0,0,0,0.88),0_0_40px_-24px_rgba(109,40,217,0.22)]",
  "transition-all duration-500 hover:-translate-y-0.5"
);

/** Premium glass surface — translucent, glowing edges, depth */
export const glassPanel = cn(
  "relative overflow-hidden rounded-[24px]",
  "border border-white/[0.09]",
  "bg-[linear-gradient(160deg,rgba(22,24,38,0.88)_0%,rgba(10,12,22,0.82)_55%,rgba(8,10,18,0.9)_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(168,85,247,0.1),0_32px_90px_-36px_rgba(0,0,0,0.88),0_0_56px_-28px_rgba(109,40,217,0.28)]",
  "backdrop-blur-xl",
  "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]",
  "before:bg-[radial-gradient(ellipse_90%_60%_at_50%_-20%,rgba(168,85,247,0.09),transparent_55%)]"
);

function glassAccent(glow: string) {
  return cn(
    glassPanel,
    "transition-all duration-500",
    glow
  );
}

interface TicketRow {
  id: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed" | null;
  created_at: string;
  updated_at: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

function FloatingParticles() {
  const dots = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden" aria-hidden>
      {dots.map((i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-violet-200/25"
          style={{
            width: i % 3 === 0 ? 2 : 1,
            height: i % 3 === 0 ? 2 : 1,
            left: `${(i * 17 + 11) % 100}%`,
            top: `${(i * 23 + 7) % 100}%`,
          }}
          animate={{ y: [0, -32, 0], opacity: [0.08, 0.45, 0.08] }}
          transition={{
            duration: 7 + (i % 5),
            repeat: Infinity,
            delay: i * 0.28,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function SupportOrb() {
  return (
    <motion.div
      className="relative mx-auto flex h-[200px] w-[200px] shrink-0 items-center justify-center sm:h-[220px] sm:w-[220px] lg:mr-4"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="absolute inset-[-12%] rounded-full bg-violet-500/25 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.65, 0.35] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-[2%] rounded-full border border-violet-300/20"
        animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-[12%] rounded-full border border-fuchsia-400/25"
        animate={{ scale: [1.05, 1, 1.05] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="relative flex h-[78%] w-[78%] flex-col items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-violet-500/50 via-fuchsia-600/35 to-violet-900/55 text-center shadow-[0_0_64px_rgba(139,92,246,0.55),0_0_120px_rgba(168,85,247,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-md"
        animate={{
          boxShadow: [
            "0 0 64px rgba(139,92,246,0.45), 0 0 100px rgba(168,85,247,0.2), inset 0 1px 0 rgba(255,255,255,0.12)",
            "0 0 80px rgba(168,85,247,0.6), 0 0 140px rgba(236,72,153,0.15), inset 0 1px 0 rgba(255,255,255,0.18)",
            "0 0 64px rgba(139,92,246,0.45), 0 0 100px rgba(168,85,247,0.2), inset 0 1px 0 rgba(255,255,255,0.12)",
          ],
        }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Heart className="mb-2 h-8 w-8 text-violet-50 drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]" aria-hidden />
        <p className="px-4 text-[15px] font-medium leading-snug text-white">We&apos;re here for you</p>
        <p className="mt-1.5 px-3 text-[11px] leading-relaxed text-violet-100/85">
          Average response within 24 hours
        </p>
      </motion.div>
    </motion.div>
  );
}

function getStatusMeta(status: string | null) {
  const s = (status || "open").toLowerCase();
  if (s === "in_progress") {
    return {
      label: "In Progress",
      className:
        "border-violet-400/40 bg-violet-500/18 text-violet-100 shadow-[0_0_24px_rgba(139,92,246,0.28)]",
    };
  }
  if (s === "resolved" || s === "closed") {
    return {
      label: "Resolved",
      className:
        "border-emerald-400/35 bg-emerald-500/15 text-emerald-100 shadow-[0_0_20px_rgba(52,211,153,0.2)]",
    };
  }
  return {
    label: "Under Review",
    className: "border-cyan-400/35 bg-cyan-500/14 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.18)]",
  };
}

function ticketIcon(subject: string): { Icon: LucideIcon; glow: string; ring: string } {
  const sub = subject.toLowerCase();
  if (sub.includes("billing") || sub.includes("account")) {
    return {
      Icon: FileText,
      glow: "from-cyan-500/40 to-blue-700/25 text-cyan-100",
      ring: "shadow-[0_0_20px_rgba(34,211,238,0.25)]",
    };
  }
  if (sub.includes("feature") || sub.includes("feedback")) {
    return {
      Icon: Sparkles,
      glow: "from-fuchsia-500/40 to-violet-700/25 text-fuchsia-100",
      ring: "shadow-[0_0_20px_rgba(236,72,153,0.25)]",
    };
  }
  if (sub.includes("performance") || sub.includes("technical")) {
    return {
      Icon: HelpCircle,
      glow: "from-violet-500/40 to-indigo-700/25 text-violet-100",
      ring: "shadow-[0_0_20px_rgba(139,92,246,0.28)]",
    };
  }
  return {
    Icon: HelpCircle,
    glow: "from-violet-500/40 to-indigo-700/25 text-violet-100",
    ring: "shadow-[0_0_20px_rgba(139,92,246,0.28)]",
  };
}

interface SupportHeroProps {
  backLink: React.ReactNode;
}

export function SupportHero({ backLink }: SupportHeroProps) {
  return (
    <section className="space-y-4">
      {backLink}
      <div
        className={cn(
          glassPanel,
          "relative isolate min-h-[320px] overflow-hidden sm:min-h-[360px] lg:min-h-[380px]"
        )}
      >
        <img
          src={HERO_IMG}
          alt=""
          className="absolute inset-0 h-full w-full scale-105 object-cover object-[center_35%]"
          width={1800}
          height={900}
          loading="eager"
        />
        {/* Lighter overlay — let the cabin/moon image dominate emotionally */}
        <motion.div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#05060c]/92 via-[#05060c]/55 to-[#05060c]/25 lg:via-[#05060c]/45 lg:to-transparent"
          aria-hidden
        />
        <motion.div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05060c]/80 via-transparent to-[#1e1040]/20"
          aria-hidden
        />
        <motion.div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_50%,rgba(168,85,247,0.22),transparent_50%)]"
          aria-hidden
        />
        <motion.div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_80%,rgba(251,146,60,0.12),transparent_45%)]"
          aria-hidden
        />
        <motion.div
          className="pointer-events-none absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.35)]"
          aria-hidden
        />

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex min-h-[320px] flex-col justify-center gap-8 p-6 sm:min-h-[360px] sm:p-8 lg:min-h-[380px] lg:flex-row lg:items-center lg:justify-between lg:p-10"
        >
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-xl space-y-4 lg:max-w-[52%]"
          >
            <h1 className="font-serif text-[clamp(2.25rem,5vw,3.15rem)] font-light leading-[1.08] tracking-tight text-white [text-shadow:0_2px_40px_rgba(0,0,0,0.5)]">
              Support{" "}
              <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-violet-300 bg-clip-text text-transparent">
                Center
              </span>
            </h1>
            <p className="max-w-md text-[15px] leading-relaxed text-zinc-200/95">
              We&apos;re here to support you on your journey. Whether you need technical help, emotional
              guidance, or just someone to listen — our team is ready.
            </p>
            <p className="flex items-start gap-2.5 text-sm leading-relaxed text-violet-100/90">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-fuchsia-400/25 bg-fuchsia-500/15 shadow-[0_0_16px_rgba(236,72,153,0.2)]">
                <Heart className="h-4 w-4 text-fuchsia-200" aria-hidden />
              </span>
              <span className="pt-1">
                Compassionate support. Human connection. Always here when you need us.
              </span>
            </p>
          </motion.div>
          <SupportOrb />
        </motion.div>
      </div>
    </section>
  );
}

interface ActionCard {
  title: string;
  description: string;
  image: string;
  imagePosition?: string;
  overlayTint: string;
  hoverGlow: string;
  iconGlow: string;
  iconRing: string;
  Icon: LucideIcon;
  onClick?: () => void;
  to?: string;
}

interface SupportActionCardsProps {
  onTalkToSupport: () => void;
  onResourceGuide: () => void;
  onCommunityHelp: () => void;
}

export function SupportActionCards({
  onTalkToSupport,
  onResourceGuide,
  onCommunityHelp,
}: SupportActionCardsProps) {
  const cards: ActionCard[] = [
    {
      title: "Talk to Support",
      description: "Reach our caring team for personalized help with anything on your mind.",
      image: BANNER_IMG,
      imagePosition: "object-center",
      overlayTint: "from-violet-950/50 via-[#05060c]/55 to-[#05060c]/80",
      hoverGlow: "hover:border-violet-400/25 hover:shadow-[0_0_40px_rgba(139,92,246,0.22),inset_0_1px_0_rgba(255,255,255,0.1)]",
      iconGlow: "from-violet-500/45 to-fuchsia-700/30",
      iconRing: "shadow-[0_0_24px_rgba(139,92,246,0.35)]",
      Icon: MessageCircle,
      onClick: onTalkToSupport,
    },
    {
      title: "Crisis Support",
      description: "Immediate help when you need it most. You are not alone.",
      image: STARS_IMG,
      imagePosition: "object-[center_40%]",
      overlayTint: "from-fuchsia-950/45 via-[#05060c]/60 to-[#05060c]/85",
      hoverGlow: "hover:border-fuchsia-400/25 hover:shadow-[0_0_40px_rgba(236,72,153,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]",
      iconGlow: "from-fuchsia-500/45 to-rose-700/30",
      iconRing: "shadow-[0_0_24px_rgba(236,72,153,0.32)]",
      Icon: AlertCircle,
      to: "/app/emergency-resources",
    },
    {
      title: "Resource Guide",
      description: "Explore guides, tutorials, and tools to support your wellbeing journey.",
      image: FOREST_IMG,
      imagePosition: "object-center",
      overlayTint: "from-cyan-950/40 via-[#05060c]/55 to-[#05060c]/82",
      hoverGlow: "hover:border-cyan-400/25 hover:shadow-[0_0_40px_rgba(34,211,238,0.18),inset_0_1px_0_rgba(255,255,255,0.1)]",
      iconGlow: "from-cyan-500/45 to-blue-700/30",
      iconRing: "shadow-[0_0_24px_rgba(34,211,238,0.28)]",
      Icon: BookOpen,
      onClick: onResourceGuide,
    },
    {
      title: "Community Help",
      description: "Connect with others who understand. Share, listen, and grow together.",
      image: HERO_IMG,
      imagePosition: "object-[center_35%]",
      overlayTint: "from-emerald-950/35 via-[#05060c]/50 to-[#05060c]/80",
      hoverGlow: "hover:border-teal-400/25 hover:shadow-[0_0_40px_rgba(45,212,191,0.18),inset_0_1px_0_rgba(255,255,255,0.1)]",
      iconGlow: "from-teal-500/45 to-emerald-700/30",
      iconRing: "shadow-[0_0_24px_rgba(45,212,191,0.28)]",
      Icon: Users,
      onClick: onCommunityHelp,
    },
    {
      title: "Safety Center",
      description: "Your safety matters. Access tools, plans, and resources to protect yourself.",
      image: LANTERN_IMG,
      imagePosition: "object-center",
      overlayTint: "from-amber-950/40 via-[#05060c]/55 to-[#05060c]/85",
      hoverGlow: "hover:border-amber-400/25 hover:shadow-[0_0_40px_rgba(251,191,36,0.18),inset_0_1px_0_rgba(255,255,255,0.1)]",
      iconGlow: "from-amber-500/45 to-orange-700/30",
      iconRing: "shadow-[0_0_24px_rgba(251,191,36,0.28)]",
      Icon: Shield,
      to: "/app/settings/wellness-plan",
    },
  ];

  return (
    <section className="space-y-5">
      <h2 className="font-serif text-xl font-light text-zinc-50 sm:text-2xl">
        How can we help you today?
      </h2>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        {cards.map((card) => {
          const inner = (
            <>
              <img
                src={card.image}
                alt=""
                className={cn("absolute inset-0 size-full object-cover", card.imagePosition)}
                width={480}
                height={320}
                loading="lazy"
                decoding="async"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05060c]/95 via-[#05060c]/72 to-[#05060c]/35"
                aria-hidden
              />
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 bg-gradient-to-br",
                  card.overlayTint
                )}
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.35)]"
                aria-hidden
              />
              <div className="relative z-10 flex flex-1 flex-col p-5">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white",
                    card.iconGlow,
                    card.iconRing
                  )}
                >
                  <card.Icon className="h-5 w-5" aria-hidden />
                </motion.div>
                <h3 className="mt-5 text-sm font-semibold leading-snug text-zinc-50">{card.title}</h3>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-zinc-300/90">{card.description}</p>
                <span
                  className={cn(
                    "absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full",
                    "border border-white/10 bg-black/35 text-zinc-300 backdrop-blur-sm",
                    "transition-all duration-300 group-hover:border-violet-400/35 group-hover:bg-violet-500/20 group-hover:text-violet-200 group-hover:shadow-[0_0_16px_rgba(139,92,246,0.25)]"
                  )}
                >
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
              </div>
            </>
          );

          const className = cn(actionCardShell, card.hoverGlow);

          if (card.to) {
            return (
              <Link key={card.title} to={card.to} className={className}>
                {inner}
              </Link>
            );
          }

          return (
            <button key={card.title} type="button" onClick={card.onClick} className={cn(className, "text-left")}>
              {inner}
            </button>
          );
        })}
      </motion.div>
    </section>
  );
}

interface SupportConversationsProps {
  tickets: TicketRow[];
  ticketsLoading: boolean;
  onRefresh: () => void;
  onOpenTicket: (id: string) => void;
}

export function SupportConversations({
  tickets,
  ticketsLoading,
  onRefresh,
  onOpenTicket,
}: SupportConversationsProps) {
  const visible = tickets.slice(0, 4);

  return (
    <section className={cn(glassPanel, "p-0")}>
      <div className="border-b border-white/[0.06] px-6 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-light text-zinc-50 sm:text-2xl">
              Your support conversations
            </h2>
            <p className="mt-1 text-sm text-zinc-500">Recent messages with our caring support team</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={ticketsLoading}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-300 transition hover:text-violet-100 disabled:opacity-50"
          >
            View all tickets
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="px-4 py-2 sm:px-5">
        {ticketsLoading && tickets.length === 0 ? (
          <div className="py-14 text-center text-sm text-zinc-500">Loading your conversations…</div>
        ) : tickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.08] bg-black/20 py-14 text-center">
            <p className="text-sm text-zinc-500">
              No conversations yet. Tap <span className="text-violet-300">Talk to Support</span> when you&apos;re
              ready.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {visible.map((t) => {
              const status = getStatusMeta(t.status);
              const { Icon, glow, ring } = ticketIcon(t.subject);
              const snippet = (t.description || "").replace(/^From:.*?\n\n/s, "").slice(0, 100);
              let updatedLabel = "recently";
              try {
                updatedLabel = formatDistanceToNow(parseISO(t.updated_at), { addSuffix: true });
              } catch {
                /* keep */
              }
              let createdLabel = "";
              try {
                createdLabel = new Date(t.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
              } catch {
                createdLabel = "";
              }

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenTicket(t.id)}
                  className="group flex w-full items-center gap-4 rounded-xl px-3 py-4 text-left transition-all duration-300 hover:bg-white/[0.03] hover:shadow-[inset_0_0_32px_rgba(139,92,246,0.06)] sm:px-4"
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br",
                      glow,
                      ring
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-zinc-100">{t.subject}</p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-zinc-500">
                      {snippet || "Your message is with our team — we'll respond with care."}
                    </p>
                    <p className="mt-1.5 text-xs text-zinc-600">
                      {createdLabel}
                      {createdLabel ? " · " : ""}
                      Ticket #{t.id.slice(0, 8)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1 text-[11px] font-medium",
                        status.className
                      )}
                    >
                      {status.label}
                    </span>
                    <span className="text-[11px] text-zinc-600">Updated {updatedLabel}</span>
                  </div>
                  <ChevronRight className="hidden h-5 w-5 shrink-0 text-zinc-600 transition group-hover:text-violet-300 sm:block" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

const COMFORT_ICONS: LucideIcon[] = [Lock, Heart, Sparkles, Download, Bell, ShieldCheck];
const COMFORT_ICON_COLORS = [
  "bg-violet-500/20 text-violet-300 shadow-[0_0_16px_rgba(139,92,246,0.2)]",
  "bg-fuchsia-500/20 text-fuchsia-300 shadow-[0_0_16px_rgba(236,72,153,0.18)]",
  "bg-cyan-500/20 text-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.18)]",
  "bg-teal-500/20 text-teal-300 shadow-[0_0_16px_rgba(45,212,191,0.18)]",
  "bg-amber-500/20 text-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.18)]",
  "bg-rose-500/20 text-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.15)]",
];

interface GuidedComfortTopicsProps {
  faqs: FaqItem[];
  openIndex: number | null;
  onToggle: (index: number) => void;
}

export function GuidedComfortTopics({ faqs, openIndex, onToggle }: GuidedComfortTopicsProps) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-light text-zinc-50 sm:text-2xl">Guided comfort topics</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Gentle answers to questions you might have — at your own pace
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(260px,340px)]">
        <div className="space-y-2">
          {faqs.map((faq, idx) => {
            const open = openIndex === idx;
            const Icon = COMFORT_ICONS[idx % COMFORT_ICONS.length];
            const iconColor = COMFORT_ICON_COLORS[idx % COMFORT_ICON_COLORS.length];
            return (
              <div
                key={faq.question}
                className={cn(
                  glassPanel,
                  "overflow-hidden transition-all duration-300",
                  open && "border-violet-400/25 shadow-[0_0_40px_rgba(139,92,246,0.12)]"
                )}
              >
                <button
                  type="button"
                  onClick={() => onToggle(idx)}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-white/[0.04]"
                  aria-expanded={open}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      iconColor
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="flex-1 text-sm font-medium leading-snug text-zinc-100">{faq.question}</span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-zinc-500 transition-transform duration-300",
                      open && "rotate-180 text-violet-300"
                    )}
                    aria-hidden
                  />
                </button>
                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/[0.06] px-4 py-4 pl-[3.35rem]">
                        <p className="text-sm leading-relaxed text-zinc-400">{faq.answer}</p>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        <div
          className={cn(
            glassPanel,
            "relative min-h-[300px] overflow-hidden p-0 lg:min-h-full"
          )}
        >
          <img
            src={COMFORT_IMG}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            width={680}
            height={520}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#05060c] via-[#05060c]/35 to-[#1a1030]/25" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(251,146,60,0.15),transparent_55%)]" />
          <div className="relative z-10 flex h-full min-h-[300px] flex-col justify-end p-7">
            <p className="font-serif text-xl font-light text-white">A quiet place for answers</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Take your time. We&apos;re here when you&apos;re ready.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SupportBottomBanner() {
  return (
    <section className="relative min-h-[160px] overflow-hidden rounded-[24px] border border-white/[0.09] shadow-[0_40px_100px_-48px_rgba(76,29,149,0.45),0_0_60px_-30px_rgba(109,40,217,0.25)] sm:min-h-[180px]">
      <img
        src={BANNER_IMG}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        width={1600}
        height={480}
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#05060c]/96 via-[#05060c]/75 to-[#05060c]/50" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_50%,rgba(168,85,247,0.18),transparent_55%)]" />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_100%,rgba(251,146,60,0.1),transparent_50%)]"
        aria-hidden
      />
      <div className="relative z-10 flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
        <div className="max-w-lg space-y-2.5">
          <h2 className="font-serif text-[clamp(1.5rem,3vw,1.85rem)] font-light leading-snug text-white">
            We&apos;re here, whenever you need us
          </h2>
          <p className="text-sm leading-relaxed text-zinc-400">
            Our support team is available around the clock. Reach out anytime — you deserve to be heard.
          </p>
        </div>
        <div className="space-y-3 sm:text-right">
          <a
            href="mailto:support@solace.app"
            className="flex items-center gap-2.5 text-sm text-zinc-200 transition hover:text-violet-200 sm:justify-end"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] shadow-[0_0_12px_rgba(139,92,246,0.15)]">
              <Mail className="h-4 w-4 text-violet-300" aria-hidden />
            </span>
            support@solace.app
          </a>
          <a
            href="tel:18007652223"
            className="flex items-center gap-2.5 text-sm text-zinc-200 transition hover:text-violet-200 sm:justify-end"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] shadow-[0_0_12px_rgba(139,92,246,0.15)]">
              <Phone className="h-4 w-4 text-violet-300" aria-hidden />
            </span>
            1-800-SOLACE-HELP
          </a>
        </div>
      </div>
    </section>
  );
}

function BreathingRings() {
  return (
    <div className="relative mx-auto flex h-[120px] w-[120px] items-center justify-center" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="absolute inset-0 rounded-full border border-violet-400/30"
          animate={{ scale: [1, 1.4 + i * 0.06], opacity: [0.55, 0] }}
          transition={{
            duration: 4,
            repeat: Infinity,
            delay: i * 0.95,
            ease: "easeOut",
          }}
        />
      ))}
      <motion.div
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full border border-violet-300/25 bg-gradient-to-br from-violet-600/50 to-fuchsia-600/30 shadow-[0_0_40px_rgba(139,92,246,0.45)]"
      >
        <Flower2 className="h-8 w-8 text-violet-100" />
      </motion.div>
    </div>
  );
}

function RailCard({
  children,
  className,
  glow = "",
}: {
  children: React.ReactNode;
  className?: string;
  glow?: string;
}) {
  return <div className={cn(glassAccent(glow), "relative z-[1] p-5", className)}>{children}</div>;
}

export function SupportRightRail() {
  return (
    <aside className="w-full shrink-0 space-y-4 xl:w-[320px] xl:sticky xl:top-4 xl:self-start">
      <RailCard glow="hover:border-emerald-400/15">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
          Support Availability
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.7)]" />
              </span>
              <p className="text-sm font-medium text-emerald-200">We&apos;re available</p>
            </div>
            <p className="mt-2 font-serif text-3xl font-light text-white">24/7</p>
            <p className="text-xs text-zinc-500">Support Team</p>
          </div>
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-violet-500/25 blur-xl" />
            <Flower2 className="relative h-10 w-10 text-violet-300 drop-shadow-[0_0_16px_rgba(139,92,246,0.6)]" />
          </div>
        </div>
      </RailCard>

      <RailCard glow="hover:border-fuchsia-400/20">
        <p className="text-sm font-medium text-zinc-100">Need urgent help?</p>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
          If you&apos;re in crisis, please reach out immediately. You matter, and help is available.
        </p>
        <Link
          to="/app/emergency-resources"
          className="mt-4 flex w-full items-center justify-center rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 py-3.5 text-sm font-semibold text-white shadow-[0_0_32px_rgba(139,92,246,0.4),0_0_48px_-8px_rgba(236,72,153,0.3)] transition hover:shadow-[0_0_40px_rgba(168,85,247,0.5)]"
        >
         Emergency Resources
        </Link>
        {/* <Link
          to="/app/emergency-resources"
          className="mt-3 block text-center text-xs font-medium text-violet-300/90 transition hover:text-violet-100"
        >
          Emergency Resources →
        </Link> */}
      </RailCard>

      <RailCard className="text-center" glow="hover:border-violet-400/20">
        <p className="text-sm font-medium text-zinc-100">Take a breath</p>
        <p className="mt-1 text-xs text-zinc-500">A moment of calm, just for you</p>
        <div className="my-5">
          <BreathingRings />
        </div>
        <Link
          to="/app/wellness-tools"
          className="inline-flex w-full items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/12 py-3 text-sm font-medium text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:bg-violet-500/20 hover:shadow-[0_0_24px_rgba(139,92,246,0.2)]"
        >
          Start Breathing
        </Link>
      </RailCard>

      <div className={cn(glassAccent("hover:border-fuchsia-400/15"), "overflow-hidden p-0")}>
        <div className="relative h-32">
          <img
            src={LANTERN_IMG}
            alt="Calm mountain landscape at dusk with soft twilight light"
            className="absolute inset-0 h-full w-full object-cover object-[center_42%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c14] via-[#0a0c14]/50 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_80%,rgba(251,146,60,0.2),transparent_60%)]" />
        </div>
        <div className="p-5">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-fuchsia-300" aria-hidden />
            <p className="text-sm font-medium text-zinc-100">You are not alone</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Whatever you&apos;re feeling right now is valid. Our community and support team are here to walk
            beside you.
          </p>
        </div>
      </div>

      <RailCard glow="hover:border-violet-400/15">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/15 shadow-[0_0_16px_rgba(139,92,246,0.2)]">
            <ShieldCheck className="h-5 w-5 text-violet-300" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-100">Support Promise</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Every conversation is private, empathetic, and confidential. We treat your wellbeing with the
              care it deserves — always.
            </p>
          </div>
        </div>
      </RailCard>
    </aside>
  );
}

interface SanctuaryPageShellProps {
  children: React.ReactNode;
}

export function SanctuaryPageShell({ children }: SanctuaryPageShellProps) {
  return (
    <div className="relative min-h-full overflow-x-hidden bg-[#05060c] text-zinc-200">
      <div className="pointer-events-none fixed inset-0 bg-[#05060c]" />
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-5%,rgba(109,40,217,0.2),transparent_58%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_0%_100%,rgba(34,211,238,0.06),transparent_42%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_100%_30%,rgba(236,72,153,0.08),transparent_40%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.6)]"
        aria-hidden
      />
      <FloatingParticles />
      <div className="relative z-10 mx-auto max-w-[1500px] px-4 pb-24 pt-4 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}

export function BackToSettingsLink() {
  return (
    <Link
      to="/app/settings"
      className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-200"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to Settings
    </Link>
  );
}
