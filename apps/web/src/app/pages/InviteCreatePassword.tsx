import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useNavigate, useLocation } from "react-router-dom";
import { KeyRound, CheckCircle, Mail, Loader2 } from "lucide-react";
import { PasswordStrengthMeter } from "../components/ui/PasswordStrengthMeter";
import { PublicNav } from "../components/PublicNav";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "@/lib/utils";

const INVITE_PANEL_SHELL = cn(
  "relative w-full overflow-visible rounded-[20px] border border-[#e879a9]/20 sm:rounded-[22px]",
  "bg-[rgba(12,10,24,0.72)] p-6 backdrop-blur-[20px] sm:p-8",
  "shadow-[0_0_0_1px_rgba(236,72,153,0.08),0_0_24px_-18px_rgba(168,85,247,0.16),0_16px_40px_-28px_rgba(0,0,0,0.82)]",
  "supports-[backdrop-filter]:bg-[rgba(12,10,24,0.68)]",
);

const glassInput = cn(
  "h-10 w-full rounded-xl border border-white/12 bg-white/[0.045] text-[13px] text-white",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition-[box-shadow,border-color]",
  "placeholder:text-violet-200/35 focus:border-[#E91E63]/45 focus:ring-2 focus:ring-[#E91E63]/28 sm:text-[14px]",
);

const glassLabel = "text-[13px] font-medium text-violet-200/75";

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
      <div className="solace-login-page flex min-h-screen items-center justify-center bg-[#050612] text-[#f4f4f8]">
        <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="solace-login-page relative flex min-h-screen flex-col overflow-x-hidden bg-[#050612] text-[#f4f4f8]">
      <PublicNav variant="cinematic" />

      <main className="relative z-10 flex flex-1 flex-col justify-center py-10 sm:py-16">
        <div className="mx-auto w-full max-w-md px-4 sm:px-6">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/25 bg-violet-500/10 shadow-[0_0_24px_-8px_rgba(139,92,246,0.45)]">
              <KeyRound className="h-8 w-8 text-violet-300" />
            </div>
            <h1 className="mb-2 text-3xl font-bold text-[#faf8fc]">Create your password</h1>
            <p className="text-sm leading-relaxed text-violet-200/75">
              You were invited to Ezri. Set a password to finish activating your account.
            </p>
          </div>

          <div className={INVITE_PANEL_SHELL}>
            <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-[#E91E63]/[0.06] via-transparent to-[#9C27B0]/[0.05]" />
            <div className="relative">
          {isSuccess ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
                <CheckCircle className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold text-[#faf8fc]">You&apos;re all set</h3>
              <p className="text-sm text-violet-200/75">Redirecting to your dashboard…</p>
              <Button className="mt-4 w-full" onClick={() => navigate("/app/dashboard", { replace: true })}>
                Go to dashboard
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="invite-email" className={glassLabel}>
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-200/42" />
                  <Input
                    id="invite-email"
                    type="email"
                    readOnly
                    value={email}
                    className={cn(glassInput, "pl-10")}
                    autoComplete="username"
                  />
                </div>
                <p className="text-xs text-violet-200/55">This is the account your admin invited.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className={glassLabel}>
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className={glassInput}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <PasswordStrengthMeter password={password} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className={glassLabel}>
                  Confirm password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  className={glassInput}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || !email} isLoading={isLoading}>
                Create password & continue
              </Button>
            </form>
          )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
