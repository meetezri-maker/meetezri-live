import { OnboardingLayout } from "../../components/OnboardingLayout";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card } from "../../components/ui/card";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Phone, Heart, AlertCircle, Plus, X, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useOnboarding } from "@/app/contexts/OnboardingContext";
import { toast } from "sonner";
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

const emergencyContactSchema = z.object({
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  emergencyRelationship: z.string().optional(),
});

type EmergencyContactValues = z.infer<typeof emergencyContactSchema>;

export function OnboardingEmergencyContact() {
  const navigate = useNavigate();
  const { data, updateData } = useOnboarding();
  const [isLoading, setIsLoading] = useState(false);
  
  // Safety Plan State
  const [isSafetyPlanOpen, setIsSafetyPlanOpen] = useState(false);
  const [warningSigns, setWarningSigns] = useState(data.safetyPlan?.warningSigns || "");
  const [copingStrategies, setCopingStrategies] = useState(data.safetyPlan?.copingStrategies || "");
  const [supportContacts, setSupportContacts] = useState(data.safetyPlan?.supportContacts || "");

  const form = useForm<EmergencyContactValues>({
    resolver: zodResolver(emergencyContactSchema),
    defaultValues: {
      emergencyName: data.emergencyContactName || "",
      emergencyPhone: data.emergencyContactPhone || "",
      emergencyRelationship: data.emergencyContactRelationship || "",
    },
  });

  const onSubmit = (values: EmergencyContactValues) => {
    setIsLoading(true);
    setTimeout(() => {
      updateData({ 
        emergencyContactName: values.emergencyName, 
        emergencyContactPhone: values.emergencyPhone, 
        emergencyContactRelationship: values.emergencyRelationship 
      });
      navigate("/onboarding/permissions");
    }, 500);
  };

  const handleSaveSafetyPlan = () => {
    updateData({
      safetyPlan: {
        warningSigns,
        copingStrategies,
        supportContacts,
        createdAt: new Date().toISOString()
      }
    });
    setIsSafetyPlanOpen(false);
    toast.success("Safety plan saved successfully");
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

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <FormField
                    control={form.control}
                    name="emergencyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Mom, Best Friend, Partner"
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
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 }}
                >
                  <FormField
                    control={form.control}
                    name="emergencyPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="+1 (555) 123-4567"
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
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <FormField
                    control={form.control}
                    name="emergencyRelationship"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Relationship</FormLabel>
                        <FormControl>
                          <select
                            className="w-full px-3 py-2 border border-border rounded-md bg-input-background transition-all focus:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary"
                            {...field}
                          >
                            <option value="">Select relationship</option>
                            <option value="parent">Parent</option>
                            <option value="partner">Partner/Spouse</option>
                            <option value="sibling">Sibling</option>
                            <option value="friend">Friend</option>
                            <option value="other-family">Other Family</option>
                            <option value="other">Other</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </motion.div>

                {/* Safety Plan Option */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <Card className="p-6 shadow-xl border-t border-border mt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Heart className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold">Personal Safety Plan</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create a plan with coping strategies and resources for when you're struggling
                    </p>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsSafetyPlanOpen(true)}
                      className="w-full p-4 border-2 border-dashed border-primary rounded-lg text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      {data.safetyPlan ? "Edit Safety Plan" : "Create Safety Plan (recommended)"}
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
                  <Card className="p-5 bg-blue-50 border-blue-200 mt-6">
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
                  className="flex gap-3 pt-6"
                >
                  <Link to="/onboarding/avatar-preferences" className="flex-1">
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

      {/* Safety Plan Dialog */}
      <Dialog open={isSafetyPlanOpen} onOpenChange={setIsSafetyPlanOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Your Safety Plan</DialogTitle>
            <DialogDescription>
              A safety plan helps you cope when you're feeling overwhelmed or unsafe.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="warningSigns">Warning Signs</Label>
              <p className="text-xs text-muted-foreground">What thoughts, feelings, or behaviors indicate you're struggling?</p>
              <Textarea 
                id="warningSigns" 
                placeholder="e.g., Feeling isolated, sleeping too much, racing thoughts..." 
                value={warningSigns}
                onChange={(e) => setWarningSigns(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="copingStrategies">Coping Strategies</Label>
              <p className="text-xs text-muted-foreground">What can you do on your own to feel better?</p>
              <Textarea 
                id="copingStrategies" 
                placeholder="e.g., Deep breathing, listening to music, going for a walk..." 
                value={copingStrategies}
                onChange={(e) => setCopingStrategies(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supportContacts">Support Contacts</Label>
              <p className="text-xs text-muted-foreground">Who can you reach out to for help?</p>
              <Textarea 
                id="supportContacts" 
                placeholder="e.g., Partner, Therapist, Best friend..." 
                value={supportContacts}
                onChange={(e) => setSupportContacts(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSafetyPlanOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSafetyPlan}>Save Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OnboardingLayout>
  );
}
