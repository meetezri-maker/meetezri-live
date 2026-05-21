import { motion } from "motion/react";
import {
  HelpCircle,
  BookOpen,
  MessageCircle,
  Mail,
  Send,
  FileText,
  Video,
  Users,
  ExternalLink,
  CheckCircle,
  X,
  ChevronDown,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatDistanceToNow, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  modalCloseButton,
  modalInput,
  modalPrimaryButton,
  modalSecondaryButton,
} from "@/lib/modalTheme";
import { SolaceSelect } from "@/app/solace";
import {
  SanctuaryPageShell,
  SupportHero,
  SupportActionCards,
  SupportConversations,
  GuidedComfortTopics,
  SupportBottomBanner,
  SupportRightRail,
  BackToSettingsLink,
  glassPanel,
} from "./help-support/HelpSupportSanctuary";

export function HelpSupport() {
  const [showContactForm, setShowContactForm] = useState(false);
  const [query, setQuery] = useState("");
  const [openSolaceFaq, setOpenSolaceFaq] = useState<number | null>(0);
  const [openGeneralFaq, setOpenGeneralFaq] = useState<number | null>(null);
  const [guideSection, setGuideSection] = useState<string>("overview");
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [submitted, setSubmitted] = useState(false);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState<string>("");

  const [tickets, setTickets] = useState<
    Array<{
      id: string;
      subject: string;
      description: string;
      priority: "low" | "medium" | "high" | "urgent" | null;
      status: "open" | "in_progress" | "resolved" | "closed" | null;
      created_at: string;
      updated_at: string;
    }>
  >([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [activeTicket, setActiveTicket] = useState<any>(null);
  const [ticketReply, setTicketReply] = useState("");
  const [ticketReplySending, setTicketReplySending] = useState(false);
  const [closingTicket, setClosingTicket] = useState(false);

  const loadTickets = async () => {
    setTicketsLoading(true);
    try {
      const data = (await api.support.listTickets({ limit: 25 })) as any[];
      setTickets(Array.isArray(data) ? (data as any) : []);
    } catch (e: any) {
      toast.error(e?.message || "Could not load tickets");
    } finally {
      setTicketsLoading(false);
    }
  };

  const openTicket = async (ticketId: string) => {
    setActiveTicketId(ticketId);
    setTicketModalOpen(true);
    try {
      const t = await api.support.getTicket(ticketId);
      setActiveTicket(t);
    } catch (e: any) {
      toast.error(e?.message || "Could not load ticket");
    }
  };

  const refreshActiveTicket = async () => {
    if (!activeTicketId) return;
    const t = await api.support.getTicket(activeTicketId);
    setActiveTicket(t);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const subject =
      contactForm.subject === "technical"
        ? "Technical Issue"
        : contactForm.subject === "account"
          ? "Account & Billing"
          : contactForm.subject === "feature"
            ? "Feature Request"
            : contactForm.subject === "feedback"
              ? "General Feedback"
              : contactForm.subject === "other"
                ? "Other"
                : contactForm.subject || "Support Request";

    const body = `From: ${contactForm.name} <${contactForm.email}>\n\n${contactForm.message}`.trim();

    try {
      setSubmitted(true);
      const created = (await api.support.createTicket({
        subject,
        description: body,
        priority: "medium",
      })) as any;
      await loadTickets();
      if (created?.id) {
        await openTicket(created.id);
      }
      setShowContactForm(false);
      setContactForm({
        name: "",
        email: "",
        subject: "",
        message: "",
      });
      toast.success("Ticket created");
    } catch (err: any) {
      toast.error(err?.message || "Could not create ticket");
    } finally {
      setSubmitted(false);
    }
  };

  const handleResourceClick = (title: string) => {
    setSelectedResource(title);
    setShowResourceModal(true);
  };

  const solaceFaqs = useMemo(
    () => [
      {
        question: "Is Solace a replacement for professional therapy?",
        answer:
          "No. Solace can support your wellbeing with tools, guidance, and reflection, but it’s not a substitute for professional medical advice, diagnosis, or treatment. If you’re in danger or need urgent help, use your local emergency number or emergency resources.",
        tags: ["safety", "basics"],
      },
      {
        question: "How do I start a session?",
        answer:
          "Go to your dashboard and open Talk it out. Pick a companion, then start your conversation. If the session button is disabled, check your connection and try again.",
        tags: ["sessions", "getting-started"],
      },
      {
        question: "My audio/mic isn’t working — what should I do?",
        answer:
          "Check your browser/device permissions, ensure the correct input/output device is selected, and try refreshing once. If you’re on mobile, close other apps that may be using the microphone.",
        tags: ["troubleshooting", "audio"],
      },
      {
        question: "How can I report a safety concern or harmful content?",
        answer:
          "Open Helpfull Resources for immediate support and contact support with as much detail as you can (what happened, when, and any screenshots).",
        tags: ["safety", "reporting"],
      },
      {
        question: "How do I manage privacy settings?",
        answer: "Open Settings, then go to Privacy & Security to review controls and available data options.",
        tags: ["privacy", "settings"],
      },
      {
        question: "How fast will support respond?",
        answer:
          "We aim to respond within 24 hours on business days. If you’re facing an emergency, please use emergency resources or your local emergency number.",
        tags: ["support"],
      },
    ],
    []
  );

  const faqs = [
    {
      question: "Is my data private and secure?",
      answer:
        "Yes. Your conversations are protected with strong encryption, and we never share your personal health information without your explicit consent. You control your data in Privacy & Security settings.",
    },
    {
      question: "What if I'm feeling emotionally distressed?",
      answer:
        "You're not alone. Use Crisis Support or Emergency Resources for immediate help. You can also start a Talk It Out session or reach our support team — we're here with compassion, not judgment.",
    },
    {
      question: "How does mood tracking work?",
      answer:
        "Visit Mood from your dashboard to log how you feel, add intensity and notes, and notice patterns over time. Small check-ins can help you understand yourself with more kindness.",
    },
    {
      question: "Can I export my journal entries?",
      answer:
        "Yes. Go to Settings → Privacy & Security and choose Download My Data to export your information, including journal entries, whenever you need them.",
    },
    {
      question: "How do I manage notifications?",
      answer:
        "Open Settings → Notifications to customize alerts, reminders, and updates so they feel supportive — not overwhelming.",
    },
    {
      question: "What safety tools are available?",
      answer:
        "Your Safety Plan, emergency contacts, and Emergency Resources are always available from Settings and Wellness Tools. If you're in immediate danger, please contact local emergency services or 988 (U.S.).",
    },
  ];

  const filteredSolaceFaqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return solaceFaqs;
    return solaceFaqs.filter((f) => {
      const hay = `${f.question} ${f.answer} ${(f.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, solaceFaqs]);

  const resources = [
    {
      icon: BookOpen,
      title: "User Guide",
      description: "Complete documentation and tutorials",
      color: "from-blue-500 to-cyan-600",
      action: "Read Guide"
    },
    {
      icon: Video,
      title: "Video Tutorials",
      description: "Watch step-by-step video guides",
      color: "from-purple-500 to-pink-600",
      action: "Watch Videos"
    },
    {
      icon: Users,
      title: "Community Forum",
      description: "Connect with other Ezri users",
      color: "from-green-500 to-teal-600",
      action: "Join Forum"
    },
    {
      icon: FileText,
      title: "Knowledge Base",
      description: "Browse articles and FAQs",
      color: "from-orange-500 to-red-600",
      action: "Browse Articles"
    }
  ];

  const userGuide = useMemo(
    () => [
      {
        id: "overview",
        title: "Overview",
        bullets: [
          "Solace is a wellbeing companion — not a replacement for professional care.",
          "Use the dashboard to access sessions, mood check-ins, journal, and tools.",
          "If you need urgent help, use Just In Case Resources or call your local emergency number (U.S.: 988).",
        ],
      },
      {
        id: "getting-started",
        title: "Getting started",
        bullets: [
          "Log in and complete onboarding (profile, preferences, permissions).",
          "From the dashboard, open Talk it out to start a session.",
          "Use Mood Check-In daily to track patterns over time.",
        ],
      },
      {
        id: "sessions",
        title: "Starting a session",
        bullets: [
          "Go to Talk it out and pick a companion if prompted.",
          "Start your conversation and use follow-up prompts when you feel stuck.",
          "If a session won’t start, refresh once and confirm your network is stable.",
        ],
      },
      {
        id: "mood",
        title: "Mood check-ins",
        bullets: [
          "Open Mood Check-In from the bottom nav or dashboard.",
          "Select a mood + intensity and add a short note (optional).",
          "Review your mood history to spot patterns and triggers.",
        ],
      },
      {
        id: "journal",
        title: "Journal",
        bullets: [
          "Use the Journal to capture thoughts, reflections, and goals.",
          "Try short templates: ‘What happened?’, ‘What I felt’, ‘What I need’.",
          "If you want to keep entries private, review Privacy & Security settings.",
        ],
      },
      {
        id: "resources",
        title: "Resources & tools",
        bullets: [
          "Explore Wellness Tools for guided exercises and self-care routines.",
          "Use Helpful Resources anytime you need immediate support options.",
          "Check Progress to see streaks, trends, and engagement over time.",
        ],
      },
      {
        id: "settings",
        title: "Settings & privacy",
        bullets: [
          "Open Settings to manage notifications, appearance, and accessibility.",
          "Use Privacy & Security to review data controls and security options.",
          "Update Emergency Contacts and your Wellness Plan for difficult moments.",
        ],
      },
      {
        id: "troubleshooting",
        title: "Troubleshooting",
        bullets: [
          "Audio/mic issues: confirm browser permissions and the selected devices.",
          "Login issues: reset password and ensure email verification is complete.",
          "Slow app: close heavy tabs, refresh, and check your connection.",
        ],
      },
      {
        id: "support",
        title: "Contact support",
        bullets: [
          "Use ‘Contact Support’ to send details (what happened, when, steps).",
          "Include screenshots if possible.",
          "We aim to respond within 24 hours on business days.",
        ],
      },
    ],
    []
  );

  useEffect(() => {
    void loadTickets();
  }, []);

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-black/35 px-4 py-2.5 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40";

  return (
    <>
      <SanctuaryPageShell>
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1 space-y-8">
            <SupportHero backLink={<BackToSettingsLink />} />
            <SupportActionCards
              onTalkToSupport={() => setShowContactForm(true)}
              onResourceGuide={() => handleResourceClick("User Guide")}
              onCommunityHelp={() => handleResourceClick("Community Forum")}
            />
            <SupportConversations
              tickets={tickets}
              ticketsLoading={ticketsLoading}
              onRefresh={() => void loadTickets()}
              onOpenTicket={(id) => void openTicket(id)}
            />
            <GuidedComfortTopics
              faqs={faqs}
              openIndex={openGeneralFaq}
              onToggle={(idx) => setOpenGeneralFaq(openGeneralFaq === idx ? null : idx)}
            />
            <SupportBottomBanner />
          </div>
          <SupportRightRail />
        </div>
      </SanctuaryPageShell>

      {showContactForm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          onClick={() => setShowContactForm(false)}
        >
          <motion.div
            initial={{ scale: 0.96, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(glassPanel, "w-full max-w-lg p-6 sm:p-7")}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-light text-zinc-50">Send us a message</h2>
                <p className="mt-1 text-sm text-zinc-500">We&apos;ll respond with care within 24 hours.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowContactForm(false)}
                className="rounded-xl border border-white/10 p-2 text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {submitted ? (
              <div className="py-8 text-center">
                <CheckCircle className="mx-auto mb-4 h-14 w-14 text-emerald-400" />
                <h3 className="font-serif text-lg font-light text-zinc-50">Message sent</h3>
                <p className="mt-2 text-sm text-zinc-500">We&apos;ll get back to you within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">Name</label>
                  <input
                    type="text"
                    required
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className={inputClass}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">Email</label>
                  <input
                    type="email"
                    required
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className={inputClass}
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">Subject</label>
                  <SolaceSelect
                    value={contactForm.subject}
                    onValueChange={(subject) => setContactForm({ ...contactForm, subject })}
                    ariaLabel="Contact subject"
                    placeholder="Select a topic"
                    variant="form"
                    triggerClassName={inputClass}
                    options={[
                      { value: "technical", label: "Technical Issue" },
                      { value: "account", label: "Account & Billing" },
                      { value: "feature", label: "Feature Request" },
                      { value: "feedback", label: "General Feedback" },
                      { value: "other", label: "Other" },
                    ]}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">Message</label>
                  <textarea
                    required
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    rows={4}
                    className={cn(inputClass, "resize-none")}
                    placeholder="Tell us how we can help..."
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowContactForm(false)}
                    className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-200 hover:bg-white/[0.05]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(139,92,246,0.3)]"
                  >
                    <Send className="h-4 w-4" />
                    Send message
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}


        {/* Resource Modal */}
        {showResourceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
            onClick={() => setShowResourceModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(glassPanel, "w-full max-w-4xl overflow-hidden")}
            >
              <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600">
                    {selectedResource === "User Guide" ? (
                      <BookOpen className="size-6 text-white" />
                    ) : (
                      <ExternalLink className="size-6 text-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Help Resource</div>
                    <h3 className="truncate font-serif text-xl font-semibold text-zinc-50 sm:text-2xl">
                      {selectedResource}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResourceModal(false)}
                  className={cn(modalCloseButton, "inline-flex size-10 shrink-0 items-center justify-center")}
                  aria-label="Close"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="max-h-[78vh] overflow-y-auto px-6 py-6 text-zinc-300">
                {selectedResource === "User Guide" ? (
                  <div className="text-left">
                    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 mb-5">
                      <div className="lg:sticky lg:top-0">
                        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 p-4">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div>
                              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Table of contents</div>
                              <div className="text-sm font-bold text-gray-900 dark:text-gray-100">User Guide</div>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{userGuide.length} sections</span>
                          </div>

                          <div className="space-y-2">
                            {userGuide.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => setGuideSection(s.id)}
                                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                                  guideSection === s.id
                                    ? "bg-white dark:bg-slate-900 border-blue-200 dark:border-slate-600 shadow-sm"
                                    : "bg-transparent border-transparent hover:bg-white/70 dark:hover:bg-slate-900/60"
                                }`}
                              >
                                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.title}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        {(() => {
                          const section = userGuide.find((s) => s.id === guideSection) || userGuide[0];
                          return (
                            <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                              <div className="px-5 py-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900 border-b border-gray-100 dark:border-slate-700">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Section</div>
                                    <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{section.title}</div>
                                  </div>
                                  <div className="hidden sm:flex items-center gap-2">
                                    <Link
                                      to="/app/session-lobby"
                                      className="inline-flex items-center justify-center px-3 py-2 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
                                    >
                                      Talk it out
                                    </Link>
                                    <Link
                                      to="/app/settings"
                                      className="inline-flex items-center justify-center px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-950 text-gray-900 dark:text-gray-100 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                                    >
                                      Settings
                                    </Link>
                                  </div>
                                </div>
                              </div>

                              <div className="px-5 py-5">
                                <ul className="space-y-3">
                                  {section.bullets.map((b) => (
                                    <li key={b} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-200">
                                      <span className="mt-1.5 h-2 w-2 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shrink-0" />
                                      <span className="leading-relaxed">{b}</span>
                                    </li>
                                  ))}
                                </ul>

                                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <Link
                                    to="/app/session-lobby"
                                    className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
                                  >
                                    Go to Talk it out
                                  </Link>
                                  <Link
                                    to="/app/settings"
                                    className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                                  >
                                    Open Settings
                                  </Link>
                                  <Link
                                    to="/app/emergency-resources"
                                    className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                                  >
                                    Helpful Resources
                                  </Link>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-xl p-4 mb-5">
                      <p className="text-sm text-blue-900 dark:text-gray-200">
                        <strong>Tip:</strong> If you don’t find what you need, use “Contact Support” on this page and include your device + browser and the steps you tried.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => setShowResourceModal(false)}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowResourceModal(false);
                          setShowContactForm(true);
                        }}
                        className="flex-1 px-6 py-3 rounded-xl font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        Contact Support
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {selectedResource === "Community Forum" ? (
                      <div className="text-left">
                        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-slate-950 dark:to-slate-900 p-5 mb-5">
                          <div className="font-bold text-gray-900 dark:text-gray-100 text-lg">Community Forum</div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                            Connect with others, share wins, ask questions, and learn what’s working for the community.
                          </p>
                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Link
                              to="/app/community"
                              onClick={() => setShowResourceModal(false)}
                              className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
                            >
                              Open Community
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setShowResourceModal(false);
                                setShowContactForm(true);
                                setContactForm((prev) => ({ ...prev, subject: prev.subject || "feedback" }));
                              }}
                              className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                            >
                              Suggest a topic
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                          {[
                            { title: "Introductions", desc: "Meet others and set your intentions" },
                            { title: "Coping strategies", desc: "Tools people use day-to-day" },
                            { title: "Progress stories", desc: "Wins, streaks, and reflections" },
                            { title: "Feature requests", desc: "Help shape what we build next" },
                          ].map((c) => (
                            <div
                              key={c.title}
                              className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4"
                            >
                              <div className="font-semibold text-gray-900 dark:text-gray-100">{c.title}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{c.desc}</div>
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={() => setShowResourceModal(false)}
                          className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                        >
                          Close
                        </button>
                      </div>
                    ) : selectedResource === "Knowledge Base" ? (
                      <div className="text-left">
                        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-slate-950 dark:to-slate-900 p-5 mb-5">
                          <div className="font-bold text-gray-900 dark:text-gray-100 text-lg">Knowledge Base</div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                            Browse how-to articles, troubleshooting guides, and best practices for using Solace and Ezri.
                          </p>
                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Link
                              to="/app/settings/resources"
                              onClick={() => setShowResourceModal(false)}
                              className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
                            >
                              Open Resources Library
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setShowResourceModal(false);
                                setQuery("audio");
                              }}
                              className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                            >
                              Search “audio”
                            </button>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 mb-5">
                          <div className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">Popular topics</div>
                          <div className="flex flex-wrap gap-2">
                            {[
                              "Starting a session",
                              "Audio & microphone",
                              "Privacy & security",
                              "Mood check-ins",
                              "Notifications",
                              "Just In Case resources",
                            ].map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setQuery(t)}
                                className="text-xs px-3 py-1.5 rounded-full bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                            Tip: clicking a topic fills the Solace search box on this page.
                          </p>
                        </div>

                        <button
                          onClick={() => setShowResourceModal(false)}
                          className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                        >
                          Close
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                          {selectedResource === "Video Tutorials" &&
                            "This would open our video tutorial library with step-by-step guides in a production environment."}
                        </p>
                        <div className="bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-xl p-4 mb-6">
                          <p className="text-sm text-blue-900 dark:text-gray-200">
                            <strong>Demo Note:</strong> In a live production app, this would redirect you to the actual resource.
                          </p>
                        </div>
                        <button
                          onClick={() => setShowResourceModal(false)}
                          className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                        >
                          Got it
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Ticket Modal */}
        {ticketModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
            onClick={() => {
              setTicketModalOpen(false);
              setActiveTicketId(null);
              setActiveTicket(null);
              setTicketReply("");
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(glassPanel, "w-full max-w-3xl overflow-hidden")}
            >
              <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-5">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Support ticket</div>
                  <div className="truncate font-serif text-lg font-semibold text-zinc-50 sm:text-xl">
                    {activeTicket?.subject || "Loading…"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    Status:{" "}
                    <span className="font-semibold capitalize text-zinc-200">
                      {activeTicket?.status || "open"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTicketModalOpen(false);
                    setActiveTicketId(null);
                    setActiveTicket(null);
                    setTicketReply("");
                  }}
                  className={cn(modalCloseButton, "inline-flex size-10 shrink-0 items-center justify-center")}
                  aria-label="Close"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="max-h-[62vh] space-y-3 overflow-y-auto px-6 py-5">
                {(activeTicket?.support_ticket_messages || []).length === 0 ? (
                  <div className="py-8 text-center text-sm text-zinc-500">No messages yet.</div>
                ) : (
                  (activeTicket?.support_ticket_messages || []).map((m: any) => {
                    const byMe = m?.author_role === "user";
                    const name = m?.profiles?.full_name || (byMe ? "You" : "Support");
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "rounded-2xl border p-4",
                          byMe
                            ? "border-violet-400/25 bg-violet-500/[0.08]"
                            : "border-white/10 bg-white/[0.04]",
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="truncate text-sm font-semibold text-zinc-100">{name}</div>
                          <div className="shrink-0 text-[11px] text-zinc-500">
                            {(() => {
                              try {
                                return formatDistanceToNow(parseISO(m.created_at), { addSuffix: true });
                              } catch {
                                return "recently";
                              }
                            })()}
                          </div>
                        </div>
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{m.body}</div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-white/10 px-6 py-5">
                <div className="flex flex-col gap-3">
                  <textarea
                    value={ticketReply}
                    onChange={(e) => setTicketReply(e.target.value)}
                    rows={3}
                    className={cn(modalInput, "resize-none")}
                    placeholder="Write a reply…"
                    disabled={ticketReplySending}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!activeTicketId) return;
                        setClosingTicket(true);
                        try {
                          await api.support.closeTicket(activeTicketId);
                          await refreshActiveTicket();
                          await loadTickets();
                          toast.success("Ticket closed");
                        } catch (e: any) {
                          toast.error(e?.message || "Could not close ticket");
                        } finally {
                          setClosingTicket(false);
                        }
                      }}
                      className={cn(modalSecondaryButton, "text-sm disabled:opacity-60")}
                      disabled={closingTicket || !activeTicketId}
                    >
                      {closingTicket ? "Closing..." : "Close ticket"}
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const msg = ticketReply.trim();
                        if (!msg || !activeTicketId) return;
                        setTicketReplySending(true);
                        try {
                          await api.support.addMessage(activeTicketId, msg);
                          setTicketReply("");
                          await refreshActiveTicket();
                          await loadTickets();
                        } catch (e: any) {
                          toast.error(e?.message || "Could not send message");
                        } finally {
                          setTicketReplySending(false);
                        }
                      }}
                      className={cn(modalPrimaryButton, "gap-2 disabled:opacity-60")}
                      disabled={ticketReplySending || !ticketReply.trim() || !activeTicketId}
                    >
                      <Send className="size-4" />
                      {ticketReplySending ? "Sending..." : "Send reply"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
    </>
  );
}