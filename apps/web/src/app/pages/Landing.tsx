import { Link } from "react-router";
import { PublicNav } from "../components/PublicNav";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { AnimatedCard } from "../components/AnimatedCard";
import { FloatingElement } from "../components/FloatingElement";
import { motion } from "motion/react";
import { Heart, Video, Shield, Clock, Sparkles, CheckCircle2, ArrowRight, Star, Zap, Check, Crown } from "lucide-react";
import { SUBSCRIPTION_PLANS } from "../utils/subscriptionPlans";
import type { PlanTier } from "../utils/subscriptionPlans";

export function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-white overflow-hidden">
      <PublicNav />
      
      {/* Hero Section with Floating Elements */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-20 pb-16">
        {/* Floating background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <FloatingElement delay={0} duration={4} yOffset={30}>
            <div className="absolute top-20 left-10 w-20 h-20 bg-primary/10 rounded-full blur-2xl" />
          </FloatingElement>
          <FloatingElement delay={1} duration={5} yOffset={25}>
            <div className="absolute top-40 right-20 w-32 h-32 bg-accent/10 rounded-full blur-2xl" />
          </FloatingElement>
          <FloatingElement delay={2} duration={6} yOffset={35}>
            <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-secondary/10 rounded-full blur-2xl" />
          </FloatingElement>
        </div>
        
        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-4 h-4 text-primary" />
            </motion.div>
            <span className="text-sm text-primary font-medium">Your AI-Powered Wellness Companion</span>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent leading-tight"
          >
            Talk to Ezri.
            <br />
            Feel Better.
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-lg md:text-xl text-muted-foreground mb-8 px-4"
          >
            Connect with your AI wellness companion through FaceTime-style sessions. 
            Available 24/7 for support, mood tracking, and guided wellness tools.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center px-4"
          >
            <div onClick={() => localStorage.setItem('selectedPlan', 'trial')}>
              <Link to="/signup" className="w-full sm:w-auto">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full"
                >
                  <Button size="lg" className="w-full sm:w-auto group relative overflow-hidden">
                    <span className="relative z-10 flex items-center gap-2">
                      Start Your Trial
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-accent to-secondary"
                      initial={{ x: "-100%" }}
                      whileHover={{ x: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                  </Button>
                </motion.div>
              </Link>
            </div>
            <Link to="/how-it-works" className="w-full sm:w-auto">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full"
              >
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Learn More
                </Button>
              </motion.div>
            </Link>
          </motion.div>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-sm text-muted-foreground mt-6 flex items-center justify-center gap-2 flex-wrap px-4"
          >
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-secondary" />
              No credit card required
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-secondary" />
              7-day trial
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-secondary" />
              Cancel anytime
            </span>
          </motion.p>
        </div>
      </section>
      
      {/* Features Grid with 3D Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold text-center mb-12"
        >
          Why Choose Ezri?
        </motion.h2>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <AnimatedCard delay={0}>
            <Card className="p-6 h-full hover:shadow-2xl transition-shadow bg-gradient-to-br from-white to-primary/5 border-primary/20">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center mb-4 shadow-lg"
              >
                <Video className="w-6 h-6 text-white" />
              </motion.div>
              <h3 className="text-lg font-semibold mb-2">FaceTime Sessions</h3>
              <p className="text-muted-foreground text-sm">
                Connect through natural video conversations whenever you need support
              </p>
            </Card>
          </AnimatedCard>
          
          <AnimatedCard delay={0.1}>
            <Card className="p-6 h-full hover:shadow-2xl transition-shadow bg-gradient-to-br from-white to-secondary/5 border-secondary/20">
              <motion.div
                whileHover={{ scale: 1.1, rotate: -5 }}
                className="w-12 h-12 bg-gradient-to-br from-secondary to-secondary/80 rounded-xl flex items-center justify-center mb-4 shadow-lg"
              >
                <Heart className="w-6 h-6 text-white" />
              </motion.div>
              <h3 className="text-lg font-semibold mb-2">Mood Tracking</h3>
              <p className="text-muted-foreground text-sm">
                Track your emotional journey with insights and trends over time
              </p>
            </Card>
          </AnimatedCard>
          
          <AnimatedCard delay={0.2}>
            <Card className="p-6 h-full hover:shadow-2xl transition-shadow bg-gradient-to-br from-white to-accent/5 border-accent/20">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="w-12 h-12 bg-gradient-to-br from-accent to-accent/80 rounded-xl flex items-center justify-center mb-4 shadow-lg"
              >
                <Shield className="w-6 h-6 text-white" />
              </motion.div>
              <h3 className="text-lg font-semibold mb-2">Private & Secure</h3>
              <p className="text-muted-foreground text-sm">
                Your conversations are encrypted and your data is always protected
              </p>
            </Card>
          </AnimatedCard>
          
          <AnimatedCard delay={0.3}>
            <Card className="p-6 h-full hover:shadow-2xl transition-shadow bg-gradient-to-br from-white to-orange-500/5 border-orange-500/20">
              <motion.div
                whileHover={{ scale: 1.1, rotate: -5 }}
                className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-4 shadow-lg"
              >
                <Clock className="w-6 h-6 text-white" />
              </motion.div>
              <h3 className="text-lg font-semibold mb-2">24/7 Available</h3>
              <p className="text-muted-foreground text-sm">
                Get support whenever you need it, day or night
              </p>
            </Card>
          </AnimatedCard>
        </div>
      </section>
      
      {/* How It Works - Interactive */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold text-center mb-12"
        >
          Simple. Effective. Personal.
        </motion.h2>
        
        <div className="space-y-16">
          {[
            {
              step: 1,
              title: "Sign Up & Onboard",
              description: "Create your account and complete a quick wellness baseline to help Ezri understand you better",
              icon: CheckCircle2,
              color: "primary",
              gradient: "from-primary/20 to-accent/20"
            },
            {
              step: 2,
              title: "Connect With Ezri",
              description: "Start a FaceTime-style session whenever you need to talk, decompress, or get guided support",
              icon: Video,
              color: "secondary",
              gradient: "from-secondary/20 to-primary/20"
            },
            {
              step: 3,
              title: "Track & Improve",
              description: "Monitor your mood, journal your thoughts, and access wellness tools designed for your needs",
              icon: Heart,
              color: "accent",
              gradient: "from-accent/20 to-secondary/20"
            }
          ].map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
              className={`flex flex-col ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-8`}
            >
              <div className="flex-1 text-center md:text-left">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-full text-white font-bold mb-4 shadow-lg"
                >
                  {item.step}
                </motion.div>
                <h3 className="text-2xl font-semibold mb-3">{item.title}</h3>
                <p className="text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <motion.div
                whileHover={{ scale: 1.05, rotate: 2 }}
                className={`flex-1 bg-gradient-to-br ${item.gradient} rounded-3xl h-64 flex items-center justify-center shadow-xl`}
              >
                <motion.div
                  animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, 0]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <item.icon className={`w-20 h-20 text-${item.color}`} />
                </motion.div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </section>
      
      {/* Social Proof */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="flex justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
              >
                <Star className="w-8 h-8 fill-yellow-400 text-yellow-400" />
              </motion.div>
            ))}
          </div>
          <p className="text-2xl font-semibold mb-2">Trusted by 10,000+ Users</p>
          <p className="text-muted-foreground">Join our growing community on their wellness journey</p>
        </motion.div>
      </section>
      
      {/* CTA Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <AnimatedCard>
          <Card className="p-8 md:p-12 bg-gradient-to-br from-primary/10 via-accent/10 to-secondary/10 border-primary/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-grid-white/10 [mask-image:radial-gradient(white,transparent_80%)]" />
            <div className="relative z-10 text-center">
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 200 }}
                className="inline-flex items-center gap-2 mb-6"
              >
                <Zap className="w-6 h-6 text-primary" />
                <h2 className="text-3xl md:text-4xl font-bold">Ready to Start Your Wellness Journey?</h2>
              </motion.div>
              <p className="text-muted-foreground mb-8 text-lg max-w-2xl mx-auto">
                Join thousands who trust Ezri for their mental health and wellbeing
              </p>
              <div onClick={() => localStorage.setItem('selectedPlan', 'trial')}>
                <Link to="/signup">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button size="lg" className="mb-4">
                      Start Trial
                    </Button>
                  </motion.div>
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">
                7-day trial • No credit card required
              </p>
            </div>
          </Card>
        </AnimatedCard>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full mb-4">
              <Crown className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-purple-700 font-semibold">Simple, Transparent Pricing</span>
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              Choose Your <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Wellness Journey</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
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
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
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
                  
                  <div className="relative z-10">
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
                    <div onClick={() => {
                      localStorage.setItem('selectedPlan', planId);
                    }}>
                      <Link to="/signup" className="block">
                        <Button 
                          className={`w-full ${
                            isPopular 
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/30' 
                              : planId === 'trial'
                              ? 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white'
                              : ''
                          }`}
                          size="lg"
                        >
                          {planId === 'trial' ? 'Start Your Trial' : 'Get Started'}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
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
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
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
      </section>
      
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