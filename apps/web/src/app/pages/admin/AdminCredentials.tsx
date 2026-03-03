import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { Crown, Building2, Users, Shield, Copy, CheckCircle2, ArrowRight, Heart } from "lucide-react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { FloatingElement } from "../../components/FloatingElement";
import { useState } from "react";

interface AdminCredential {
  role: string;
  name: string;
  username: string;
  password: string;
  description: string;
  icon: typeof Crown;
  gradient: string;
  dashboardPath: string;
  permissions: string[];
}

const adminCredentials: AdminCredential[] = [
  {
    role: "super",
    name: "Super Admin",
    username: "superadmin",
    password: "super123",
    description: "Full platform access & system management",
    icon: Crown,
    gradient: "from-purple-500 to-pink-500",
    dashboardPath: "/admin/dashboard/super",
    permissions: [
      "Full system management",
      "User & role management",
      "Security & compliance settings",
      "System health monitoring",
      "Billing & subscription management",
      "Feature flags & A/B testing",
      "API management",
      "All admin capabilities"
    ]
  },
  {
    role: "org",
    name: "Organization Admin",
    username: "orgadmin",
    password: "org123",
    description: "Manage organization users & settings",
    icon: Building2,
    gradient: "from-blue-500 to-cyan-500",
    dashboardPath: "/admin/dashboard/org",
    permissions: [
      "Organization-wide user management",
      "Content & community moderation",
      "Team management",
      "Organization analytics",
      "Companion management",
      "Crisis monitoring",
      "Support ticket handling"
    ]
  },
  {
    role: "team",
    name: "Team Admin",
    username: "teamadmin",
    password: "team123",
    description: "Manage team members & activities",
    icon: Users,
    gradient: "from-green-500 to-emerald-500",
    dashboardPath: "/admin/dashboard/team",
    permissions: [
      "Team member management",
      "Team activity monitoring",
      "Team role assignments",
      "Team analytics & reports",
      "Session monitoring",
      "Team wellness challenges"
    ]
  }
];

export function AdminCredentials() {
  const [copiedField, setCopiedField] = useState<string>("");

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      // Check if clipboard is available and context is secure
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
          setCopiedField(fieldName);
          setTimeout(() => setCopiedField(""), 2000);
          return;
        } catch (clipboardErr) {
          // Silently fall through to alternative method
          console.warn('Clipboard API failed, trying fallback:', clipboardErr);
        }
      }
      
      // Fallback to older method
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        textArea.remove();
        if (successful) {
          setCopiedField(fieldName);
          setTimeout(() => setCopiedField(""), 2000);
        } else {
          // Copy command failed
          console.warn("Copy command was unsuccessful");
        }
      } catch (err) {
        console.warn("Fallback copy failed:", err);
        textArea.remove();
      }
    } catch (err) {
      console.warn("Failed to copy:", err);
      // Silently fail - don't show error to user
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 relative overflow-hidden">
      {/* Floating background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <FloatingElement delay={0} duration={4}>
          <div className="absolute top-20 left-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
        </FloatingElement>
        <FloatingElement delay={1.5} duration={5}>
          <div className="absolute bottom-40 right-20 w-40 h-40 bg-accent/20 rounded-full blur-3xl" />
        </FloatingElement>
        <FloatingElement delay={3} duration={6}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-secondary/20 rounded-full blur-3xl" />
        </FloatingElement>
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl"
          >
            <Heart className="w-8 h-8 text-white" fill="white" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-2 mb-2"
          >
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Admin Login Credentials
            </h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-gray-300 max-w-2xl mx-auto"
          >
            Three admin types with different access levels. Use these credentials to login and explore each dashboard.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {adminCredentials.map((admin, index) => (
            <motion.div
              key={admin.role}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.4, duration: 0.5 }}
              whileHover={{ scale: 1.02, y: -5 }}
              className="relative"
            >
              <Card className="p-6 shadow-2xl backdrop-blur-sm bg-white/95 relative overflow-hidden group">
                <div className={`absolute inset-0 bg-gradient-to-br ${admin.gradient} opacity-5`} />
                
                <div className="relative z-10">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${admin.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                    <admin.icon className="w-7 h-7 text-white" />
                  </div>
                  
                  <h3 className="font-bold text-xl mb-2">{admin.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {admin.description}
                  </p>

                  <div className="space-y-3 mb-4">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-600">Username</label>
                        <button
                          onClick={() => copyToClipboard(admin.username, `username-${admin.role}`)}
                          className="text-primary hover:text-primary/80 transition-colors"
                        >
                          {copiedField === `username-${admin.role}` ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <p className="font-mono text-sm font-semibold">{admin.username}</p>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-600">Password</label>
                        <button
                          onClick={() => copyToClipboard(admin.password, `password-${admin.role}`)}
                          className="text-primary hover:text-primary/80 transition-colors"
                        >
                          {copiedField === `password-${admin.role}` ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <p className="font-mono text-sm font-semibold">{admin.password}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-semibold mb-2">Key Permissions</h4>
                    <ul className="space-y-1">
                      {admin.permissions.slice(0, 4).map((permission, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{permission}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Link to="/admin/login">
                    <Button className={`w-full bg-gradient-to-r ${admin.gradient} hover:opacity-90 transition-opacity`}>
                      <span className="flex items-center justify-center gap-2">
                        Login as {admin.name}
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    </Button>
                  </Link>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Quick Start Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <Card className="p-6 shadow-2xl backdrop-blur-sm bg-white/95">
            <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Quick Start Guide
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <span className="font-bold text-primary">1</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Click "Login as Admin" button for any admin type
                </p>
              </div>

              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <span className="font-bold text-primary">2</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Select the admin role you want to explore
                </p>
              </div>

              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <span className="font-bold text-primary">3</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enter the username and password from above
                </p>
              </div>

              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <span className="font-bold text-primary">4</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Explore the admin dashboard and its features
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong className="font-semibold">Note:</strong> This is a demo environment using mock data. All admin credentials are for testing purposes only and use localStorage for persistence.
              </p>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-8 text-center"
        >
          <Link to="/">
            <Button variant="ghost" className="text-white hover:text-white/80">
              ← Back to Ezri App
            </Button>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="mt-4 text-center"
        >
          <p className="text-xs text-gray-400">
            <Shield className="w-3 h-3 inline mr-1" />
            Protected by industry-standard security
          </p>
        </motion.div>
      </div>
    </div>
  );
}