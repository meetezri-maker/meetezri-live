import { OnboardingLayout } from "../../components/OnboardingLayout";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card } from "../../components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, ArrowLeft, Camera, User, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useOnboarding } from "@/app/contexts/OnboardingContext";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/contexts/AuthContext";
import { toast } from "sonner";
import { api } from "@/lib/api";
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
} from "../../components/ui/form";

const profileSetupSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  pronouns: z.string().optional(),
  age: z.string().refine((val) => {
    const num = parseInt(val);
    return !isNaN(num) && num >= 13 && num <= 120;
  }, "You must be at least 13 years old"),
  timezone: z.string().min(1, "Timezone is required"),
});

type ProfileSetupValues = z.infer<typeof profileSetupSchema>;

export function OnboardingProfileSetup() {
  const navigate = useNavigate();
  const { data, updateData } = useOnboarding();
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [availableTimezones] = useState<string[]>((Intl as any).supportedValuesOf('timeZone'));

  const form = useForm<ProfileSetupValues>({
    resolver: zodResolver(profileSetupSchema as any),
    defaultValues: {
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      pronouns: data.pronouns || "",
      age: data.age || "",
      timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  // Sync context data to form
  useEffect(() => {
    if (data.firstName) form.setValue("firstName", data.firstName);
    if (data.lastName) form.setValue("lastName", data.lastName);
    if (data.pronouns) form.setValue("pronouns", data.pronouns);
    if (data.age) form.setValue("age", data.age);
    if (data.timezone) form.setValue("timezone", data.timezone);
    else {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        form.setValue("timezone", detected);
    }
  }, [data, form]);

  useEffect(() => {
    if (user?.user_metadata) {
      const { full_name, name, avatar_url, picture, first_name, last_name } = user.user_metadata;
      const updates: any = {};
      let hasUpdates = false;

      const currentValues = form.getValues();

      // Handle separately stored first/last name (from Signup)
      if (!data.firstName && !currentValues.firstName && first_name) {
        form.setValue("firstName", first_name);
        updates.firstName = first_name;
        hasUpdates = true;
      }

      if (!data.lastName && !currentValues.lastName && last_name) {
        form.setValue("lastName", last_name);
        updates.lastName = last_name;
        hasUpdates = true;
      }

      // Handle combined full_name (e.g. from OAuth) if separate fields aren't set
      if (!data.firstName && !currentValues.firstName && !first_name && (full_name || name)) {
        const fullName = full_name || name;
        const parts = fullName.split(" ");
        const first = parts[0];
        const last = parts.slice(1).join(" ");
        form.setValue("firstName", first);
        form.setValue("lastName", last);
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
  }, [user, data, form, updateData]);

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
      // Use timestamp + random for unique filename
      const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          upsert: true
        });

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

  const onSubmit = async (values: ProfileSetupValues) => {
    setIsLoading(true);
    try {
      // First update the profile
      await api.updateProfile({
        first_name: values.firstName,
        last_name: values.lastName,
        full_name: `${values.firstName} ${values.lastName}`,
        pronouns: values.pronouns || "",
        age: values.age,
        timezone: values.timezone
      });
      
      // Update local context
      updateData({ 
        firstName: values.firstName, 
        lastName: values.lastName, 
        pronouns: values.pronouns, 
        age: values.age, 
        timezone: values.timezone 
      });
      
      const selectedPlan =
        typeof window !== "undefined"
          ? window.localStorage.getItem("selectedPlan")
          : null;

      // Trial flow: after completing profile setup, return to dashboard.
      if (selectedPlan === "trial") {
        navigate("/app/dashboard");
        return;
      }

      const planPurchased =
        typeof window !== "undefined"
          ? window.localStorage.getItem("planPurchased") === "1"
          : false;

      // Paid flow: continue with the onboarding wizard.
      if (planPurchased) {
        navigate("/onboarding/wellness-baseline");
      } else {
        navigate("/onboarding/subscription");
      }
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error("Failed to update profile");
      setIsLoading(false);
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
      currentStep={1}
      totalSteps={8}
      title="Tell Us About Yourself"
      subtitle="Help us personalize your Ezri experience"
    >
      <Card className="p-6 md:p-8 shadow-xl backdrop-blur-sm bg-white/90">
        <Form {...form}>
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
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
              >
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
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
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
              >
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
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

            {/* Pronouns */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <FormField
                control={form.control}
                name="pronouns"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pronouns (optional)</FormLabel>
                    <FormControl>
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
                            onClick={() => field.onChange(option.value)}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              field.value === option.value
                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            {option.label}
                          </motion.button>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            {/* Age */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="13"
                        max="120"
                        placeholder="25"
                        className="bg-input-background transition-all focus:scale-[1.02]"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      You must be at least 13 years old to use Ezri
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            {/* Timezone */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <FormControl>
                      <select
                        className="w-full px-3 py-2 border border-border rounded-md bg-input-background transition-all focus:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary"
                        {...field}
                      >
                        {availableTimezones.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                <Button 
                  type="submit"
                  className="w-full group relative overflow-hidden"
                  disabled={isLoading}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Continue
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
            </div>
            </motion.div>
          </form>
        </Form>
      </Card>
    </OnboardingLayout>
  );
}
