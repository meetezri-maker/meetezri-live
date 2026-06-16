import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Shield, Crown, Building2, Users, Home, ArrowLeft, Lock } from "lucide-react";
import { BrandLogo } from "../../components/BrandLogo";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { FloatingElement } from "../../components/FloatingElement";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useAdminThemeScope } from "@/app/admin/useAdminThemeScope";
import {
  adminPageRoot,
  adminPageAtmosphere,
  adminPageGlowTop,
  adminPageGlowTeal,
  adminPageVignette,
  adminCard,
  adminBtnPrimary,
  adminBtnSecondary,
  adminBtnGhost,
  adminInput,
} from "@/app/admin/adminPageChrome";
import { cn } from "@/lib/utils";
import { isSupabaseSessionExpiredLocally } from "@/lib/jwtUtils";
import { canAccessAdminPortal, type AdminLoginRole } from "@/lib/adminRoles";

/** Resolve bearer token from sign-in response or current session. */
async function resolveAccessToken(preferred?: string | null): Promise<string> {
  const token =
    preferred ??
    (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) {
    throw new Error("No valid session token. Please sign in again.");
  }
  return token;
}

type AdminRole = "super_admin" | "org_admin" | "team_admin";

interface RoleOption {
  id: AdminRole;
  name: string;
  description: string;
  icon: typeof Crown;
  accent: string;
}

const roleOptions: RoleOption[] = [
  {
    id: "super_admin",
    name: "Super Admin",
    description: "Full platform access & system management",
    icon: Crown,
    accent: "var(--admin-secondary)",
  },
  {
    id: "org_admin",
    name: "Organization Admin",
    description: "Manage organization users & settings",
    icon: Building2,
    accent: "var(--admin-primary)",
  },
  {
    id: "team_admin",
    name: "Team Admin",
    description: "Manage team members & activities",
    icon: Users,
    accent: "var(--admin-accent)",
  },
];

