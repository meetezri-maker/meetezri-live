import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Heart, CheckCircle2, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { FloatingElement } from "../components/FloatingElement";
import { PublicNav } from "../components/PublicNav";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form";

const signupSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, isLoading: isAuthLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<'form' | 'trialDetails'>('form');
  const [trialContact, setTrialContact] = useState({
    name: '',
    phone: '',
    relationship: ''
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [trialDetailsLoading, setTrialDetailsLoading] = useState(false);
  const contactValid = trialContact.name.trim().length >= 2 
    && /^\d{7,}$/.test(trialContact.phone.trim())
    && trialContact.relationship.trim().length >= 2;

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (!isAuthLoading && user && profile) {
      try {
        const selectedPlan = window.localStorage.getItem('selectedPlan');
        const planPurchased = window.localStorage.getItem('planPurchased') === '1';
        if (selectedPlan === 'trial' && !planPurchased && phase === 'trialDetails') {
          return;
        }
      } catch {}
      navigate("/app/dashboard");
    }
  }, [user, profile, isAuthLoading, navigate, phase]);

  // Default to free trial flow when landing on signup (e.g. from "Start Free Trial")
  useEffect(() => {
    try {
      const current = window.localStorage.getItem('selectedPlan');
      if (!current) {
        window.localStorage.setItem('selectedPlan', 'trial');
      }
    } catch {}
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const postCheckout = params.get('postCheckout') === '1';
    const plan = params.get('plan');
    const sessionId = params.get('session_id');
    
    if (postCheckout) {
      try {
        window.localStorage.setItem('planPurchased', '1');
        if (plan) {
          window.localStorage.setItem('selectedPlan', plan);
        }
        if (sessionId) {
          window.localStorage.setItem('stripeSessionId', sessionId);
        }
      } catch {}
    }
  }, [location.search]);

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in with Google");
    }
  };

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);
    try {
      // Check if user exists before attempting signup
      const checkResult = await api.checkUserExists(data.email);
      
      if (checkResult.exists) {
        toast.error("Account already exists. Please log in instead.");
        setIsLoading(false);
        // Optional: navigate("/login");
        return;
      }

      const selectedPlan = window.localStorage.getItem('selectedPlan');
      const planPurchased = window.localStorage.getItem('planPurchased') === '1';

      if (selectedPlan === 'trial' && !planPurchased) {
        // For free trial: create account client-side so a session is established immediately
        
        // Explicitly set redirect URL to avoid defaults
        let origin = window.location.origin;
        if (origin.includes('meetezri-live-web.vercel.app')) {
          origin = 'https://meetezri-live-web.vercel.app';
        }
        const redirectUrl = `${origin}/auth/callback?redirect=${encodeURIComponent('/app/user-profile')}`;

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              first_name: data.firstName,
              last_name: data.lastName,
              email_verification_required: true
            },
          },
        });
        if (signUpError) {
          throw signUpError;
        }
        // Move to emergency contact step without requiring email verification
        setPhase('trialDetails');
        toast.success("Account created! Add an emergency contact to continue.");
        return;
      }

      // Paid/other flows: use backend signup to send branded emails
      const stripeSessionId = window.localStorage.getItem('stripeSessionId');
      
      await api.signup({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        stripe_session_id: stripeSessionId || undefined
      });

      toast.success("Account created! Please verify your email to continue.");
      navigate("/verify-email");
    } catch (error: any) {
      const rawMessage = error.message || "";
      const message = rawMessage.toLowerCase();

      const isRateLimit = error.code === "over_email_send_rate_limit";
      const isDuplicateEmail =
        error.code === "user_already_exists" ||
        error.code === "email_exists" ||
        message.includes("user already registered") ||
        message.includes("already exists") ||
        message.includes("duplicate key value") ||
        message.includes("users_email_key") ||
        message.includes("email address is already in use");

      if (isRateLimit) {
        toast.error("Too many attempts. Please try again later or use a different email.");
      } else if (isDuplicateEmail) {
        toast.error("Account already created. Please log in instead.");
        navigate("/login");
      } else {
        toast.error(rawMessage || "Failed to create account");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const benefits = [
    {
      icon: CheckCircle2,
      title: "7-Day Trial",
      description: "Try all features with no commitment"
    },
    {
      icon: CheckCircle2,
      title: "24/7 Access",
      description: "Connect with Ezri anytime, anywhere"
    },
    {
      icon: CheckCircle2,
      title: "Cancel Anytime",
      description: "No long-term commitment required"
    },
    {
      icon: CheckCircle2,
      title: "Private & Secure",
      description: "Your data is encrypted and protected"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-white relative overflow-hidden">
      <PublicNav />
      
      {/* Floating background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <FloatingElement delay={0} duration={4}>
          <div className="absolute top-20 right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
        </FloatingElement>
        <FloatingElement delay={1.5} duration={5}>
          <div className="absolute bottom-40 left-20 w-40 h-40 bg-secondary/10 rounded-full blur-3xl" />
        </FloatingElement>
        <FloatingElement delay={2.5} duration={6}>
          <div className="absolute top-1/2 left-1/2 w-36 h-36 bg-accent/10 rounded-full blur-3xl" />
        </FloatingElement>
      </div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Side - Benefits */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="hidden md:block"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
              className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center mb-6 shadow-xl"
            >
              <Heart className="w-8 h-8 text-white" fill="white" />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-3xl lg:text-4xl font-bold">
                  Start Your Wellness Journey Today
                </h2>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="w-6 h-6 text-primary" />
                </motion.div>
              </div>
              <p className="text-muted-foreground mb-8 text-lg">
                Join thousands who trust Ezri for their mental health and wellbeing
              </p>
            </motion.div>
            
            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  whileHover={{ x: 5, transition: { duration: 0.2 } }}
                  className="flex items-start gap-3 group"
                >
                  <motion.div
                    whileHover={{ scale: 1.2, rotate: 360 }}
                    transition={{ duration: 0.3 }}
                  >
                    <benefit.icon className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                  </motion.div>
                  <div>
                    <p className="font-semibold group-hover:text-primary transition-colors">{benefit.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {benefit.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
          
          {/* Right Side - Form */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="p-6 md:p-8 shadow-2xl hover:shadow-3xl transition-shadow backdrop-blur-sm bg-white/90">
              <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl md:text-3xl font-bold mb-6"
              >
                {phase === 'form' ? 'Create Your Account' : 'Emergency Contact & Terms'}
              </motion.h1>

              {phase === 'form' ? (
                <>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="mb-6"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full relative py-5 border-muted-foreground/20 hover:bg-gray-50/50"
                      onClick={handleGoogleLogin}
                    >
                      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      <span className="text-black">Sign up with Google</span>
                    </Button>

                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-muted-foreground/20" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-muted-foreground font-medium tracking-wider">
                          Or sign up with email
                        </span>
                      </div>
                    </div>
                  </motion.div>

                  <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="John"
                                  className="bg-input-background transition-all focus:scale-[1.02]"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </motion.div>
                      
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 }}
                      >
                        <FormField
                          control={form.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Doe"
                                  className="bg-input-background transition-all focus:scale-[1.02]"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </motion.div>
                    </div>
                    
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="you@example.com"
                                className="bg-input-background transition-all focus:scale-[1.02]"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.45 }}
                    >
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="At least 8 characters"
                                className="bg-input-background transition-all focus:scale-[1.02]"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Re-enter your password"
                                className="bg-input-background transition-all focus:scale-[1.02]"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button type="submit" className="w-full group relative overflow-hidden" disabled={isLoading}>
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Creating Account...
                            </>
                          ) : (
                            <>
                              Create Account
                              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </>
                          )}
                        </span>
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-accent to-secondary"
                          initial={{ x: "-100%" }}
                          whileHover={{ x: 0 }}
                          transition={{ duration: 0.3 }}
                        />
                      </Button>
                    </motion.div>
                  </form>
                  </Form>
                </>
              ) : (
                <>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label>Emergency Contact Name</Label>
                      <Input
                        placeholder="e.g., Jane Doe"
                        value={trialContact.name}
                        aria-invalid={!trialContact.name.trim()}
                        className={!trialContact.name.trim() ? "border-red-500 focus-visible:ring-red-500" : ""}
                        onChange={(e) => setTrialContact({ ...trialContact, name: e.target.value })}
                      />
                      {!trialContact.name.trim() && (
                        <p className="text-xs text-red-600 mt-1">Name is required</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Emergency Contact Phone</Label>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]{7,}"
                        placeholder="Digits only"
                        value={trialContact.phone}
                        aria-invalid={!!trialContact.phone && !/^\d{7,}$/.test(trialContact.phone.trim())}
                        className={trialContact.phone && !/^\d{7,}$/.test(trialContact.phone.trim()) ? "border-red-500 focus-visible:ring-red-500" : ""}
                        onChange={(e) => setTrialContact({ ...trialContact, phone: e.target.value })}
                      />
                      {trialContact.phone && !/^\d{7,}$/.test(trialContact.phone.trim()) && (
                        <p className="text-xs text-red-600 mt-1">Enter at least 7 digits</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Relationship</Label>
                      <Input
                        placeholder="e.g., Sister"
                        value={trialContact.relationship}
                        aria-invalid={!trialContact.relationship.trim()}
                        className={!trialContact.relationship.trim() ? "border-red-500 focus-visible:ring-red-500" : ""}
                        onChange={(e) => setTrialContact({ ...trialContact, relationship: e.target.value })}
                      />
                      {!trialContact.relationship.trim() && (
                        <p className="text-xs text-red-600 mt-1">Relationship is required</p>
                      )}
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                      />
                      <span>
                        I agree to the <Link to="/terms" className="text-primary hover:underline">Terms & Conditions</Link> and <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                      </span>
                    </label>
                    {!termsAccepted && (
                      <p className="text-xs text-red-600">Please accept the terms to continue</p>
                    )}
                  </div>
                  <div className="mt-6">
                    <Button
                      className="w-full"
                      disabled={!termsAccepted || !contactValid || trialDetailsLoading}
                      onClick={async () => {
                        try {
                          if (!termsAccepted) {
                            toast.error("Please accept the terms and conditions to continue.");
                            return;
                          }
                          if (!contactValid) {
                            const errors = [];
                            if (trialContact.name.trim().length < 2) errors.push("name (minimum 2 characters)");
                            if (!/^\d{7,}$/.test(trialContact.phone.trim())) errors.push("phone (minimum 7 digits)");
                            if (trialContact.relationship.trim().length < 2) errors.push("relationship (minimum 2 characters)");
                            toast.error(`Please complete emergency contact details correctly: ${errors.join(", ")}`);
                            return;
                          }
                          setTrialDetailsLoading(true);
                          
                          // Check session status with detailed logging
                          const { data: sessionData } = await supabase.auth.getSession();
                          console.log("Session status:", sessionData?.session ? "Active" : "None");

                          if (!sessionData?.session) {
                            const email = form.getValues('email');
                            const password = form.getValues('password');
                            
                            // Try to sign in
                            const { error } = await supabase.auth.signInWithPassword({ email, password });
                            
                            if (error) {
                              console.error("Sign in failed:", error);
                              
                              // When "Confirm email" is ON, Supabase blocks sign-in until the user verifies
                              const isEmailNotConfirmed =
                                error.message?.toLowerCase().includes("email not confirmed") ||
                                error.message?.toLowerCase().includes("confirm your email") ||
                                error.code === "email_not_confirmed";
                                
                              if (isEmailNotConfirmed) {
                                // If the user claims they disabled confirmation but this error appears,
                                // it implies the setting hasn't propagated or the user was created before the change.
                                toast.error(
                                  "Verification required. Please check your email to activate your account.",
                                  {
                                    action: {
                                      label: "Resend Email",
                                      onClick: async () => {
                                        await supabase.auth.resend({ type: "signup", email });
                                        toast.success("Sent!");
                                      },
                                    },
                                  }
                                );
                                setTrialDetailsLoading(false);
                                return;
                              }
                              throw error;
                            }
                          }

                          try {
                            const { api } = await import("@/lib/api");
                            // Ensure profile exists before updating (backend creates it on initProfile)
                            await api.initProfile();
                            await api.updateProfile({
                              emergency_contact_name: trialContact.name,
                              emergency_contact_phone: trialContact.phone,
                              emergency_contact_relationship: trialContact.relationship
                            });
                            await api.billing.createSubscription({
                              plan_type: "trial",
                              billing_cycle: "monthly"
                            });
                          } catch (subErr) {
                            console.error("Post-signup setup error:", subErr);
                          }

                          try {
                            window.localStorage.setItem("planPurchased", "1");
                          } catch {}

                          navigate("/app/dashboard");
                        } catch (err: any) {
                          toast.error(err.message || "Failed to start session");
                        } finally {
                          setTrialDetailsLoading(false);
                        }
                      }}
                    >
                      {trialDetailsLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Setting up your account…
                        </>
                      ) : (
                        <>
                          Start Your First Session
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-6 text-center"
              >
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link to="/login" className="text-primary font-medium hover:underline">
                    Log in
                  </Link>
                </p>
              </motion.div>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-xs text-muted-foreground mt-6 text-center"
              >
                By signing up, you agree to our{" "}
                <Link to="/terms" className="text-primary hover:underline">
                  Terms & Conditions
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </motion.p>
            </Card>
            
            {/* Mobile Benefits */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="md:hidden mt-8 space-y-3"
            >
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <benefit.icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">{benefit.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
