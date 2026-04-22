import { motion } from "motion/react";
import { 
  HelpCircle,
  Search,
  BadgeCheck,
  BookOpen,
  MessageCircle,
  Mail,
  Phone,
  Send,
  ArrowLeft,
  FileText,
  Video,
  Users,
  ExternalLink,
  Clock,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
  X
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/app/components/AppLayout";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatDistanceToNow, parseISO } from "date-fns";

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
          "No. Solace can support your wellbeing with tools, guidance, and reflection, but it’s not a substitute for professional medical advice, diagnosis, or treatment. If you’re in danger or need urgent help, use your local emergency number or crisis resources.",
        tags: ["safety", "basics"],
      },
      {
        question: "How do I start a session?",
        answer:
          "Go to your dashboard and open Session Lobby. Pick a companion, then start your conversation. If the session button is disabled, check your connection and try again.",
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
          "Open Crisis Resources for immediate support and contact support with as much detail as you can (what happened, when, and any screenshots).",
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
          "We aim to respond within 24 hours on business days. If you’re facing an emergency, please use crisis resources or your local emergency number.",
        tags: ["support"],
      },
    ],
    []
  );

  const faqs = [
    {
      question: "How do I start an AI therapy session?",
      answer: "Navigate to the AI Sessions tab from your dashboard and click 'Start Session'. Choose your preferred companion and begin your conversation."
    },
    {
      question: "Is my data private and secure?",
      answer: "Yes! All your conversations are encrypted end-to-end and comply with HIPAA regulations. We never share your personal health information without explicit consent."
    },
    {
      question: "How does mood tracking work?",
      answer: "Visit the Mood Tracker from your dashboard to log your current mood, intensity, and add notes. Track patterns over time with our analytics dashboard."
    },
    {
      question: "Can I export my journal entries?",
      answer: "Yes! Go to Privacy & Security settings and select 'Download My Data' to export all your information including journal entries."
    },
    {
      question: "What are crisis resources?",
      answer: "Crisis resources provide immediate help during mental health emergencies. Access them 24/7 from the Wellness Tools section or the emergency button on your dashboard."
    },
    {
      question: "How do I change my notification settings?",
      answer: "Go to Settings > Notifications to customize alerts, reminders, and updates according to your preferences."
    }
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
          "If you need urgent help, use Crisis Resources or call your local emergency number (U.S.: 988).",
        ],
      },
      {
        id: "getting-started",
        title: "Getting started",
        bullets: [
          "Log in and complete onboarding (profile, preferences, permissions).",
          "From the dashboard, open Session Lobby to start a session.",
          "Use Mood Check-In daily to track patterns over time.",
        ],
      },
      {
        id: "sessions",
        title: "Starting a session",
        bullets: [
          "Go to Session Lobby and pick a companion if prompted.",
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
          "Use Crisis Resources anytime you need immediate support options.",
          "Check Progress to see streaks, trends, and engagement over time.",
        ],
      },
      {
        id: "settings",
        title: "Settings & privacy",
        bullets: [
          "Open Settings to manage notifications, appearance, and accessibility.",
          "Use Privacy & Security to review data controls and security options.",
          "Update Emergency Contacts and your Safety Plan for difficult moments.",
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

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link 
            to="/app/settings" 
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
              <HelpCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Support Center</h1>
              <p className="text-gray-600 dark:text-gray-400">Solace support, resources, and answers.</p>
            </div>
          </div>
        </motion.div>

        {/* My tickets */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-700 mb-6"
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">My support tickets</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                View your recent requests and replies from the support team.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadTickets()}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-sm font-semibold"
              disabled={ticketsLoading}
            >
              {ticketsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {ticketsLoading && tickets.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-600 dark:text-gray-400">Loading tickets…</div>
          ) : tickets.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-600 dark:text-gray-400">
              No tickets yet. Use “Contact Support” to create your first one.
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => void openTicket(t.id)}
                  className="w-full text-left rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 hover:bg-gray-100 dark:hover:bg-slate-900 transition-colors p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 dark:text-gray-100 truncate">{t.subject}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Updated{" "}
                        {(() => {
                          try {
                            return formatDistanceToNow(parseISO(t.updated_at), { addSuffix: true });
                          } catch {
                            return "recently";
                          }
                        })()}
                        {" • "}
                        Status: <span className="font-semibold">{t.status || "open"}</span>
                        {" • "}
                        Priority: <span className="font-semibold">{t.priority || "medium"}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
                        View
                        <ExternalLink className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </motion.div>

  

        {/* Quick Help Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowContactForm(!showContactForm)}
            className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl p-6 shadow-lg text-left"
          >
            <MessageCircle className="w-8 h-8 mb-3" />
            <h3 className="font-bold text-lg mb-1">Contact Support</h3>
            <p className="text-sm text-blue-100">Send us a message and we'll respond within 24 hours</p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleResourceClick("User Guide")}
            className="bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white rounded-2xl p-6 shadow-lg text-left"
          >
            <BookOpen className="w-8 h-8 mb-3" />
            <h3 className="font-bold text-lg mb-1">User Guide</h3>
            <p className="text-sm text-violet-100">Step-by-step guide for sessions, tools, and settings</p>
          </motion.button>
        </motion.div>

        {/* Contact Form */}
        {showContactForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-700 mb-6"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Send us a message</h2>
            
            {submitted ? (
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="text-center py-8"
              >
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Message Sent!</h3>
                <p className="text-gray-600 dark:text-gray-400">We'll get back to you within 24 hours.</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                  <select
                    required
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a topic</option>
                    <option value="technical">Technical Issue</option>
                    <option value="account">Account & Billing</option>
                    <option value="feature">Feature Request</option>
                    <option value="feedback">General Feedback</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
                  <textarea
                    required
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Tell us how we can help..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowContactForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-gray-900 dark:text-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send Message
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}

        {/* Resources */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Help Resources</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {resources.map((resource, index) => {
              const Icon = resource.icon;
              return (
                <motion.button
                  key={index}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleResourceClick(resource.title)}
                  className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-md border border-gray-100 dark:border-slate-700 hover:shadow-lg transition-all text-left"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${resource.color} flex items-center justify-center mb-3`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">{resource.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{resource.description}</p>
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-medium">
                    {resource.action}
                    <ExternalLink className="w-3 h-3" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* FAQs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-700 mb-6"
        >
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">General FAQs</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">Common questions about Ezri features.</p>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const open = openGeneralFaq === idx;
              return (
                <div
                  key={`${faq.question}-${idx}`}
                  className="rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenGeneralFaq(open ? null : idx)}
                    className="w-full text-left px-4 py-3 bg-gray-50 dark:bg-slate-800/60"
                  >
                    <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-start gap-2">
                      <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                      <span>{faq.question}</span>
                    </div>
                  </button>

                  {open && (
                    <div className="px-4 py-4 bg-white dark:bg-slate-900">
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Contact Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-slate-900 border-2 border-indigo-200 dark:border-slate-700 rounded-2xl p-6"
        >
          <div className="flex items-start gap-4">
            <Clock className="w-6 h-6 text-indigo-600 dark:text-indigo-300 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-indigo-900 dark:text-gray-100 mb-2">Support Hours</h3>
              <p className="text-sm text-indigo-700 dark:text-gray-300 mb-3">
                Our support team is available Monday - Friday, 9am - 6pm EST. For urgent matters outside these hours, please use our crisis hotline.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-indigo-800 dark:text-gray-200">
                  <Mail className="w-4 h-4" />
                  <span>support@ezri.health</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-indigo-800 dark:text-gray-200">
                  <Phone className="w-4 h-4" />
                  <span>1-800-EZRI-HELP (1-800-397-4435)</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Resource Modal */}
        {showResourceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowResourceModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-gray-100 dark:border-slate-700">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                    {selectedResource === "User Guide" ? (
                      <BookOpen className="w-6 h-6 text-white" />
                    ) : (
                      <ExternalLink className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Help Resource</div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                      {selectedResource}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResourceModal(false)}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-6 max-h-[78vh] overflow-y-auto">
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
                                      Session Lobby
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
                                    Go to Session Lobby
                                  </Link>
                                  <Link
                                    to="/app/settings"
                                    className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                                  >
                                    Open Settings
                                  </Link>
                                  <Link
                                    to="/app/crisis-resources"
                                    className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                                  >
                                    Crisis Resources
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
                              to="/app/settings/community"
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
                              "Crisis resources",
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
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
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-gray-100 dark:border-slate-700">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Support ticket</div>
                  <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                    {activeTicket?.subject || "Loading…"}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Status: <span className="font-semibold">{activeTicket?.status || "open"}</span>
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
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-5 max-h-[62vh] overflow-y-auto space-y-3 bg-gray-50 dark:bg-slate-950">
                {(activeTicket?.support_ticket_messages || []).length === 0 ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400 py-8 text-center">
                    No messages yet.
                  </div>
                ) : (
                  (activeTicket?.support_ticket_messages || []).map((m: any) => {
                    const byMe = m?.author_role === "user";
                    const name = m?.profiles?.full_name || (byMe ? "You" : "Support");
                    return (
                      <div
                        key={m.id}
                        className={`rounded-2xl border ${
                          byMe
                            ? "border-blue-200 dark:border-blue-900/40 bg-white dark:bg-slate-900"
                            : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                        } p-4`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {name}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 shrink-0">
                            {(() => {
                              try {
                                return formatDistanceToNow(parseISO(m.created_at), { addSuffix: true });
                              } catch {
                                return "recently";
                              }
                            })()}
                          </div>
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                          {m.body}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="px-6 py-5 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900">
                <div className="flex flex-col gap-3">
                  <textarea
                    value={ticketReply}
                    onChange={(e) => setTicketReply(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Write a reply…"
                    disabled={ticketReplySending}
                  />
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
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
                      className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-sm font-semibold disabled:opacity-60"
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
                      className="px-4 py-2.5 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60"
                      disabled={ticketReplySending || !ticketReply.trim() || !activeTicketId}
                    >
                      <Send className="w-4 h-4" />
                      {ticketReplySending ? "Sending..." : "Send reply"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}