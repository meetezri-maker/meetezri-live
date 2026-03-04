import { OnboardingLayout } from "../../components/OnboardingLayout";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, ArrowLeft, Video, Bell, Mic, CheckCircle2, Info } from "lucide-react";
import { useOnboarding } from "@/app/contexts/OnboardingContext";
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

const permissionsSchema = z.object({
  permissions: z.object({
    camera: z.boolean(),
    microphone: z.boolean(),
    notifications: z.boolean(),
  }),
  notificationPreferences: z.object({
    dailyCheckIn: z.boolean(),
    sessionReminders: z.boolean(),
    wellnessTips: z.boolean(),
    weeklyProgress: z.boolean(),
  }),
});

type PermissionsValues = z.infer<typeof permissionsSchema>;

export function OnboardingPermissions() {
  const navigate = useNavigate();
  const { data, updateData } = useOnboarding();

  const form = useForm<PermissionsValues>({
    resolver: zodResolver(permissionsSchema),
    defaultValues: {
      permissions: {
        camera: data.permissions?.camera || false,
        microphone: data.permissions?.microphone || false,
        notifications: data.permissions?.notifications || false,
      },
      notificationPreferences: {
        dailyCheckIn: data.notificationPreferences?.dailyCheckIn ?? true,
        sessionReminders: data.notificationPreferences?.sessionReminders ?? true,
        wellnessTips: data.notificationPreferences?.wellnessTips ?? true,
        weeklyProgress: data.notificationPreferences?.weeklyProgress ?? false,
      },
    },
  });

  const permissionItems = [
    {
      key: "camera" as const,
      icon: Video,
      title: "Camera Access",
      description: "Required for video sessions with Ezri",
      required: true,
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      key: "microphone" as const,
      icon: Mic,
      title: "Microphone Access",
      description: "Required for talking during sessions",
      required: true,
      color: "text-purple-600",
      bg: "bg-purple-50"
    },
    {
      key: "notifications" as const,
      icon: Bell,
      title: "Push Notifications",
      description: "Get reminders for check-ins and session schedules",
      required: false,
      color: "text-green-600",
      bg: "bg-green-50"
    }
  ];

  const onSubmit = (values: PermissionsValues) => {
    updateData({ 
      permissions: values.permissions,
      notificationPreferences: values.notificationPreferences
    });
    navigate("/onboarding/complete");
  };

  const permissions = form.watch("permissions");

  return (
    <OnboardingLayout
      currentStep={8}
      totalSteps={8}
      title="Permissions & Notifications"
      subtitle="Enable features to get the most out of Ezri"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-5 bg-blue-50 border-blue-200">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-900 font-medium mb-1">Your Privacy is Protected</p>
                  <p className="text-xs text-blue-800">
                    We only access your camera and microphone during active sessions. 
                    You can change these permissions anytime in settings.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Permissions List */}
          <div className="space-y-4">
            {permissionItems.map((item, index) => {
              const Icon = item.icon;

              return (
                <FormField
                  key={item.key}
                  control={form.control}
                  name={`permissions.${item.key}`}
                  render={({ field }) => (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                    >
                      <Card className={`p-5 shadow-lg transition-all ${field.value ? 'ring-2 ring-primary' : ''}`}>
                        <div className="flex items-start gap-4">
                          <motion.div
                            animate={field.value ? { scale: [1, 1.1, 1] } : {}}
                            transition={{ duration: 0.3 }}
                            className={`w-12 h-12 ${item.bg} rounded-xl flex items-center justify-center flex-shrink-0`}
                          >
                            <Icon className={`w-6 h-6 ${item.color}`} />
                          </motion.div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div>
                                <h3 className="font-semibold flex items-center gap-2">
                                  {item.title}
                                  {item.required && (
                                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                                      Required
                                    </span>
                                  )}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {item.description}
                                </p>
                              </div>

                              <FormControl>
                                <motion.button
                                  type="button"
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => field.onChange(!field.value)}
                                  className={`relative w-14 h-8 rounded-full transition-colors flex-shrink-0 ${
                                    field.value ? 'bg-primary' : 'bg-gray-300'
                                  }`}
                                >
                                  <motion.div
                                    animate={{
                                      x: field.value ? 26 : 2
                                    }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
                                  />
                                </motion.button>
                              </FormControl>
                            </div>

                            {field.value && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="flex items-center gap-2 mt-3 p-2 bg-green-50 rounded-lg"
                              >
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-green-800 font-medium">Enabled</span>
                              </motion.div>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  )}
                />
              );
            })}
          </div>

          {/* Notification Preferences */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="p-6 shadow-xl">
              <h3 className="font-semibold mb-3">Notification Preferences</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Choose what you'd like to be notified about
              </p>

              <div className="space-y-3">
                {[
                  { key: "dailyCheckIn", label: "Daily mood check-in reminders" },
                  { key: "sessionReminders", label: "Scheduled session reminders" },
                  { key: "wellnessTips", label: "Wellness tips and insights" },
                  { key: "weeklyProgress", label: "Weekly progress summaries" }
                ].map((pref) => (
                  <FormField
                    key={pref.key}
                    control={form.control}
                    name={`notificationPreferences.${pref.key}` as any}
                    render={({ field }) => (
                      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <span className="text-sm font-medium">{pref.label}</span>
                        <FormControl>
                          <div className="flex items-center space-x-2">
                             <motion.button
                                type="button"
                                onClick={() => field.onChange(!field.value)}
                                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                                  field.value ? 'bg-primary' : 'bg-gray-200'
                                }`}
                              >
                                <motion.div
                                  animate={{
                                    x: field.value ? 22 : 2
                                  }}
                                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm"
                                />
                              </motion.button>
                          </div>
                        </FormControl>
                      </div>
                    )}
                  />
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Warning if required permissions not granted */}
          {(!permissions.camera || !permissions.microphone) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-amber-50 border border-amber-200 rounded-lg"
            >
              <p className="text-sm text-amber-900">
                ⚠️ Camera and microphone access are required for video sessions. 
                You can enable them now or when you start your first session.
              </p>
            </motion.div>
          )}

          {/* Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="flex gap-3"
          >
            <Link to="/onboarding/emergency-contact" className="flex-1">
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
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Finish Setup
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
      </Form>
    </OnboardingLayout>
  );
}
