import { PublicNav } from "../components/PublicNav";
import { Card } from "../components/ui/card";
import { Shield } from "lucide-react";

export function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-secondary" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Privacy, Safety & Accessibility</h1>
          <p className="text-xl text-muted-foreground">
            Your privacy and safety are our top priorities
          </p>
        </div>
        
        <div className="space-y-8">
          <Card className="p-8">
            <h2 className="text-2xl font-semibold mb-4">Privacy & Security</h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                At Ezri, we take your privacy seriously. All conversations are encrypted end-to-end, 
                and your personal data is protected with industry-standard security measures.
              </p>
              <ul className="space-y-2 ml-6 list-disc">
                <li>End-to-end encryption for all sessions</li>
                <li>HIPAA-compliant data storage</li>
                <li>No third-party data sharing without your consent</li>
                <li>Regular security audits and updates</li>
                <li>You control your data and can delete it anytime</li>
              </ul>
            </div>
          </Card>
          
          <Card className="p-8">
            <h2 className="text-2xl font-semibold mb-4">Safety Features</h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                Your safety is paramount. Ezri includes several features to ensure you get the help you need:
              </p>
              <ul className="space-y-2 ml-6 list-disc">
                <li>Crisis detection and immediate resource provision</li>
                <li>Emergency contact integration</li>
                <li>24/7 access to crisis hotlines</li>
                <li>Content moderation and safety protocols</li>
                <li>Option to pause or end sessions anytime</li>
              </ul>
              <p className="mt-4 font-medium">
                Important: Ezri is not a replacement for professional medical or mental health services. 
                In case of emergency, please call 911 or your local emergency services.
              </p>
            </div>
          </Card>
          
          <Card className="p-8">
            <h2 className="text-2xl font-semibold mb-4">Accessibility</h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                We're committed to making Ezri accessible to everyone:
              </p>
              <ul className="space-y-2 ml-6 list-disc">
                <li>Screen reader compatibility</li>
                <li>Keyboard navigation support</li>
                <li>Adjustable text sizes and contrast</li>
                <li>Closed captions for video sessions</li>
                <li>Multiple language support</li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
