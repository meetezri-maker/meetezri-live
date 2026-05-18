import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { useNavigate, useLocation } from "react-router-dom";
import { KeyRound, CheckCircle, Mail, Loader2 } from "lucide-react";
import { PasswordStrengthMeter } from "../components/ui/PasswordStrengthMeter";
import { PublicNav } from "../components/PublicNav";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";

export function InviteCreatePassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  /** Session established and URL tokens (if any) processed */
  const [ready, setReady] = useState(false);
  const [resolvedEmail, setResolvedEmail] = useState("");
  const authHandledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const fail = (msg: string) => {
      if (cancelled) return;
      toast.error(msg);
      navigate("/login", { replace: true });
    };

    const bootstrap = async () => {
      const searchParams = new URLSearchParams(location.search);
      const code = searchParams.get("code");
      const qErr = searchParams.get("error");
      const qDesc = searchParams.get("error_description");

      const hashRaw = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
      const hashParams = new URLSearchParams(hashRaw);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hErr = hashParams.get("error");
      const hDesc = hashParams.get("error_description");

      if (qErr || hErr) {
        fail(qDesc || hDesc || "Invite link failed");
        return;
      }

      const hasPkce = Boolean(code);
      const hasImplicit = Boolean(accessToken && refreshToken);

      if ((hasPkce || hasImplicit) && !authHandledRef.current) {
        authHandledRef.current = true;
        try {
          if (hasPkce) {
            const { error } = await supabase.auth.exchangeCodeForSession(code!);
            if (error) throw error;
          } else {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken!,
              refresh_token: refreshToken!,
            });
            if (error) throw error;
          }
        } catch (e: unknown) {
          const {
            data: { session: recovered },
          } = await supabase.auth.getSession();
          if (recovered) {
            window.history.replaceState(null, "", "/invite/create-password");
          } else {
            authHandledRef.current = false;
            const msg = e instanceof Error ? e.message : "Invalid or expired invite";
            fail(msg);
            return;
          }
        }

        window.history.replaceState(null, "", "/invite/create-password");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      const addr = session?.user?.email ?? "";
      setResolvedEmail(addr);

      if (!session) {
        fail("This invite link is invalid or has expired. Please ask your admin to resend the invite.");
        return;
      }

      setReady(true);
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [location.search, location.hash, navigate]);

  const email = user?.email ?? user?.user_metadata?.email ?? resolvedEmail;

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
        password,
      });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
      toast.success("Your password is set. Welcome to Ezri!");
      setTimeout(() => {
        navigate("/app/dashboard", { replace: true });
      }, 2000);
    } catch (error: unknown) {
      console.error("Error setting password:", error);
      const message = error instanceof Error ? error.message : "Failed to set password";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white via-purple-50/30 to-white">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-white">
      <PublicNav />

      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Create your password</h1>
          <p className="text-muted-foreground">
            You were invited to Ezri. Set a password to finish activating your account.
          </p>
        </div>

        <Card className="p-8">
          {isSuccess ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold">You&apos;re all set</h3>
              <p className="text-muted-foreground">Redirecting to your dashboard…</p>
              <Button className="w-full mt-4" onClick={() => navigate("/app/dashboard", { replace: true })}>
                Go to dashboard
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="invite-email"
                    type="email"
                    readOnly
                    value={email}
                    className="bg-muted/50 pl-10"
                    autoComplete="username"
                  />
                </div>
                <p className="text-xs text-muted-foreground">This is the account your admin invited.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="bg-input-background"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <PasswordStrengthMeter password={password} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  className="bg-input-background"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || !email}>
                {isLoading ? "Saving…" : "Create password & continue"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
