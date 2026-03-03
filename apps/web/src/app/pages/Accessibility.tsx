import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { 
  Eye, 
  Ear, 
  Hand, 
  Globe, 
  Smartphone, 
  Keyboard, 
  Volume2,
  Type,
  Monitor,
  Heart,
  ChevronRight,
  Check
} from "lucide-react";
import { Card } from "../components/ui/card";

export function Accessibility() {
  const features = [
    {
      icon: Eye,
      title: "Visual Accessibility",
      description: "Support for screen readers, high contrast mode, and customizable text sizes",
      details: [
        "WCAG 2.1 Level AA compliant",
        "Screen reader optimized navigation",
        "Adjustable font sizes (up to 200%)",
        "High contrast color schemes",
        "Focus indicators on all interactive elements"
      ]
    },
    {
      icon: Ear,
      title: "Audio Alternatives",
      description: "Text transcripts and captions for all audio and video content",
      details: [
        "Full text transcripts for AI sessions",
        "Visual indicators for audio cues",
        "Closed captions for video content",
        "Customizable audio levels",
        "Non-audio alternatives available"
      ]
    },
    {
      icon: Hand,
      title: "Motor Accessibility",
      description: "Keyboard navigation and voice control support throughout the app",
      details: [
        "Full keyboard navigation support",
        "Voice command integration",
        "Customizable touch target sizes",
        "No time-based interactions required",
        "Skip navigation links"
      ]
    },
    {
      icon: Type,
      title: "Cognitive Support",
      description: "Clear layouts, consistent patterns, and simple language",
      details: [
        "Simple, clear language throughout",
        "Consistent navigation patterns",
        "Distraction-free focus modes",
        "Customizable session pacing",
        "Visual progress indicators"
      ]
    }
  ];

  const assistiveTech = [
    {
      icon: Volume2,
      name: "Screen Readers",
      supported: ["JAWS", "NVDA", "VoiceOver", "TalkBack"]
    },
    {
      icon: Keyboard,
      name: "Alternative Input",
      supported: ["Switch Control", "Voice Control", "Eye Tracking", "Keyboard Only"]
    },
    {
      icon: Monitor,
      name: "Display Settings",
      supported: ["High Contrast", "Dark Mode", "Large Text", "Reduced Motion"]
    },
    {
      icon: Globe,
      name: "Language Support",
      supported: ["English", "Spanish", "French", "More coming soon"]
    }
  ];

  const standards = [
    "WCAG 2.1 Level AA Compliant",
    "Section 508 Standards",
    "ADA Compliant",
    "ARIA Landmarks & Roles",
    "Semantic HTML5"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center text-white text-xl">
                💜
              </div>
              <span className="text-xl font-bold">Ezri</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
                How It Works
              </Link>
              <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link to="/accessibility" className="text-foreground font-medium">
                Accessibility
              </Link>
            </nav>
            <div className="flex items-center gap-3">
              <Link to="/login">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 text-sm font-medium hover:text-primary transition-colors"
                >
                  Log In
                </motion.button>
              </Link>
              <Link to="/signup">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 bg-gradient-to-r from-primary to-secondary text-white rounded-lg text-sm font-medium shadow-lg"
                >
                  Get Started
                </motion.button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-6">
              <Heart className="w-4 h-4" />
              Commitment to Inclusion
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl sm:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
          >
            Mental Health Care for Everyone
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
          >
            We're committed to making Ezri accessible to all users, regardless of ability. 
            Mental health support should be available to everyone.
          </motion.p>
        </div>
      </section>

      {/* Accessibility Features */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold mb-4">Accessibility Features</h2>
            <p className="text-muted-foreground">
              Built with inclusive design principles from the ground up
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                >
                  <Card className="p-6 h-full hover:shadow-xl transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-gradient-to-br from-primary to-secondary rounded-xl text-white flex-shrink-0">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {feature.description}
                        </p>
                        <ul className="space-y-2">
                          {feature.details.map((detail, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Assistive Technology Support */}
      <section className="py-16 px-4 sm:px-6 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold mb-4">Assistive Technology Support</h2>
            <p className="text-muted-foreground">
              Ezri works seamlessly with the tools you already use
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {assistiveTech.map((tech, index) => {
              const Icon = tech.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                >
                  <Card className="p-6 text-center h-full">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-xl mb-4">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-bold mb-3">{tech.name}</h3>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {tech.supported.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Standards Compliance */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-8 bg-gradient-to-br from-purple-500 to-blue-500 text-white">
              <h2 className="text-3xl font-bold mb-4 text-center">Standards & Compliance</h2>
              <p className="text-center mb-8 text-white/90">
                We meet or exceed industry accessibility standards
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {standards.map((standard, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.05 }}
                    className="flex items-center gap-3 p-4 bg-white/10 backdrop-blur-sm rounded-lg"
                  >
                    <Check className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{standard}</span>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Help Section */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-4">Need Assistance?</h2>
                <p className="text-muted-foreground">
                  We're here to help ensure you have the best experience with Ezri
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-4">
                    <Heart className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-bold mb-2">Accessibility Support</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Get help with accessibility features
                  </p>
                  <a href="mailto:accessibility@ezri.app" className="text-primary hover:underline text-sm font-medium">
                    accessibility@ezri.app
                  </a>
                </div>

                <div className="text-center p-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-xl mb-4">
                    <Smartphone className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="font-bold mb-2">Documentation</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Learn about accessibility features
                  </p>
                  <Link to="/how-it-works" className="text-primary hover:underline text-sm font-medium inline-flex items-center gap-1">
                    View Guides
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                <div className="text-center p-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl mb-4">
                    <Globe className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="font-bold mb-2">Feedback</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Help us improve accessibility
                  </p>
                  <a href="mailto:feedback@ezri.app" className="text-primary hover:underline text-sm font-medium">
                    feedback@ezri.app
                  </a>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-12 text-center bg-gradient-to-br from-purple-50 to-blue-50">
              <h2 className="text-3xl font-bold mb-4">
                Ready to Start Your Wellness Journey?
              </h2>
              <p className="text-muted-foreground mb-8">
                Join thousands who trust Ezri for their mental health and wellbeing
              </p>
              <Link to="/signup">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-gradient-to-r from-primary to-secondary text-white rounded-lg font-medium shadow-xl hover:shadow-2xl transition-shadow"
                >
                  Get Started
                </motion.button>
              </Link>
              <p className="text-sm text-muted-foreground mt-4">
                7-day trial • No credit card required
              </p>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center text-white">
                  💜
                </div>
                <span className="font-bold">Ezri</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your AI-powered wellness companion, available 24/7
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/how-it-works" className="hover:text-foreground transition-colors">How It Works</Link></li>
                <li><Link to="/privacy" className="hover:text-foreground transition-colors">Privacy & Safety</Link></li>
                <li><Link to="/accessibility" className="hover:text-foreground transition-colors">Accessibility</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link></li>
                <li><Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Get Started</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/signup" className="hover:text-foreground transition-colors">Sign Up</Link></li>
                <li><Link to="/login" className="hover:text-foreground transition-colors">Log In</Link></li>
                <li><Link to="/admin/login" className="hover:text-foreground transition-colors">Admin Credentials</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>© 2024 Ezri. All rights reserved.</p>
            <p className="mt-2">This is not a replacement for professional medical or mental health services.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
