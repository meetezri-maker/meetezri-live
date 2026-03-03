import { AppLayout } from "../../components/AppLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Phone,
  MessageCircle,
  AlertTriangle,
  Heart,
  MapPin,
  Clock,
  Globe,
  ExternalLink,
  Shield,
  HeartPulse,
  Users,
  ArrowLeft,
  Loader2
} from "lucide-react";
import { api } from "../../../lib/api";

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  is_trusted: boolean;
  created_at: string;
  updated_at: string;
}

export function CrisisResources() {
  const navigate = useNavigate();

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const data = await api.emergencyContacts.getAll();
        setContacts(data);
      } catch (error) {
        console.error("Failed to load emergency contacts:", error);
      } finally {
        setIsLoadingContacts(false);
      }
    };

    loadContacts();
  }, []);

  const emergencyContacts = [
    {
      name: "National Suicide Prevention Lifeline",
      phone: "988",
      description: "24/7 crisis support",
      icon: Phone,
      color: "from-red-500 to-orange-600"
    },
    {
      name: "Crisis Text Line",
      phone: "Text HOME to 741741",
      description: "24/7 text-based support",
      icon: MessageCircle,
      color: "from-blue-500 to-cyan-600"
    },
    {
      name: "Emergency Services",
      phone: "911",
      description: "Immediate emergency assistance",
      icon: AlertTriangle,
      color: "from-red-600 to-red-700"
    },
    {
      name: "SAMHSA National Helpline",
      phone: "1-800-662-4357",
      description: "Mental health & substance abuse",
      icon: HeartPulse,
      color: "from-purple-500 to-pink-600"
    }
  ];

  const resources = [
    {
      title: "Mental Health America",
      description: "Find resources and screening tools",
      url: "mhanational.org",
      icon: Heart
    },
    {
      title: "NAMI - National Alliance on Mental Illness",
      description: "Support, education, and advocacy",
      url: "nami.org",
      icon: Users
    },
    {
      title: "Psychology Today",
      description: "Find companions near you",
      url: "psychologytoday.com",
      icon: MapPin
    },
    {
      title: "BetterHelp",
      description: "Online therapy platform",
      url: "betterhelp.com",
      icon: Globe
    }
  ];

  const safetyPlan = [
    {
      step: 1,
      title: "Warning Signs",
      content: "Recognize when you're in crisis"
    },
    {
      step: 2,
      title: "Coping Strategies",
      content: "Things you can do on your own"
    },
    {
      step: 3,
      title: "Social Support",
      content: "People who can help distract you"
    },
    {
      step: 4,
      title: "Professional Help",
      content: "Contacts for professional support"
    },
    {
      step: 5,
      title: "Emergency",
      content: "Remove means and contact emergency services"
    }
  ];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
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
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Crisis Resources</h1>
          </div>
          <p className="text-muted-foreground">
            24/7 support when you need it most. You're not alone.
          </p>
        </motion.div>

        {/* Emergency Alert */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Card className="p-6 bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-xl border-0">
            <div className="flex items-start gap-4">
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <AlertTriangle className="w-8 h-8 flex-shrink-0" />
              </motion.div>
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2">If you're in immediate danger:</h2>
                <p className="text-white/90 mb-4">
                  Call 911 or go to your nearest emergency room. Your safety is the top priority.
                </p>
                <motion.a
                  href="tel:911"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-block"
                >
                  <Button
                    size="lg"
                    className="bg-white text-red-600 hover:bg-white/90 font-bold"
                  >
                    <Phone className="w-5 h-5 mr-2" />
                    Call 911 Now
                  </Button>
                </motion.a>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* 24/7 Hotlines */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="text-xl font-bold mb-4">24/7 Crisis Hotlines</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {emergencyContacts.map((contact, index) => {
              const Icon = contact.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -3 }}
                >
                  <Card
                    className={`p-6 bg-gradient-to-br ${contact.color} text-white shadow-lg cursor-pointer group`}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <motion.div
                        whileHover={{ rotate: 10, scale: 1.1 }}
                        className="p-3 bg-white/20 rounded-xl backdrop-blur-sm"
                      >
                        <Icon className="w-6 h-6" />
                      </motion.div>
                      <div className="flex-1">
                        <h3 className="font-bold mb-1">{contact.name}</h3>
                        <p className="text-sm text-white/90">{contact.description}</p>
                      </div>
                    </div>
                    <motion.a
                      href={`tel:${contact.phone.replace(/\D/g, "")}`}
                      whileTap={{ scale: 0.95 }}
                      className="block"
                    >
                      <div className="bg-white/20 backdrop-blur-sm p-4 rounded-lg group-hover:bg-white/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold">{contact.phone}</span>
                          <Phone className="w-5 h-5" />
                        </div>
                      </div>
                    </motion.a>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Personal Contacts */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold">Your Emergency Contacts</h2>
              </div>
              <div className="space-y-3">
                {isLoadingContacts && (
                  <div className="flex items-center justify-center py-6 text-muted-foreground">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span>Loading your emergency contacts…</span>
                  </div>
                )}

                {!isLoadingContacts && contacts.length === 0 && (
                  <div className="p-4 bg-gray-50 rounded-lg text-sm text-muted-foreground">
                    You haven't added any emergency contacts yet. Add someone you trust so their
                    real phone number is available here during a crisis.
                  </div>
                )}

                {!isLoadingContacts &&
                  contacts.map((contact, index) => (
                    <motion.div
                      key={contact.id ?? index.toString()}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + index * 0.05 }}
                      whileHover={{ x: 5 }}
                      className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-bold">{contact.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {contact.relationship || "Emergency contact"}
                          </p>
                        </div>
                        {contact.phone && (
                          <motion.a
                            href={`tel:${contact.phone.replace(/\D/g, "")}`}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="p-2 bg-primary text-white rounded-full hover:bg-primary/90"
                          >
                            <Phone className="w-4 h-4" />
                          </motion.a>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        {contact.phone ? (
                          <>
                            <span className="font-medium">{contact.phone}</span>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>Available as listed</span>
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            No phone number saved for this contact yet.
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/app/settings/emergency-contacts')}
                >
                  + Add Contact
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* Safety Plan */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold">Safety Plan</h2>
              </div>
              <div className="space-y-3">
                {safetyPlan.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + index * 0.05 }}
                    whileHover={{ x: 5 }}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 flex-shrink-0 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                      {item.step}
                    </div>
                    <div>
                      <h3 className="font-bold mb-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.content}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <Button
                className="w-full mt-4"
                onClick={() => navigate('/app/settings/safety-plan')}
              >
                View Full Safety Plan
              </Button>
            </Card>
          </motion.div>
        </div>

        {/* Additional Resources */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">Additional Resources</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {resources.map((resource, index) => {
                const Icon = resource.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 + index * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <a
                      href={`https://${resource.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <Icon className="w-6 h-6 text-primary" />
                        <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                      </div>
                      <h3 className="font-bold mb-1 group-hover:text-primary transition-colors">
                        {resource.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {resource.description}
                      </p>
                      <p className="text-xs text-primary font-medium">{resource.url}</p>
                    </a>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Support Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="mt-8"
        >
          <Card className="p-6 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white shadow-xl">
            <div className="flex items-start gap-3">
              <Heart className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg mb-2">You Are Not Alone</h3>
                <p className="text-white/90">
                  Reaching out for help is a sign of strength, not weakness. These resources are here for you 24/7. Your life matters, and there are people who care and want to help.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
