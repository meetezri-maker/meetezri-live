/**
 * EZRI — CONVERSATION SAFETY FLOW
 * Safety & Support Notice onboarding step
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { OnboardingLayout } from '@/app/components/OnboardingLayout';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Card } from '@/app/components/ui/card';
import { ShieldCheck, AlertCircle, Users, Phone } from 'lucide-react';
import { useSafetyConsent } from '@/app/contexts/SafetyContext';
import { useOnboarding } from '@/app/contexts/OnboardingContext';

export function OnboardingSafetyConsent() {
  const navigate = useNavigate();
  const { updateConsent } = useSafetyConsent();
  const { updateData } = useOnboarding();
  const [agreed, setAgreed] = useState(false);

  const handleContinue = () => {
    if (!agreed) return;

    // Save consent
    updateConsent({
      agreedToSafetyNotice: true,
      agreedAt: Date.now(),
      trustedContactEnabled: false, // Can be enabled later in settings
    });
    
    // Save to OnboardingContext as well
    updateData({ agreedToSafety: true });

    // Continue to next onboarding step
    navigate('/onboarding/emergency-contact');
  };

  return (
    <OnboardingLayout
        title="Safety & Support"
        subtitle="Understanding how Ezri keeps you safe"
        currentStep={6}
        totalSteps={8}
      >
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Main notice card */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShieldCheck className="size-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-gray-900 mb-2">
                Safety & Support Notice
              </h3>
              <div className="text-gray-700 space-y-3">
                <p>
                  Ezri is a conversational support system designed to provide companionship 
                  and wellness support. <strong>It is not a medical service</strong> and does 
                  not replace professional or emergency care.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* How Ezri responds to emotional risk */}
        <Card className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <AlertCircle className="size-5 text-orange-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">
                If Ezri Detects High Emotional Risk:
              </h4>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 mt-1">•</span>
                  <span>Conversations may slow down or redirect to provide better support</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 mt-1">•</span>
                  <span>Requests that could be unsafe will be respectfully declined</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600 mt-1">•</span>
                  <span>Support resources will be shown based on your location</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Trusted contact (optional) */}
        <Card className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <Users className="size-5 text-purple-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">
                Trusted Contact (Optional)
              </h4>
              <p className="text-gray-700 text-sm mb-3">
                You may add a trusted contact in your settings. If enabled, Ezri may send 
                them an informational notification during high-risk situations.
              </p>
              <p className="text-xs text-gray-500 italic">
                Notifications are informational only and do not include conversation details.
              </p>
            </div>
          </div>
        </Card>

        {/* What Ezri cannot do */}
        <Card className="p-6 border-gray-200">
          <div className="flex items-start gap-4">
            <Phone className="size-5 text-gray-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">
                Ezri Cannot:
              </h4>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-gray-600 mt-1">•</span>
                  <span>Contact emergency services on your behalf</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-600 mt-1">•</span>
                  <span>Replace professional mental health care or therapy</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-600 mt-1">•</span>
                  <span>Provide medical advice or diagnoses</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Agreement checkbox */}
        <Card className="p-6 bg-gray-50">
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">
              By Continuing, You Acknowledge:
            </h4>
            
            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">✓</span>
                <span>Ezri provides support and companionship, not medical treatment</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">✓</span>
                <span>You are responsible for seeking immediate help when needed</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">✓</span>
                <span>Ezri may adjust conversations and show resources based on safety concerns</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t">
              <Checkbox
                id="safety-consent"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked as boolean)}
              />
              <label
                htmlFor="safety-consent"
                className="text-sm font-medium text-gray-900 cursor-pointer select-none"
              >
                I understand and agree to these safety guidelines
              </label>
            </div>
          </div>
        </Card>

        {/* Navigation buttons */}
        <div className="flex gap-4 pt-6">
          <Button
            variant="outline"
            onClick={() => navigate('/onboarding/avatar-preferences')}
            className="flex-1"
          >
            Back
          </Button>
          <Button
            onClick={handleContinue}
            disabled={!agreed}
            className="flex-1"
          >
            Continue
          </Button>
        </div>
      </div>
    </OnboardingLayout>
  );
}
