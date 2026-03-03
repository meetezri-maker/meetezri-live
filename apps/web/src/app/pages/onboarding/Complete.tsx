import { OnboardingLayout } from "../../components/OnboardingLayout";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Heart, Sparkles, Video, MessageSquare, TrendingUp, ArrowRight, Loader2 } from "lucide-react";
import { FloatingElement } from "../../components/FloatingElement";
import { useOnboarding } from "@/app/contexts/OnboardingContext";

export function OnboardingComplete() {
  const { completeOnboarding, isLoading } = useOnboarding();

  const quickTips = [
    {
      icon: Video,
      title: "Start a Session",
      description: "Connect with Ezri anytime you need support",
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      icon: MessageSquare,
      title: "Daily Check-ins",
      description: "Track your mood and emotional patterns",
      color: "text-purple-600",
      bg: "bg-purple-50"
    },
    {
      icon: TrendingUp,
      title: "View Progress",
      description: "See your wellness journey over time",
      color: "text-green-600",
      bg: "bg-green-50"
    }
  ];

  return (
    <OnboardingLayout
      currentStep={8}
      totalSteps={8}
      title="You're All Set! 🎉"
      subtitle="Your personalized wellness journey starts now"
    >
      <div className="space-y-6">
        {/* Success Animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
          className="flex justify-center relative"
        >
          <FloatingElement yOffset={15} duration={3}>
            <div className="relative">
              <div className="w-32 h-32 bg-gradient-to-br from-primary via-accent to-secondary rounded-3xl flex items-center justify-center shadow-2xl">
                <Heart className="w-16 h-16 text-white" fill="white" />
              </div>
              
              {/* Sparkles around the heart */}
              <motion.div
                animate={{ 
                  rotate: 360,
                  scale: [1, 1.2, 1]
                }}
                transition={{ 
                  rotate: { duration: 4, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                }}
                className="absolute -top-3 -right-3"
              >
                <Sparkles className="w-8 h-8 text-accent" />
              </motion.div>
              
              <motion.div
                animate={{ 
                  rotate: -360,
                  scale: [1, 1.3, 1]
                }}
                transition={{ 
                  rotate: { duration: 5, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }
                }}
                className="absolute -bottom-2 -left-2"
              >
                <Sparkles className="w-6 h-6 text-secondary" />
              </motion.div>
            </div>
          </FloatingElement>
        </motion.div>

        {/* Congratulations Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-6 bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/5 border-primary/20 text-center">
            <h3 className="text-xl font-semibold mb-2">Welcome to Your Wellness Journey!</h3>
            <p className="text-muted-foreground">
              We've personalized Ezri based on your preferences. You're ready to start your first session!
            </p>
          </Card>
        </motion.div>

        {/* Quick Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="font-semibold mb-4 text-center">Quick Start Guide</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {quickTips.map((tip, index) => {
              const Icon = tip.icon;
              const linkPath = 
                tip.title === "Start a Session" ? "/app/session-lobby" :
                tip.title === "Daily Check-ins" ? "/app/mood-checkin" :
                "/app/progress";
              return (
                <Link key={index} to={linkPath}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  >
                    <Card className="p-5 h-full text-center hover:shadow-xl transition-shadow cursor-pointer">
                      <motion.div
                        whileHover={{ scale: 1.2, rotate: 360 }}
                        transition={{ duration: 0.5 }}
                        className={`w-12 h-12 ${tip.bg} rounded-xl flex items-center justify-center mx-auto mb-3`}
                      >
                        <Icon className={`w-6 h-6 ${tip.color}`} />
                      </motion.div>
                      <h4 className="font-semibold mb-1 text-sm">{tip.title}</h4>
                      <p className="text-xs text-muted-foreground">{tip.description}</p>
                    </Card>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </motion.div>

        {/* What's Next */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className="p-6 shadow-xl">
            <h3 className="font-semibold mb-3">What's Next?</h3>
            <ul className="space-y-3">
              {[
                "✅ Your profile is complete and saved",
                "✅ Ezri is ready for your first session",
                "✅ You can customize settings anytime",
                "✅ Crisis resources are available 24/7"
              ].map((item, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1 + index * 0.05 }}
                  className="flex items-center gap-2 text-sm"
                >
                  {item}
                </motion.li>
              ))}
            </ul>
          </Card>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="pt-4"
        >
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button 
              size="lg" 
              className="w-full group relative overflow-hidden"
              onClick={() => completeOnboarding('/app/session-lobby')}
              disabled={isLoading}
            >
              <span className="relative z-10 flex items-center justify-center gap-2 text-lg py-6">
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Setting Up Your Space...
                  </>
                ) : (
                  <>
                    Start Your First Session
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-accent via-secondary to-primary"
                initial={{ x: "-100%" }}
                whileHover={{ x: 0 }}
                transition={{ duration: 0.5 }}
              />
            </Button>
          </motion.div>
          
          <div className="flex items-center justify-center gap-4 mt-4 text-sm text-muted-foreground">
            <Link to="/app/settings" className="hover:text-primary transition-colors">
              Adjust Settings
            </Link>
            <span>•</span>
            <Link to="/app/dashboard" className="hover:text-primary transition-colors">
              Explore Dashboard
            </Link>
          </div>
        </motion.div>

        {/* Encouragement */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="text-center"
        >
          <Card className="p-5 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <p className="text-sm italic text-muted-foreground">
              "Every journey begins with a single step. We're proud of you for taking this one." 💙
            </p>
          </Card>
        </motion.div>
      </div>
    </OnboardingLayout>
  );
}