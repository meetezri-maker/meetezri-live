import { PublicNav } from "../components/PublicNav";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Link } from "react-router";
import { Video, Heart, BookOpen, Sparkles, Clock, Shield, Zap, TrendingUp } from "lucide-react";

export function HowItWorks() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">How Ezri Works</h1>
          <p className="text-xl text-muted-foreground">
            Your personal AI wellness companion, designed to support your mental health journey
          </p>
        </div>
        
        {/* Main Steps */}
        <div className="space-y-12 mb-16">
          <Card className="p-8">
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-3">1. Quick & Easy Onboarding</h2>
                <p className="text-muted-foreground mb-4">
                  Get started in minutes. We'll ask a few questions about your wellness goals, 
                  baseline health information, and preferences. This helps Ezri understand how to 
                  best support you.
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    Basic profile setup
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    Wellness baseline assessment
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    Emergency contact information
                  </li>
                </ul>
              </div>
            </div>
          </Card>
          
          <Card className="p-8">
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Video className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-3">2. FaceTime With Ezri</h2>
                <p className="text-muted-foreground mb-4">
                  Connect with Ezri through natural, FaceTime-style video sessions. Share how you're feeling, 
                  talk through challenges, or simply have someone to listen. Ezri is always available, 
                  day or night.
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-secondary rounded-full"></div>
                    Real-time video conversations
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-secondary rounded-full"></div>
                    Natural language understanding
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-secondary rounded-full"></div>
                    Empathetic and supportive responses
                  </li>
                </ul>
              </div>
            </div>
          </Card>
          
          <Card className="p-8">
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Heart className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-3">3. Track Your Wellness</h2>
                <p className="text-muted-foreground mb-4">
                  Monitor your emotional well-being with mood tracking, journaling, and personalized insights. 
                  See patterns emerge and celebrate your progress over time.
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full"></div>
                    Daily mood check-ins
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full"></div>
                    Private journaling
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full"></div>
                    Trend analysis and insights
                  </li>
                </ul>
              </div>
            </div>
          </Card>
          
          <Card className="p-8">
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-3">4. Access Wellness Tools</h2>
                <p className="text-muted-foreground mb-4">
                  Use guided meditation, breathing exercises, and other evidence-based wellness tools. 
                  Ezri can guide you through these activities during your sessions or you can access them anytime.
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                    Guided meditations
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                    Breathing exercises
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                    Coping strategies
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
        
        {/* Key Features */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Key Features</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6">
              <Clock className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">24/7 Availability</h3>
              <p className="text-muted-foreground text-sm">
                Connect with Ezri whenever you need support, no appointments necessary
              </p>
            </Card>
            
            <Card className="p-6">
              <Shield className="w-10 h-10 text-secondary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Private & Secure</h3>
              <p className="text-muted-foreground text-sm">
                Your conversations are encrypted and your privacy is our top priority
              </p>
            </Card>
            
            <Card className="p-6">
              <Zap className="w-10 h-10 text-accent mb-4" />
              <h3 className="text-lg font-semibold mb-2">Instant Response</h3>
              <p className="text-muted-foreground text-sm">
                Get immediate support without waiting in queues or scheduling appointments
              </p>
            </Card>
            
            <Card className="p-6">
              <TrendingUp className="w-10 h-10 text-orange-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Progress Tracking</h3>
              <p className="text-muted-foreground text-sm">
                See your wellness journey unfold with insights and trends over time
              </p>
            </Card>
          </div>
        </div>
        
        {/* CTA */}
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-6">
            Try Ezri for 7 days. No credit card required.
          </p>
          <Link to="/signup">
            <Button size="lg">
              Start Your Trial
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}