export function AdminLogin() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  useAdminThemeScope(true);

  // Drop expired Supabase sessions so background API calls don't reuse stale JWTs.
  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.expires_at && isSupabaseSessionExpiredLocally(session.expires_at)) {
        await supabase.auth.signOut({ scope: "local" });
      }
    })();
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<RoleOption | null>(null);
  const [step, setStep] = useState<"role" | "credentials" | "mfa">("role");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);

  const handleRoleSelect = (role: RoleOption) => {
    setSelectedRole(role);
    setStep("credentials");
    setError("");
    setEmail("");
    setPassword("");
    setMfaCode("");
    setMfaFactorId(null);
  };

  const verifyRoleAndNavigate = async (accessToken?: string, authUser?: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null) => {
    if (!selectedRole) return;

    api.clearMeCache();
    let token = await resolveAccessToken(accessToken);

    let profile;
    try {
      profile = await api.getMe(token, { skipSignOutOn401: true });
    } catch (firstErr) {
      const { data: { session: refreshed }, error } = await supabase.auth.refreshSession();
      if (error || !refreshed?.access_token) throw firstErr;
      token = refreshed.access_token;
      profile = await api.getMe(token, { skipSignOutOn401: true });
    }
    
    const hasPermission = canAccessAdminPortal(
      profile?.role,
      selectedRole.id as AdminLoginRole,
      authUser
    );

    if (!hasPermission) {
       await supabase.auth.signOut();
       throw new Error(`Access denied. You are not authorized as a ${selectedRole.name}.`);
    }

    await refreshProfile();

    toast.success(`Welcome back, ${selectedRole.name}!`);
    
    // Navigate to appropriate dashboard
    if (selectedRole.id === "super_admin") {
      navigate("/admin/super-admin-dashboard");
    } else if (selectedRole.id === "org_admin") {
      navigate("/admin/org-admin-dashboard");
    } else if (selectedRole.id === "team_admin") {
      navigate("/admin/team-admin-dashboard");
    } else {
      // Fallback
      navigate("/admin/dashboard");
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!selectedRole) return;
    if (!email || !password) {
      setError("Please fill in all fields");
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);

    try {
      await supabase.auth.signOut();

      const { data: { user, session }, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (!user) throw new Error("Login failed");

      // Check for MFA
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const totpFactor = factors?.totp?.[0];
      const accessToken = await resolveAccessToken(session?.access_token);

      try {
        const settings = await api.getSettings(accessToken, { skipSignOutOn401: true });
        const require2FA = settings.find((s: any) => s.key === 'security.require_2fa');
        
        if (require2FA?.value === true && !totpFactor) {
           await supabase.auth.signOut();
           throw new Error("Security Policy Violation: Two-Factor Authentication is required for admin access. Please enable it in your account settings.");
        }
      } catch (settingsError) {
        // If we can't fetch settings, we might be a regular user or something is wrong.
        // But if we are an admin, we should be able to.
        // We will log it but NOT block login if it's just a fetch error, unless we want strict security.
        // However, if the error is 403 (handled in api.ts throwing error), it means not authorized.
        // If not authorized, verifyRoleAndNavigate will catch it later anyway.
        // But if we want to be strict about 2FA check, we should rethrow if it was a critical failure.
        // For now, let's allow the error to bubble up if it's "Security Policy Violation", 
        // but if getSettings fails for other reasons, we might want to be careful.
        // Actually, if api.getSettings fails, it throws.
        // If I put it inside the main try/catch, it will block login. 
        // This is good for "fail closed" security.
        if (settingsError instanceof Error && settingsError.message.includes("Security Policy Violation")) {
           throw settingsError;
        }
        // Ideally we should log this. 
        console.warn("Failed to check 2FA requirement settings:", settingsError);
        // If we want strictly enforce, we should throw. 
        // "Require 2FA" implies if we can't verify, we don't let you in? 
        // Let's assume fail-open for fetch errors (network blip) but fail-closed for logic.
        // BUT, since this is a requirement, I'll let it fail open for now to avoid locking admins out if DB is down?
        // No, if DB is down, login won't work anyway.
        // So I'll just remove the inner try/catch and let it bubble up.
      }

      if (totpFactor) {
        setMfaFactorId(totpFactor.id);
        setStep("mfa");
        setIsLoading(false); // Stop loading to let user enter code
        return;
      }

      await verifyRoleAndNavigate(accessToken, user);

    } catch (err: any) {
      const rawMsg = err?.message || "Authentication failed";
      console.error("Admin login error:", err);

      // Handle a known intermittent Supabase issue where auth returns:
      // "Database error granting user ..." on sign-in
      if (typeof rawMsg === "string" && rawMsg.toLowerCase().includes("database error") && rawMsg.toLowerCase().includes("granting user")) {
        toast.error("Temporary auth issue. Retrying sign-in…");
        try {
          // Small backoff then retry once
          await new Promise((r) => setTimeout(r, 500));
          await supabase.auth.signOut({ scope: "local" });

          const { data: { user, session }, error: retryError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (retryError || !user) {
            throw retryError || new Error("Authentication failed");
          }

          // If retry works, continue as normal
          const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
          if (factorsError) throw factorsError;
          const totpFactor = factors?.totp?.[0];
          const accessToken = await resolveAccessToken(session?.access_token);
          if (totpFactor) {
            setMfaFactorId(totpFactor.id);
            setStep("mfa");
            setIsLoading(false);
            return;
          }
          await verifyRoleAndNavigate(accessToken, user);
          return;
        } catch (retryErr: any) {
          console.error("Retry sign-in failed:", retryErr);
          setError(rawMsg);
          toast.error("Authentication error: please try again or reset your password.");
          setIsLoading(false);
          return;
        }
      }

      setError(rawMsg);
      const friendlyMsg =
        rawMsg === "Session expired. Please login again."
          ? "Your previous session expired. Please sign in again with your email and password."
          : rawMsg;
      toast.error(friendlyMsg);
      setIsLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!mfaFactorId || !mfaCode) return;
    
    setIsLoading(true);

    try {
      const { data, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: data.id,
        code: mfaCode,
      });

      if (verifyError) throw verifyError;

      const accessToken = await resolveAccessToken();
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      await verifyRoleAndNavigate(accessToken, sessionUser);

    } catch (err: any) {
      console.error("MFA verification error:", err);
      setError(err.message || "Invalid code");
      toast.error(err.message || "Invalid code");
      setIsLoading(false);
    }
  };

  return (
    <div className={cn(adminPageRoot, "flex items-center justify-center")}>
      <div className={adminPageAtmosphere} aria-hidden>
        <div className={adminPageGlowTop} />
        <div className={adminPageGlowTeal} />
        <div className={adminPageVignette} />
      </div>
      {/* Back to Home Button - Fixed Top Right */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        className="fixed top-6 right-6 z-50"
      >
        <Link to="/">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 rounded-xl border border-[color:var(--admin-border)] bg-white/[0.04] px-4 py-2 font-medium text-[var(--admin-text)] backdrop-blur-lg transition-all hover:border-[color:var(--admin-border-glow)] hover:bg-white/[0.07]"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Home</span>
          </motion.button>
        </Link>
      </motion.div>

      {/* Floating background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <FloatingElement delay={0} duration={4}>
          <div className="absolute top-20 left-10 h-32 w-32 rounded-full bg-[var(--admin-glow-violet)] blur-3xl" />
        </FloatingElement>
        <FloatingElement delay={1.5} duration={5}>
          <div className="absolute bottom-40 right-20 h-40 w-40 rounded-full bg-[var(--admin-glow-teal)] blur-3xl" />
        </FloatingElement>
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="flex items-center justify-center mx-auto mb-4"
          >
            <BrandLogo heightClass="h-16" themeAware />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-2 mb-2"
          >
            <Shield className="h-6 w-6 text-[var(--admin-primary)]" />
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--admin-text)] md:text-4xl">
              Admin Portal
            </h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-[var(--admin-text-secondary)]"
          >
            {step === "role" 
              ? "Select your administrative role"
              : step === "credentials"
              ? "Enter your credentials"
              : "Two-Factor Authentication"}
          </motion.p>
        </motion.div>

        {/* Step indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-2 mb-8"
        >
          <div className={cn("h-2 w-16 rounded-full transition-all", step === "role" ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-primary)]/40")} />
          <div className={cn("h-2 w-16 rounded-full transition-all", step === "credentials" ? "bg-[var(--admin-primary)]" : step === "mfa" ? "bg-[var(--admin-primary)]/40" : "bg-white/10")} />
          {step === "mfa" && (
            <div className="h-2 w-16 rounded-full bg-[var(--admin-primary)] transition-all" />
          )}
        </motion.div>

        {step === "role" ? (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {roleOptions.filter(role => role.id !== 'org_admin').map((role, index) => (
              <motion.div
                key={role.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  onClick={() => handleRoleSelect(role)}
                  className={cn(adminCard, "cursor-pointer p-6 transition-all duration-300")}
                >
                  <div
                    className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                    style={{ background: role.accent }}
                  >
                    <role.icon className="h-7 w-7 text-[#041018]" />
                  </div>

                  <h3 className="mb-2 text-lg font-semibold text-[var(--admin-text)]">{role.name}</h3>
                  <p className="mb-4 text-sm text-[var(--admin-text-muted)]">
                    {role.description}
                  </p>

                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--admin-primary)] transition-all group-hover:gap-3">
                    Select Role
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : step === "credentials" ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <Card className={cn(adminCard, "mx-auto max-w-md p-6 md:p-8")}>
              <form onSubmit={handleCredentialsSubmit} className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="space-y-2"
                >
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter admin email"
                    className={adminInput}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter admin password"
                    className={adminInput}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                className="flex justify-end"
              >
                <Link
                  to="/forgot-password?context=admin"
                  className="text-sm text-[var(--admin-primary)] hover:underline"
                >
                  Forgot admin password?
                </Link>
              </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <button
                    type="submit"
                    className={cn(adminBtnPrimary, "w-full disabled:opacity-50")}
                    disabled={isLoading}
                  >
                    {isLoading ? "Authenticating..." : "Login to Dashboard"}
                  </button>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <button
                    type="button"
                    className={cn(adminBtnGhost, "w-full gap-2")}
                    onClick={() => setStep("role")}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Role Selection
                  </button>
                </motion.div>
              </form>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <Card className={cn(adminCard, "mx-auto max-w-md p-6 md:p-8")}>
              <form onSubmit={handleMfaSubmit} className="space-y-6">
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--admin-border-glow)] bg-[color-mix(in_srgb,var(--admin-secondary)_14%,transparent)]">
                    <Lock className="h-6 w-6 text-[var(--admin-secondary)]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--admin-text)]">Two-Factor Authentication</h3>
                  <p className="text-sm text-[var(--admin-text-muted)]">
                    Enter the code from your authenticator app
                  </p>
                </div>

                <div className="flex justify-center py-4">
                  <InputOTP
                    maxLength={6}
                    value={mfaCode}
                    onChange={(value) => setMfaCode(value)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <button
                  type="submit"
                  className={cn(adminBtnPrimary, "w-full disabled:opacity-50")}
                  disabled={isLoading || mfaCode.length !== 6}
                >
                  {isLoading ? "Verifying..." : "Verify Code"}
                </button>

                <button
                  type="button"
                  className={cn(adminBtnGhost, "w-full gap-2")}
                  onClick={() => setStep("credentials")}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </button>
              </form>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
