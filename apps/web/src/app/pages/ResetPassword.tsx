import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { useLocation, useNavigate } from "react-router-dom";
import { KeyRound, CheckCircle } from "lucide-react";
import { PublicNav } from "../components/PublicNav";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isAdminReset, setIsAdminReset] = useState(false);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const context = params.get("context");
    const adminReset = context === "admin";
    setIsAdminReset(adminReset);

    const init = async () => {
      const code = params.get("code");
      const error = params.get("error");
      const errorDescription = params.get("error_description");
      const loginPath = adminReset ? "/admin/login" : "/login";
      const forgotPath = adminReset ? "/forgot-password?context=admin" : "/forgot-password";

      if (error) {
        toast.error(errorDescription || "Password reset failed");
        navigate(loginPath);
        return;
      }

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          toast.error("Password reset link is invalid or has expired");
          navigate(forgotPath);
          return;
        }
      } catch (err: any) {
        console.error("Error processing password reset link:", err);
        toast.error(err.message || "Failed to process reset link");
        navigate(forgotPath);
        return;
      } finally {
        setIsProcessing(false);
      }
    };

    init();
  }, [location, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
      toast.success("Password updated successfully!");
      
      // Redirect to login after a delay
      const loginPath = isAdminReset ? "/admin/login" : "/login";
      setTimeout(() => {
        navigate(loginPath);
      }, 3000);
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast.error(error.message || "Failed to reset password");
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
            {isAdminReset ? "Set New Admin Password" : "Set New Password"}
          </h1>
          <p className="text-muted-foreground">
            {isAdminReset
              ? "Create a new password for your admin account."
              : "Enter your new password below"}
          </p>
        </div>
        
        <Card className="p-8">
          {isSuccess ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold">Password Reset Complete</h3>
              <p className="text-muted-foreground">
                {isAdminReset
                  ? "Your admin password has been successfully updated. Redirecting to admin login..."
                  : "Your password has been successfully updated. Redirecting to login..."}
              </p>
              <Button 
                className="w-full mt-4"
                onClick={() => navigate(isAdminReset ? "/admin/login" : "/login")}
              >
                {isAdminReset ? "Go to Admin Login" : "Go to Login"}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="bg-input-background"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading || isProcessing}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  className="bg-input-background"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading || isProcessing}
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading || isProcessing}>
                {isLoading ? "Updating..." : isProcessing ? "Verifying reset link..." : "Update Password"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
