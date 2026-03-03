import { PublicNav } from "../components/PublicNav";
import { Card } from "../components/ui/card";
import { FileText } from "lucide-react";

export function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Terms & Conditions</h1>
          <p className="text-muted-foreground">
            Last updated: December 29, 2024
          </p>
        </div>
        
        <Card className="p-8">
          <div className="prose prose-slate max-w-none">
            <h2>1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using Ezri, you agree to be bound by these Terms & Conditions. 
              If you disagree with any part of these terms, you may not access the service.
            </p>
            
            <h2>2. Description of Service</h2>
            <p className="text-muted-foreground">
              Ezri provides an AI-powered wellness companion platform offering video sessions, 
              mood tracking, journaling, and wellness tools. This service is not a substitute 
              for professional medical or mental health services.
            </p>
            
            <h2>3. User Responsibilities</h2>
            <p className="text-muted-foreground">
              You are responsible for maintaining the confidentiality of your account credentials 
              and for all activities that occur under your account. You must be at least 18 years 
              old to use this service.
            </p>
            
            <h2>4. Privacy & Data</h2>
            <p className="text-muted-foreground">
              Your use of Ezri is also governed by our Privacy Policy. We collect and process 
              personal data in accordance with applicable privacy laws and regulations.
            </p>
            
            <h2>5. Subscription & Payment</h2>
            <p className="text-muted-foreground">
              Ezri offers a 7-day trial period. After the trial, your subscription will 
              automatically renew unless cancelled. You may cancel at any time through your 
              account settings.
            </p>
            
            <h2>6. Intellectual Property</h2>
            <p className="text-muted-foreground">
              All content, features, and functionality of Ezri are owned by us and are protected 
              by international copyright, trademark, and other intellectual property laws.
            </p>
            
            <h2>7. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              Ezri is provided "as is" without warranties of any kind. We shall not be liable 
              for any indirect, incidental, special, consequential, or punitive damages resulting 
              from your use of the service.
            </p>
            
            <h2>8. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify these terms at any time. We will notify users of 
              any material changes via email or through the service.
            </p>
            
            <h2>9. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions about these Terms & Conditions, please contact us at 
              support@ezri.com
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
