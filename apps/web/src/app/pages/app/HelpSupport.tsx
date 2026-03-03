import { motion } from "motion/react";
import { 
  HelpCircle,
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
  AlertCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { AppLayout } from "@/app/components/AppLayout";

export function HelpSupport() {
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [submitted, setSubmitted] = useState(false);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate form submission
    setSubmitted(true);
    setTimeout(() => {
      setShowContactForm(false);
      setSubmitted(false);
      setContactForm({
        name: "",
        email: "",
        subject: "",
        message: ""
      });
    }, 2000);
  };

  const handleResourceClick = (title: string) => {
    setSelectedResource(title);
    setShowResourceModal(true);
  };

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

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link 
            to="/app/settings" 
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
              <HelpCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Help & Support</h1>
              <p className="text-gray-600">Get assistance and find answers</p>
            </div>
          </div>
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

          <motion.a
            href="tel:1-800-273-8255"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-gradient-to-br from-red-500 to-rose-600 text-white rounded-2xl p-6 shadow-lg text-left"
          >
            <AlertCircle className="w-8 h-8 mb-3" />
            <h3 className="font-bold text-lg mb-1">Crisis Hotline</h3>
            <p className="text-sm text-red-100">24/7 immediate support: 1-800-273-8255</p>
          </motion.a>
        </motion.div>

        {/* Contact Form */}
        {showContactForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-4">Send us a message</h2>
            
            {submitted ? (
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="text-center py-8"
              >
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Message Sent!</h3>
                <p className="text-gray-600">We'll get back to you within 24 hours.</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <select
                    required
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    required
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Tell us how we can help..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowContactForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
          <h2 className="text-xl font-bold text-gray-900 mb-4">Help Resources</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {resources.map((resource, index) => {
              const Icon = resource.icon;
              return (
                <motion.button
                  key={index}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleResourceClick(resource.title)}
                  className="bg-white rounded-xl p-5 shadow-md border border-gray-100 hover:shadow-lg transition-all text-left"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${resource.color} flex items-center justify-center mb-3`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">{resource.title}</h3>
                  <p className="text-sm text-gray-600 mb-3">{resource.description}</p>
                  <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
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
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 + index * 0.05 }}
                className="p-4 bg-gray-50 rounded-xl"
              >
                <h3 className="font-bold text-gray-900 mb-2 flex items-start gap-2">
                  <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  {faq.question}
                </h3>
                <p className="text-sm text-gray-600 ml-7">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Contact Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-2xl p-6"
        >
          <div className="flex items-start gap-4">
            <Clock className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-indigo-900 mb-2">Support Hours</h3>
              <p className="text-sm text-indigo-700 mb-3">
                Our support team is available Monday - Friday, 9am - 6pm EST. For urgent matters outside these hours, please use our crisis hotline.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-indigo-800">
                  <Mail className="w-4 h-4" />
                  <span>support@ezri.health</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-indigo-800">
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
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ExternalLink className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{selectedResource}</h3>
                <p className="text-gray-600 mb-6">
                  {selectedResource === "User Guide" && "This would open the complete Ezri user documentation and tutorials in a production environment."}
                  {selectedResource === "Video Tutorials" && "This would open our video tutorial library with step-by-step guides in a production environment."}
                  {selectedResource === "Community Forum" && "This would open the Ezri community forum where you can connect with other users in a production environment."}
                  {selectedResource === "Knowledge Base" && "This would open our comprehensive knowledge base with articles and FAQs in a production environment."}
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <p className="text-sm text-blue-900">
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
            </motion.div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}