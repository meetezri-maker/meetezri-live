import { OnboardingLayout } from "../../components/OnboardingLayout";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card } from "../../components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, ArrowLeft, Camera, User } from "lucide-react";
import { useState, useEffect } from "react";
import { useOnboarding } from "@/app/contexts/OnboardingContext";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/contexts/AuthContext";
import { toast } from "sonner";
import { api } from "@/lib/api";

export function OnboardingProfileSetup() {
  const navigate = useNavigate();
  const { data, updateData } = useOnboarding();
  const { user } = useAuth();
  const [selectedPronoun, setSelectedPronoun] = useState(data.pronouns || "");
  const [firstName, setFirstName] = useState(data.firstName || "");
  const [lastName, setLastName] = useState(data.lastName || "");
  const [age, setAge] = useState(data.age || "");
  const [timezone, setTimezone] = useState(data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [isUploading, setIsUploading] = useState(false);
  const [availableTimezones] = useState<string[]>((Intl as any).supportedValuesOf('timeZone'));

  useEffect(() => {
    if (!data.timezone) {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(detected);
    }
  }, []);

  useEffect(() => {
    if (data.firstName && !firstName) {
      setFirstName(data.firstName);
    }
    if (data.lastName && !lastName) {
      setLastName(data.lastName);
    }
    if (data.pronouns && !selectedPronoun) {
      setSelectedPronoun(data.pronouns);
    }
    if (data.age && !age) {
      setAge(data.age);
    }
    if (data.timezone && !timezone) {
      setTimezone(data.timezone);
    }
  }, [data.firstName, data.lastName, data.pronouns, data.age, data.timezone]);

  useEffect(() => {
    if (user?.user_metadata) {
      const { full_name, name, avatar_url, picture, first_name, last_name } = user.user_metadata;
      const updates: any = {};
      let hasUpdates = false;

      // Handle separately stored first/last name (from Signup)
      if (!data.firstName && !firstName && first_name) {
        setFirstName(first_name);
        updates.firstName = first_name;
        hasUpdates = true;
      }

      if (!data.lastName && !lastName && last_name) {
        setLastName(last_name);
        updates.lastName = last_name;
        hasUpdates = true;
      }

      // Handle combined full_name (e.g. from OAuth) if separate fields aren't set
      if (!data.firstName && !firstName && !first_name && (full_name || name)) {
        const fullName = full_name || name;
        const parts = fullName.split(" ");
        const first = parts[0];
        const last = parts.slice(1).join(" ");
        setFirstName(first);
        setLastName(last);
        updates.firstName = first;
        updates.lastName = last;
        hasUpdates = true;
      }

      if (!data.avatar_url && (avatar_url || picture)) {
        const url = avatar_url || picture;
        updates.avatar_url = url;
        hasUpdates = true;
      }

      if (hasUpdates) {
        updateData(updates);
      }
    }
  }, [user]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!user) {
        toast.error("User not found");
        return;
      }

      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      updateData({ avatar_url: publicUrl });
      toast.success("Profile photo uploaded!");
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error("Error uploading image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!firstName || !lastName || !age || !selectedPronoun) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      // First update the profile
      await api.updateProfile({
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        pronouns: selectedPronoun,
        age: age, // Send as string to match schema
        timezone
      });
      
      // Update local context
      updateData({ 
        firstName, 
        lastName, 
        pronouns: selectedPronoun, 
        age, 
        timezone 
      });
      
      navigate("/onboarding/subscription");
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error("Failed to update profile");
    }
  };

  const pronounOptions = [
    { value: "he/him", label: "He/Him" },
    { value: "she/her", label: "She/Her" },
    { value: "they/them", label: "They/Them" },
    { value: "prefer-not-to-say", label: "Prefer not to say" },
    { value: "custom", label: "Custom" }
  ];

  return (
    <OnboardingLayout
      currentStep={2}
      totalSteps={8}
      title="Tell Us About Yourself"
      subtitle="Help us personalize your Ezri experience"
    >
      <Card className="p-6 md:p-8 shadow-xl backdrop-blur-sm bg-white/90">
        <form className="space-y-6" onSubmit={handleContinue}>
          {/* Profile Photo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center"
          >
            <input
              type="file"
              id="profile-upload"
              className="hidden"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={isUploading}
            />
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative group cursor-pointer"
              onClick={() => document.getElementById('profile-upload')?.click()}
            >
              <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center border-4 border-white shadow-xl overflow-hidden">
                {data.avatar_url ? (
                  <img src={data.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-primary" />
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                {isUploading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-white" />
                )}
              </div>
            </motion.div>
            <p className="text-sm text-muted-foreground mt-2">Add a profile photo (optional)</p>
          </motion.div>

          {/* Full Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-2"
            >
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                placeholder="John"
                className="bg-input-background transition-all focus:scale-[1.02]"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
              className="space-y-2"
            >
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                className="bg-input-background transition-all focus:scale-[1.02]"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </motion.div>
          </div>

          {/* Pronouns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-2"
          >
            <Label>Pronouns (optional)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {pronounOptions.map((option, index) => (
                <motion.button
                  key={option.value}
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.05 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedPronoun(option.value)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedPronoun === option.value
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {option.label}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Age */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="space-y-2"
          >
            <Label htmlFor="age">Age *</Label>
            <Input
              id="age"
              type="number"
              min="13"
              max="120"
              placeholder="25"
              className="bg-input-background transition-all focus:scale-[1.02]"
              required
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              You must be at least 13 years old to use Ezri
            </p>
          </motion.div>

          {/* Timezone */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="space-y-2"
          >
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              className="w-full px-3 py-2 border border-border rounded-md bg-input-background transition-all focus:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {availableTimezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </motion.div>

          {/* Navigation Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex gap-3 pt-4"
          >
            <Link to="/onboarding/welcome" className="flex-1">
              <Button type="button" variant="outline" className="w-full group">
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back
              </Button>
            </Link>

            <div className="flex-1">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button type="submit" className="w-full group relative overflow-hidden">
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
            </div>
          </motion.div>
        </form>
      </Card>
    </OnboardingLayout>
  );
}
