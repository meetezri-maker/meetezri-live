import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Link, useLocation } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { PublicNav } from "../components/PublicNav";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export function ForgotPassword() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isAdminReset = params.get("context") === "admin";

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const redirectTo = isAdminReset
        ? `${window.location.origin}/reset-password?context=admin`
        : `${window.location.origin}/reset-password`;

      // Use backend API instead of direct Supabase call for password reset
      // This allows us to use custom SMTP via the backend
      const response = await fetch(`${import.meta.env.VITE_API_URL}/email/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, redirectTo }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to send reset email");
      }

      setIsSubmitted(true);
      toast.success("Password reset email sent!");
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      toast.error(error.message || "Failed to send reset email");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-white">
      <PublicNav />
      
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {isAdminReset ? "Reset Admin Password" : "Reset Your Password"}
          </h1>
          <p className="text-muted-foreground">
            {isAdminReset
              ? "Enter your admin email and we'll send you a secure reset link"
              : "Enter your email and we'll send you a reset link"}
          </p>
        </div>
        
        <Card className="p-8">
          {isSubmitted ? (
            <div className="text-center space-y-4">
              <div className="bg-green-50 text-green-700 p-4 rounded-lg">
                <p className="font-medium">Check your email</p>
                <p className="text-sm mt-1">
                  We've sent a password reset link to <strong>{email}</strong>
                </p>
              </div>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setIsSubmitted(false)}
              >
                Try another email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="bg-input-background"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          )}
          
          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-primary hover:underline">
              Back to Login
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
