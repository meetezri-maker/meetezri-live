import { OnboardingLayout } from "../../components/OnboardingLayout";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { AnimatedCard } from "../../components/AnimatedCard";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Sparkles, Heart, Clock, Shield, ArrowRight } from "lucide-react";

export function OnboardingWelcome() {
  const features = [
    {
      icon: Heart,
      title: "Personalized Support",
      description: "AI-powered sessions tailored to your needs"
    },
    {
      icon: Clock,
      title: "Available 24/7",
      description: "Connect with Ezri whenever you need"
    },
    {
      icon: Shield,
      title: "Private & Secure",
      description: "Your conversations are always protected"
    }
  ];

  return (
    <OnboardingLayout
      currentStep={1}
      totalSteps={8}
      title="Welcome to Ezri! 👋"
      subtitle="Let's set up your personalized wellness experience"
    >
      <div className="space-y-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.3 }}
          className="flex justify-center"
        >
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-br from-primary via-accent to-secondary rounded-3xl flex items-center justify-center shadow-2xl">
              <Heart className="w-12 h-12 text-white" fill="white" />
            </div>
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 360, 0]
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute -top-2 -right-2"
            >
              <Sparkles className="w-8 h-8 text-accent" />
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
            <p className="text-center text-lg">
              We'll ask you a few questions to personalize your experience. 
              This will only take <span className="font-semibold text-primary">3-5 minutes</span>.
            </p>
          </Card>
        </motion.div>

        <div className="grid sm:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <AnimatedCard key={index} delay={0.5 + index * 0.1}>
              <Card className="p-5 h-full text-center hover:shadow-xl transition-shadow">
                <motion.div
                  whileHover={{ scale: 1.2, rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg"
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </motion.div>
                <h3 className="font-semibold mb-1 text-sm">{feature.title}</h3>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </Card>
            </AnimatedCard>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="pt-4"
        >
          <Link to="/onboarding/profile">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button size="lg" className="w-full group relative overflow-hidden">
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Let's Get Started
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
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
          
          <p className="text-center text-sm text-muted-foreground mt-4">
            You can skip optional questions and come back later
          </p>
        </motion.div>
      </div>
    </OnboardingLayout>
  );
}
