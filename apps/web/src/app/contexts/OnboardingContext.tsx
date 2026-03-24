import React, { createContext, useContext, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts/AuthContext';

interface OnboardingData {
  storageVersion?: number;
  userId?: string;
  signupType?: 'trial' | 'plan';
  selectedPlan?: 'trial' | 'core' | 'pro';
  firstName: string;
  lastName: string;
  pronouns: string;
  role: 'user' | 'therapist';
  age?: string;
  timezone?: string;
  currentMood?: string;
  selectedGoals?: string[];
  inTherapy?: string;
  onMedication?: string;
  selectedTriggers?: string[];
  selectedAvatar?: string;
  selectedEnvironment?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  permissions?: Record<string, any>;
  notificationPreferences?: Record<string, any>;
  [key: string]: any;
}

interface OnboardingContextType {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  completeOnboarding: (redirectPath?: string, overrides?: Partial<OnboardingData>) => Promise<void>;
  isLoading: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const STORAGE_KEY = 'ezri_onboarding_data';
const STORAGE_VERSION = 1;

function getDefaultOnboardingData(userId?: string, signupType?: 'trial' | 'plan'): OnboardingData {
  return {
    storageVersion: STORAGE_VERSION,
    userId,
    signupType,
    firstName: '',
    lastName: '',
    pronouns: '',
    role: 'user',
  };
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  
  const [data, setData] = useState<OnboardingData>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const normalizedRole = parsed?.role === 'companion' ? 'therapist' : parsed?.role;
        const migrated = {
          ...parsed,
          storageVersion: STORAGE_VERSION,
          role: normalizedRole ?? 'user',
        };
        // Security check: Only load data if it belongs to the current user
        if (user && parsed.userId === user.id) {
          return migrated;
        }
        // If userId doesn't match or is missing, ignore stored data
        // This effectively clears the leak for new sessions
      }
    } catch (error) {
      console.error('Failed to load onboarding data:', error);
    }
    return getDefaultOnboardingData(user?.id);
  });

  // Handle user changes (login/logout/switch)
  React.useEffect(() => {
    // If no user, reset to empty state
    if (!user) {
      setData(getDefaultOnboardingData(undefined));
      return;
    }

    // If user changed and data doesn't match new user
    if (user.id !== data.userId) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.userId === user.id) {
            const normalizedRole = parsed?.role === 'companion' ? 'therapist' : parsed?.role;
            setData({
              ...parsed,
              storageVersion: STORAGE_VERSION,
              role: normalizedRole ?? 'user',
              signupType: parsed?.signupType ?? profile?.signup_type ?? (profile?.subscription_plan === 'trial' ? 'trial' : 'plan'),
            });
            return;
          }
        }
      } catch (error) {
        console.error('Failed to load onboarding data:', error);
      }

      // Default for new user
      setData(getDefaultOnboardingData(user.id, profile?.signup_type ?? (profile?.subscription_plan === 'trial' ? 'trial' : 'plan')));
    }
  }, [user?.id, profile?.signup_type, profile?.subscription_plan]); // Only re-run on identity/flow changes
  const [isLoading, setIsLoading] = useState(false);

  // Save to localStorage whenever data changes
  React.useEffect(() => {
    try {
      // Ensure we always tag data with current user ID
      const dataToSave = {
        ...data,
        storageVersion: STORAGE_VERSION,
        userId: user?.id,
        signupType: data.signupType ?? profile?.signup_type ?? (profile?.subscription_plan === 'trial' ? 'trial' : 'plan'),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Failed to save onboarding data:', error);
    }
  }, [data, user, profile?.signup_type, profile?.subscription_plan]);

  const updateData = (newData: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...newData }));
  };

  const completeOnboarding = async (
    redirectPath = '/app/dashboard',
    overrides: Partial<OnboardingData> = {}
  ) => {
    setIsLoading(true);
    try {
      const finalData: OnboardingData = {
        ...data,
        ...overrides,
      };
      await api.completeOnboarding({
        full_name: `${finalData.firstName} ${finalData.lastName}`.trim(),
        role: finalData.role,
        pronouns: finalData.pronouns,
        age: finalData.age,
        timezone: finalData.timezone,
        current_mood: finalData.currentMood,
        selected_goals: finalData.selectedGoals,
        in_therapy: finalData.inTherapy,
        on_medication: finalData.onMedication,
        selected_triggers: finalData.selectedTriggers,
        selected_avatar: finalData.selectedAvatar,
        selected_environment: finalData.selectedEnvironment,
        avatar_url: finalData.avatar_url,
        emergency_contact_name: finalData.emergencyContactName,
        emergency_contact_phone: finalData.emergencyContactPhone,
        emergency_contact_relationship: finalData.emergencyContactRelationship,
        permissions: finalData.permissions,
        notification_preferences: finalData.notificationPreferences,
      });
      
      // Clear storage on success
      localStorage.removeItem(STORAGE_KEY);
      
      toast.success("Onboarding completed!");
      // Force reload to ensure AuthContext fetches the new profile
      window.location.href = redirectPath;
    } catch (error: any) {
      toast.error(error.message || "Failed to complete onboarding");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <OnboardingContext.Provider value={{ data, updateData, completeOnboarding, isLoading }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
