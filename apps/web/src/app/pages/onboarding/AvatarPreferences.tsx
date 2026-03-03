import { OnboardingLayout } from "../../components/OnboardingLayout";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, ArrowLeft, Sparkles, Volume2, Palette, Heart, Brain, Users, Star, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useOnboarding } from "@/app/contexts/OnboardingContext";

interface AIAvatar {
  id: string;
  name: string;
  gender: string;
  ageRange: string;
  personality: string;
  specialty: string[];
  description: string;
  image: string;
  voiceType: string;
  accentType: string;
  rating: number;
  totalUsers: number;
}

export function OnboardingAvatarPreferences() {
  const navigate = useNavigate();
  const { data, updateData } = useOnboarding();
  const [selectedAvatar, setSelectedAvatar] = useState(data.selectedAvatar || "");
  const [selectedEnvironment, setSelectedEnvironment] = useState(data.selectedEnvironment || "");

  const aiAvatars: AIAvatar[] = [
    {
      id: "maya",
      name: "Maya Chen",
      gender: "Female",
      ageRange: "35-40",
      personality: "Warm, Empathetic, Supportive",
      specialty: ["Anxiety", "Depression", "Stress Management"],
      description: "A compassionate AI companion with a warm presence. Maya specializes in helping with anxiety, stress, and building emotional resilience through mindfulness.",
      image: "👩‍💼",
      voiceType: "Warm & Soothing",
      accentType: "Neutral American",
      rating: 4.9,
      totalUsers: 2456
    },
    {
      id: "alex",
      name: "Alex Rivera",
      gender: "Male",
      ageRange: "30-35",
      personality: "Calm, Patient, Understanding",
      specialty: ["PTSD", "Trauma", "Life Transitions"],
      description: "A gentle and patient listener who creates a safe space for healing. Alex focuses on trauma recovery and navigating life's big changes.",
      image: "👨‍💼",
      voiceType: "Deep & Calming",
      accentType: "Neutral American",
      rating: 4.8,
      totalUsers: 1893
    },
    {
      id: "jordan",
      name: "Jordan Taylor",
      gender: "Non-binary",
      ageRange: "28-32",
      personality: "Energetic, Positive, Supportive",
      specialty: ["Self-Esteem", "Relationships", "Personal Growth"],
      description: "An uplifting companion who helps you discover your strengths. Jordan specializes in building confidence and personal development.",
      image: "🧑‍💼",
      voiceType: "Bright & Encouraging",
      accentType: "Neutral American",
      rating: 4.7,
      totalUsers: 1654
    },
    {
      id: "sarah",
      name: "Sarah Mitchell",
      gender: "Female",
      ageRange: "45-50",
      personality: "Wise, Grounded, Nurturing",
      specialty: ["Grief", "Family Issues", "Chronic Illness"],
      description: "A wise and nurturing presence with deep empathy. Sarah brings years of life experience in supporting people through challenging times.",
      image: "👩‍🦳",
      voiceType: "Gentle & Maternal",
      accentType: "British",
      rating: 4.9,
      totalUsers: 2103
    }
  ];

  const environments = [
    { value: "beach", label: "Beach Sunset", emoji: "🏖️", gradient: "from-orange-300 to-blue-400" },
    { value: "forest", label: "Peaceful Forest", emoji: "🌲", gradient: "from-green-400 to-emerald-600" },
    { value: "mountains", label: "Mountain View", emoji: "⛰️", gradient: "from-blue-300 to-purple-400" },
    { value: "space", label: "Starry Night", emoji: "🌌", gradient: "from-indigo-500 to-purple-900" },
    { value: "minimal", label: "Minimal Studio", emoji: "⬜", gradient: "from-gray-100 to-gray-300" }
  ];

  const handleContinue = () => {
    updateData({ selectedAvatar, selectedEnvironment });
    navigate("/onboarding/safety-consent");
  };

  return (
    <OnboardingLayout
      currentStep={5}
      totalSteps={8}
      title="Choose Your AI Companion"
      subtitle="Select the AI companion who will support your wellness journey"
    >
      <div className="space-y-6">
        {/* Important Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-4 bg-purple-50 border-purple-200">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-purple-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-purple-900 mb-1">
                  AI-Powered Video Therapy Sessions
                </p>
                <p className="text-xs text-purple-700">
                  Your chosen AI companion will appear as a realistic 3D avatar during video sessions. All conversations are voice-based for a natural, human-like experience.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* AI Avatar Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="mb-4">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Select Your AI Companion
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Choose the AI companion that feels right for you. You can change this later in settings.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aiAvatars.map((avatar, index) => (
              <motion.button
                key={avatar.id}
                type="button"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedAvatar(avatar.id)}
                className={`relative rounded-2xl border-2 transition-all overflow-hidden ${
                  selectedAvatar === avatar.id
                    ? "border-primary bg-primary/5 shadow-xl"
                    : "border-border hover:border-primary/50 bg-white"
                }`}
              >
                {/* Selected Indicator */}
                {selectedAvatar === avatar.id && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-4 right-4 z-10 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg"
                  >
                    <CheckCircle className="w-5 h-5 text-white" />
                  </motion.div>
                )}

                <div className="p-6 text-left">
                  {/* Avatar Image & Basic Info */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="text-6xl">{avatar.image}</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">{avatar.name}</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {avatar.gender} • {avatar.ageRange} years
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
                          <span className="font-semibold">{avatar.rating}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{avatar.totalUsers.toLocaleString()} users</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Personality */}
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <Heart className="w-3 h-3" /> Personality
                    </p>
                    <p className="text-sm text-gray-600">{avatar.personality}</p>
                  </div>

                  {/* Specialties */}
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Specializes In:</p>
                    <div className="flex flex-wrap gap-2">
                      {avatar.specialty.map((spec) => (
                        <span
                          key={spec}
                          className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                    {avatar.description}
                  </p>

                  {/* Voice Info */}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Volume2 className="w-3 h-3" />
                        <span>{avatar.voiceType}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>•</span>
                        <span>{avatar.accentType}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Environment Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-primary" />
              <Label className="text-base">Session Background</Label>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Choose a calming background for your video sessions
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {environments.map((env, index) => (
                <motion.button
                  key={env.value}
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + index * 0.05 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedEnvironment(env.value)}
                  className={`rounded-lg border-2 overflow-hidden transition-all ${
                    selectedEnvironment === env.value
                      ? "border-primary shadow-lg"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className={`h-24 bg-gradient-to-br ${env.gradient} flex items-center justify-center`}>
                    <span className="text-4xl">{env.emoji}</span>
                  </div>
                  <div className="p-2 bg-white">
                    <p className="text-sm font-medium">{env.label}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Info Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className="p-4 bg-blue-50 border-blue-200">
            <p className="text-sm text-blue-900">
              💡 <span className="font-medium">Tip:</span> You can change your AI companion and session preferences anytime in your settings
            </p>
          </Card>
        </motion.div>

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="flex gap-3"
        >
          <Link to="/onboarding/wellness-baseline" className="flex-1">
            <Button type="button" variant="outline" className="w-full group">
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back
            </Button>
          </Link>

          <Link to="/onboarding/safety-consent" className="flex-1">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button 
                onClick={handleContinue}
                className="w-full group relative overflow-hidden"
                disabled={!selectedAvatar}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Continue
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
        </motion.div>
      </div>
    </OnboardingLayout>
  );
}