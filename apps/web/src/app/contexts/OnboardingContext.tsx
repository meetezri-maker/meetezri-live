import React, { createContext, useContext, useState } from 'react';
import { api } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts/AuthContext';

interface OnboardingData {
  userId?: string;
  firstName: string;
  lastName: string;
  pronouns: string;
  role: 'user' | 'companion';
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
  completeOnboarding: (redirectPath?: string) => Promise<void>;
  isLoading: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const STORAGE_KEY = 'ezri_onboarding_data';

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [data, setData] = useState<OnboardingData>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Security check: Only load data if it belongs to the current user
        if (user && parsed.userId === user.id) {
          return parsed;
        }
        // If userId doesn't match or is missing, ignore stored data
        // This effectively clears the leak for new sessions
      }
    } catch (error) {
      console.error('Failed to load onboarding data:', error);
    }
    return {
      userId: user?.id,
      firstName: '',
      lastName: '',
      pronouns: '',
      role: 'user',
    };
  });

  // Handle user changes (login/logout/switch)
  React.useEffect(() => {
    // If no user, reset to empty state
    if (!user) {
      setData({
        userId: undefined,
        firstName: '',
        lastName: '',
        pronouns: '',
        role: 'user',
      });
      return;
    }

    // If user changed and data doesn't match new user
    if (user.id !== data.userId) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.userId === user.id) {
            setData(parsed);
            return;
          }
        }
      } catch (error) {
        console.error('Failed to load onboarding data:', error);
      }

      // Default for new user
      setData({
        userId: user.id,
        firstName: '',
        lastName: '',
        pronouns: '',
        role: 'user',
      });
    }
  }, [user?.id]); // Only re-run when user ID changes
  const [isLoading, setIsLoading] = useState(false);

  // Save to localStorage whenever data changes
  React.useEffect(() => {
    try {
      // Ensure we always tag data with current user ID
      const dataToSave = { ...data, userId: user?.id };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Failed to save onboarding data:', error);
    }
  }, [data, user]);

  const updateData = (newData: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...newData }));
  };

  const completeOnboarding = async (redirectPath = '/app/dashboard') => {
    setIsLoading(true);
    try {
      await api.completeOnboarding({
        full_name: `${data.firstName} ${data.lastName}`.trim(),
        role: data.role,
        pronouns: data.pronouns,
        age: data.age,
        timezone: data.timezone,
        current_mood: data.currentMood,
        selected_goals: data.selectedGoals,
        in_therapy: data.inTherapy,
        on_medication: data.onMedication,
        selected_triggers: data.selectedTriggers,
        selected_avatar: data.selectedAvatar,
        selected_environment: data.selectedEnvironment,
        avatar_url: data.avatar_url,
        emergency_contact_name: data.emergencyContactName,
        emergency_contact_phone: data.emergencyContactPhone,
        emergency_contact_relationship: data.emergencyContactRelationship,
        permissions: data.permissions,
        notification_preferences: data.notificationPreferences,
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
