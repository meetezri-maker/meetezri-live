import { Link, useNavigate } from "react-router-dom";
import { PublicNav } from "../components/PublicNav";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { motion } from "motion/react";
import { Check, X, Package, Zap, ArrowRight, Sparkles, Crown, Video, CheckCircle2, Clock, Shield, Heart } from "lucide-react";
import { SUBSCRIPTION_PLANS } from "../utils/subscriptionPlans";
import { useState } from "react";
import type { PlanTier } from "../utils/subscriptionPlans";

export function Pricing() {
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-white">
      <PublicNav />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full mb-4">
              <Crown className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-purple-700 font-semibold">Simple, Transparent Pricing</span>
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              Choose Your <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Wellness Journey</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Start with a 7-day trial. Upgrade anytime for more AI companion time and better pay-as-you-go rates.
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {(Object.keys(SUBSCRIPTION_PLANS) as PlanTier[]).map((planId, index) => {
            const plan = SUBSCRIPTION_PLANS[planId];
            const isPopular = plan.popular;
            
            return (
              <motion.div
                key={planId}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative"
              >
                {isPopular && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center z-10">
                    <span className="px-4 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-lg">
                      MOST POPULAR
                    </span>
                  </div>
                )}
                
                <Card className={`p-6 h-full flex flex-col relative overflow-hidden transition-all duration-300 hover:shadow-2xl ${
                  isPopular 
                    ? 'border-2 border-purple-500 shadow-lg shadow-purple-500/20 scale-105' 
                    : 'border border-border hover:border-purple-300'
                }`}>
                  {/* Background Gradient */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${plan.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
                  
                  <div className="relative z-10 flex flex-col h-full">
                    {/* Plan Header */}
                    <div className="mb-6">
                      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} mb-4`}>
                        {planId === 'trial' && <Sparkles className="w-6 h-6 text-white" />}
                        {planId === 'core' && <Zap className="w-6 h-6 text-white" />}
                        {planId === 'pro' && <Crown className="w-6 h-6 text-white" />}
                      </div>
                      <h3 className="text-xl font-bold mb-2">{plan.displayName}</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold">
                          ${plan.price}
                        </span>
                        {plan.price > 0 && (
                          <span className="text-muted-foreground">/month</span>
                        )}
                      </div>
                      {planId === 'trial' && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {plan.trialDays}-day trial
                        </p>
                      )}
                    </div>

                    {/* Credits */}
                    <div className="mb-6 p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-purple-900">AI Companion Time</span>
                        <Video className="w-4 h-4 text-purple-600" />
                      </div>
                      <p className="text-2xl font-bold text-purple-700">
                        {plan.credits} minutes
                      </p>
                      <p className="text-xs text-purple-600 mt-1">
                        {planId === 'trial' 
                          ? 'One-time trial credits' 
                          : 'Refreshes monthly'}
                      </p>
                    </div>

                    {/* Pay-as-you-go Rate */}
                    {plan.payAsYouGoRate !== null ? (
                      <div className="mb-6 p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-semibold text-green-900">
                            Pay-As-You-Go Available
                          </span>
                        </div>
                        <p className="text-lg font-bold text-green-700">
                          ${plan.payAsYouGoRate}/min
                        </p>
                        {planId === 'pro' && (
                          <p className="text-xs text-green-600 mt-1">40% savings vs Core</p>
                        )}
                      </div>
                    ) : (
                      <div className="mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            No pay-as-you-go option
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Features */}
                    <ul className="space-y-3 mb-8 flex-grow">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                            isPopular ? 'text-purple-600' : 'text-green-600'
                          }`} />
                          <span className="text-sm text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA Button */}
                    <div className="mt-auto">
                      {planId === 'trial' ? (
                        <div
                          onClick={() => {
                            setLoadingPlan(planId);
                            localStorage.setItem('selectedPlan', planId);
                            setTimeout(() => {
                              navigate('/signup');
                            }, 500);
                          }}
                        >
                          <Button 
                            className={`w-full ${
                              isPopular 
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/30' 
                                : 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white'
                            }`}
                            size="lg"
                            isLoading={loadingPlan === planId}
                          >
                            Start Your Trial
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={async () => {
                            try {
                              setLoadingPlan(planId);
                              localStorage.setItem('selectedPlan', planId);
                              const origin = window.location.origin;
                              const successUrl = `${origin}/signup?postCheckout=1&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`;
                              const cancelUrl = `${origin}/pricing`;
                              
                              const { api } = await import("@/lib/api");
                              const result = await api.billing.createGuestSubscription({
                                plan_type: planId,
                                billing_cycle: "monthly",
                                successUrl,
                                cancelUrl
                              });
                              
                              if (result.checkoutUrl) {
                                window.location.href = result.checkoutUrl;
                              }
                            } catch (e) {
                              console.error("Failed to start checkout:", e);
                              setLoadingPlan(null);
                            }
                          }}
                          className={`w-full ${
                            isPopular 
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/30' 
                              : 'bg-black text-white hover:bg-gray-800'
                          }`}
                          size="lg"
                          isLoading={loadingPlan === planId}
                        >
                          Get Started
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      )}
                    </div>

                    {planId === 'trial' && (
                      <p className="text-xs text-center text-muted-foreground mt-3">
                        No credit card required
                      </p>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <Card className="p-6 max-w-3xl mx-auto bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-start gap-4">
              <Shield className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
              <div className="text-left">
                <h4 className="font-semibold text-blue-900 mb-2">
                  Flexible Plans, No Long-Term Commitments
                </h4>
                <p className="text-sm text-blue-700">
                  Start with a trial, upgrade or downgrade anytime. Cancel whenever you want. 
                  Higher-tier plans get better pay-as-you-go rates when you need extra minutes. 
                  All plans include access to our AI companions, mood tracking, and wellness tools.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-2 mb-4"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                  <Heart className="w-5 h-5 text-white" fill="white" />
                </div>
                <span className="text-xl font-semibold">Ezri</span>
              </motion.div>
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
                <li><Link to="/admin/credentials" className="hover:text-foreground transition-colors text-primary font-semibold">Admin Credentials</Link></li>
                <li><Link to="/admin/login" className="hover:text-foreground transition-colors text-primary">Admin Portal</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 Ezri. All rights reserved.</p>
            <p className="mt-2">
              This is not a replacement for professional medical or mental health services.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
