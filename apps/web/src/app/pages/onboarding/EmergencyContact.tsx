import { OnboardingLayout } from "../../components/OnboardingLayout";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card } from "../../components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, ArrowLeft, Phone, Heart, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useOnboarding } from "@/app/contexts/OnboardingContext";

export function OnboardingEmergencyContact() {
  const navigate = useNavigate();
  const { data, updateData } = useOnboarding();
  const [emergencyName, setEmergencyName] = useState(data.emergencyContactName || "");
  const [emergencyPhone, setEmergencyPhone] = useState(data.emergencyContactPhone || "");
  const [emergencyRelationship, setEmergencyRelationship] = useState(data.emergencyContactRelationship || "");

  const handleContinue = () => {
    updateData({ 
      emergencyContactName: emergencyName, 
      emergencyContactPhone: emergencyPhone, 
      emergencyContactRelationship: emergencyRelationship 
    });
    navigate("/onboarding/permissions");
  };

  return (
    <OnboardingLayout
      currentStep={7}
      totalSteps={8}
      title="Emergency Contact"
      subtitle="Help us keep you safe (optional but recommended)"
    >
      <div className="space-y-6">
        {/* Crisis Resources Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-5 bg-red-50 border-red-200">
            <div className="flex gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-900 mb-2">If you're in crisis right now:</p>
                <div className="space-y-1 text-sm text-red-800">
                  <p>🇺🇸 <strong>988 Suicide & Crisis Lifeline:</strong> Call or text 988</p>
                  <p>🇺🇸 <strong>Crisis Text Line:</strong> Text HOME to 741741</p>
                  <p>🚨 <strong>Emergency:</strong> Call 911</p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Emergency Contact Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Phone className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Trusted Contact Person</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Add someone we can notify if you're in crisis (we'll only contact them with your permission or in emergencies)
            </p>

            <form className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-2"
              >
                <Label htmlFor="emergencyName">Contact Name</Label>
                <Input
                  id="emergencyName"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="e.g., Mom, Best Friend, Partner"
                  className="bg-input-background transition-all focus:scale-[1.02]"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 }}
                className="space-y-2"
              >
                <Label htmlFor="emergencyPhone">Phone Number</Label>
                <Input
                  id="emergencyPhone"
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="bg-input-background transition-all focus:scale-[1.02]"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-2"
              >
                <Label htmlFor="emergencyRelationship">Relationship</Label>
                <select
                  id="emergencyRelationship"
                  value={emergencyRelationship}
                  onChange={(e) => setEmergencyRelationship(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-input-background transition-all focus:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select relationship</option>
                  <option value="parent">Parent</option>
                  <option value="partner">Partner/Spouse</option>
                  <option value="sibling">Sibling</option>
                  <option value="friend">Friend</option>
                  <option value="other-family">Other Family</option>
                  <option value="other">Other</option>
                </select>
              </motion.div>
            </form>
          </Card>
        </motion.div>

        {/* Safety Plan Option */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Personal Safety Plan</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Create a plan with coping strategies and resources for when you're struggling
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full p-4 border-2 border-dashed border-primary rounded-lg text-primary hover:bg-primary/5 transition-colors"
            >
              + Create Safety Plan (recommended)
            </motion.button>
            <p className="text-xs text-muted-foreground mt-2">
              You can set this up later in your profile
            </p>
          </Card>
        </motion.div>

        {/* Crisis Resources */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="p-5 bg-blue-50 border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">More Crisis Resources</h4>
            <div className="space-y-2 text-sm text-blue-800">
              <div className="flex items-start gap-2">
                <span className="font-medium min-w-fit">SAMHSA:</span>
                <span>1-800-662-4357 (Treatment referral)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-medium min-w-fit">Veterans:</span>
                <span>1-800-273-8255 (Press 1)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-medium min-w-fit">LGBTQ+:</span>
                <span>1-866-488-7386 (Trevor Project)</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex gap-3"
        >
          <Link to="/onboarding/avatar-preferences" className="flex-1">
            <Button type="button" variant="outline" className="w-full group">
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back
            </Button>
          </Link>

          <Link to="/onboarding/permissions" className="flex-1">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button 
                onClick={handleContinue}
                className="w-full group relative overflow-hidden"
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

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-center text-sm text-muted-foreground"
        >
          All fields are optional • You can skip this step
        </motion.p>
      </div>
    </OnboardingLayout>
  );
}
