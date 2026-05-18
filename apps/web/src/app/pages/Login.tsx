import { useMemo, useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import {
  Loader2,
  Lock,
  Menu,
  X,
  Mail,
  Heart,
  Shield,
  Leaf,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "../contexts/AuthContext";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "../components/ui/input-otp";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { resolveVerificationRedirectForFlow } from "@/lib/verificationRedirect";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form";
import { cn } from "@/lib/utils";
import { BrandLogo } from "../components/BrandLogo";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/** Scene-only twilight lake — no baked UI (login page only). */
const LOGIN_HERO_BG = "/solace/emotional-focus-twilight-sanctuary.jpg";

const LOGIN_NAV_H = "76px";

const MAIN_TRUST = [
  {
    title: "Private & Secure",
    description: "Your data is encrypted and always protected.",
    Icon: Shield,
    glowClass:
      "shadow-[0_0_36px_-4px_rgba(233,30,99,0.55)] ring-[#E91E63]/35 text-[#fda4cf]",
    ringClass: "from-[#E91E63]/55 to-purple-900/20",
  },
  {
    title: "Judgment-Free Space",
    description: "We're here to support you, always.",
    Icon: Heart,
    glowClass:
      "shadow-[0_0_36px_-4px_rgba(156,39,176,0.5)] ring-[#a855f7]/35 text-[#d8b4fe]",
    ringClass: "from-[#9C27B0]/55 to-indigo-900/25",
  },
  {
    title: "Personalized for You",
    description: "Tools and insights that grow with you.",
    Icon: Leaf,
    glowClass:
      "shadow-[0_0_36px_-4px_rgba(45,212,191,0.35)] ring-teal-400/30 text-[#99f6e4]",
    ringClass: "from-teal-400/45 to-emerald-900/20",
  },
] as const;

interface SolaceLoginNavProps {
  className?: string;
}

function SolaceLoginNav({ className }: SolaceLoginNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 shrink-0 border-b border-white/[0.06] bg-[#070815]/35 backdrop-blur-xl",
        "supports-[backdrop-filter]:bg-[#070815]/22]",
        className,
      )}
      style={{ height: LOGIN_NAV_H }}
    >
      <div className="relative flex h-full w-full items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <Link to="/" className="relative z-10 flex shrink-0 items-center">
          <BrandLogo heightClass="h-10" />
        </Link>

        <nav
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 text-[14px] font-normal tracking-wide text-violet-100/78 md:flex"
          aria-label="Primary"
        >
          <Link
            to="/how-it-works"
            className="transition-colors hover:text-white/95"
          >
            How It Works
          </Link>
          <Link to="/pricing" className="transition-colors hover:text-white/95">
            Pricing
          </Link>
          <Link to="/privacy" className="transition-colors hover:text-white/95">
            Privacy &amp; Safety
          </Link>
        </nav>

        <div className="relative z-10 hidden items-center gap-5 sm:flex">
          <Link
            to="/login"
            className="text-[14px] text-violet-100/78 transition-colors hover:text-white"
          >
            Log In
          </Link>
          <Link
            to="/pricing"
            className="rounded-full bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-6 py-2.5 text-[13px] font-medium text-white shadow-[0_0_28px_-4px_rgba(233,30,99,0.55)] transition-[box-shadow,transform] duration-300 hover:shadow-[0_0_40px_-2px_rgba(168,85,247,0.42)] active:scale-[0.98]"
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          className="relative z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/90 sm:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="solace-login-mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open ? (
        <div
          id="solace-login-mobile-nav"
          className="border-t border-white/[0.06] bg-[#070812]/85 px-4 py-4 backdrop-blur-xl sm:hidden"
        >
          <nav className="flex flex-col gap-3 text-sm text-violet-100/85">
            <Link to="/how-it-works" onClick={() => setOpen(false)}>
              How It Works
            </Link>
            <Link to="/pricing" onClick={() => setOpen(false)}>
              Pricing
            </Link>
            <Link to="/privacy" onClick={() => setOpen(false)}>
              Privacy &amp; Safety
            </Link>
            <Link to="/login" onClick={() => setOpen(false)}>
              Log In
            </Link>
            <Link
              to="/pricing"
              onClick={() => setOpen(false)}
              className="mt-1 inline-flex w-fit rounded-full bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-5 py-2 text-sm font-medium text-white shadow-[0_0_22px_-4px_rgba(233,30,99,0.5)]"
            >
              Get Started
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

interface LotusEmblemProps {
  className?: string;
}

function LotusEmblem({ className }: LotusEmblemProps) {
  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <Sparkles
        size={12}
        className="absolute -right-0.5 top-3 text-pink-200/55"
        aria-hidden
      />
      <Sparkles
        size={10}
        className="absolute -left-1.5 top-7 text-violet-200/45"
        aria-hidden
      />
      <div
        className="relative flex h-[84px] w-[84px] items-center justify-center rounded-full border border-[#E91E63]/24 bg-gradient-to-b from-[#E91E63]/14 to-[#9C27B0]/12 shadow-[0_0_32px_-10px_rgba(233,30,99,0.38),inset_0_0_18px_rgba(168,85,247,0.1)]"
        aria-hidden
      >
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_38%,rgba(233,30,99,0.32),transparent_68%)]" />
        <svg
          viewBox="0 0 64 64"
          className="relative h-10 w-10 text-[#f9a8d4] drop-shadow-[0_0_14px_rgba(233,30,99,0.35)]"
          fill="currentColor"
          aria-hidden
        >
          <path d="M32 8c-4 8-12 14-12 24 0 8 6 14 12 18 6-4 12-10 12-18 0-10-8-16-12-24z" />
          <path
            opacity="0.88"
            d="M16 28c6 2 10 8 10 16 0 6-2 10-6 14-5-4-8-10-8-16 0-6 2-12 4-14z"
          />
          <path
            opacity="0.88"
            d="M48 28c-2 2-4 8-4 14 0 6 3 12 8 16 4-4 6-8 6-14 0-8-4-14-10-16z"
          />
        </svg>
      </div>
    </div>
  );
}

interface TrustStackProps {
  className?: string;
  compact?: boolean;
}

function TrustStack({ className, compact }: TrustStackProps) {
  return (
    <ul
      className={cn("flex flex-col gap-5", compact && "gap-3.5", className)}
      aria-label="How we care for you"
    >
      {MAIN_TRUST.map(({ title, description, Icon, glowClass, ringClass }) => (
        <li key={title} className="flex gap-4">
          <div
            className={cn(
              "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/35 ring-1 backdrop-blur-md",
              glowClass,
            )}
          >
            <div
              className={cn(
                "pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br opacity-55 blur-[2px]",
                ringClass,
              )}
            />
            <Icon className="relative z-[1]" size={compact ? 18 : 19} aria-hidden />
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                "font-medium tracking-wide text-white/95",
                compact ? "text-sm" : "text-[15px]",
              )}
            >
              {title}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-violet-200/62">
              {description}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

interface WelcomeBlockProps {
  className?: string;
}

function WelcomeBlock({ className }: WelcomeBlockProps) {
  return (
    <div className={cn(className)}>
      <h1 className="solace-login-serif text-[clamp(1.85rem,3.2vw,2.75rem)] font-medium leading-[1.08] text-[#faf8fc] drop-shadow-[0_2px_28px_rgba(0,0,0,0.45)]">
        Welcome Back
      </h1>
      <p className="solace-login-serif mt-1.5 text-[clamp(1.35rem,2.2vw,1.85rem)] font-medium italic tracking-wide text-[#f472b8] drop-shadow-[0_0_18px_rgba(233,30,99,0.25)]">
        You&apos;re safe here. <span aria-hidden>♡</span>
      </p>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-[#bdb7d6]/90 sm:text-[15px]">
        Log in to continue your wellness journey
      </p>
    </div>
  );
}

interface EmotionalQuoteCardProps {
  className?: string;
}

function EmotionalQuoteCard({ className }: EmotionalQuoteCardProps) {
  return (
    <aside
      className={cn(
        "relative max-w-[min(100%,22rem)] rounded-[24px] border border-[#f472b8]/28 bg-black/35 px-5 py-4 pr-10 backdrop-blur-md",
        "shadow-[0_0_0_1px_rgba(236,72,153,0.1),0_0_28px_-14px_rgba(236,72,153,0.18),0_20px_56px_-28px_rgba(0,0,0,0.85)]",
        className,
      )}
      aria-label="Encouragement"
    >
      <p className="solace-login-serif text-[15px] font-medium italic leading-snug tracking-wide text-[#ede9fe]/95 sm:text-[16px]">
        &ldquo;It&rsquo;s okay to take a step back,
        <br />
        as long as you don&rsquo;t give up.&rdquo;
      </p>
      <Heart
        size={15}
        className="absolute bottom-3.5 right-3.5 text-[#f472b8] drop-shadow-[0_0_8px_rgba(233,30,99,0.4)]"
        aria-hidden
      />
    </aside>
  );
}

function LoginSceneBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <img
        src={LOGIN_HERO_BG}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center brightness-[0.55] contrast-[1.04] saturate-[1.06]"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg, rgba(5,6,18,0.78) 0%, rgba(5,6,18,0.32) 45%, rgba(5,6,18,0.68) 100%)",
        }}
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_100%,rgba(236,72,153,0.12)_0%,transparent_55%)]"
        aria-hidden
      />
      <div className="login-hero-stars absolute inset-0 opacity-30" aria-hidden />
    </div>
  );
}

const otpSlotClass =
  "h-11 w-10 rounded-md border border-white/12 bg-white/[0.05] text-white data-[active=true]:border-[#E91E63]/45 data-[active=true]:ring-2 data-[active=true]:ring-[#E91E63]/25";


const LOGIN_PANEL_SHELL = cn(
  "relative w-full overflow-visible rounded-[34px] border border-[#e879a9]/22",
  "bg-[rgba(12,10,24,0.72)] p-8 backdrop-blur-[24px] sm:p-10 lg:p-14",
  "shadow-[0_0_0_1px_rgba(236,72,153,0.1),0_0_40px_-18px_rgba(168,85,247,0.22),0_24px_64px_-32px_rgba(0,0,0,0.82)]",
  "supports-[backdrop-filter]:bg-[rgba(12,10,24,0.68)]",
);

interface LoginAuthPanelProps {
  loginStep: "credentials" | "mfa" | "knowledge";
  setLoginStep: (step: "credentials" | "mfa" | "knowledge") => void;
  form: ReturnType<typeof useForm<LoginFormValues>>;
  onSubmit: (data: LoginFormValues) => Promise<void>;
  handleGoogleLogin: () => Promise<void>;
  handleMfaSubmit: (e: React.FormEvent) => Promise<void>;
  handleKnowledgeSubmit: (e: React.FormEvent) => Promise<void>;
  handleRequestRecoveryCode: () => Promise<void>;
  handleVerifyRecoveryCode: () => Promise<void>;
  handleVerifyEmailAuthCode: () => Promise<void>;
  isLoading: boolean;
  mfaCode: string;
  setMfaCode: (v: string) => void;
  knowledgeCode: string;
  setKnowledgeCode: (v: string) => void;
  emailAuthCode: string;
  setEmailAuthCode: (v: string) => void;
  emailAuthCodeSent: boolean;
  setEmailAuthCodeSent: (v: boolean) => void;
  knowledgeEmailEnabled: boolean;
  showRecovery: boolean;
  setShowRecovery: (v: boolean) => void;
  recoveryCode: string;
  setRecoveryCode: (v: string) => void;
  recoveryCodeSent: boolean;
  setRecoveryCodeSent: (v: boolean) => void;
  setEmailAuthCodeSentFalse: () => void;
  resetKnowledgeFlow: () => void;
  setIsLoading: (loading: boolean) => void;
  glassInput: string;
  otpSlotClass: string;
}

function LoginAuthPanel({
  loginStep,
  setLoginStep,
  form,
  onSubmit,
  handleGoogleLogin,
  handleMfaSubmit,
  handleKnowledgeSubmit,
  handleRequestRecoveryCode,
  handleVerifyRecoveryCode,
  handleVerifyEmailAuthCode,
  isLoading,
  mfaCode,
  setMfaCode,
  knowledgeCode,
  setKnowledgeCode,
  emailAuthCode,
  setEmailAuthCode,
  emailAuthCodeSent,
  setEmailAuthCodeSent,
  knowledgeEmailEnabled,
  showRecovery,
  setShowRecovery,
  recoveryCode,
  setRecoveryCode,
  recoveryCodeSent,
  glassInput,
  otpSlotClass,
  resetKnowledgeFlow,
  setIsLoading,
}: LoginAuthPanelProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <LotusEmblem className="mb-5" />
                        <div className="mb-6 text-center">
                        <h2 className="solace-login-serif text-[clamp(1.75rem,2.5vw,2.5rem)] font-medium leading-tight text-[#faf8fc] sm:text-[2rem]">
                        Log In to Solace
                        </h2>
                        <p className="mt-2 text-[14px] leading-relaxed text-violet-200/75 sm:text-[15px]">
                        One step at a time.{" "}
                        <span className="font-medium text-[#f472b8]">We&apos;re here for you.</span>
                        </p>
                        </div>
                        
                        {loginStep === "credentials" && (
                        <>
                        <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl border border-white/12 bg-white/[0.045] text-[15px] font-medium text-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_24px_-12px_rgba(233,30,99,0.25)] transition-[box-shadow,background-color,border-color] hover:border-[#E91E63]/28 hover:bg-white/[0.08] hover:shadow-[0_0_40px_-12px_rgba(168,85,247,0.28)]"
                        >
                        <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" aria-hidden>
                        <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#e8e8f0"
                        />
                        <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#c4b5fd"
                        />
                        <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#f9a8d4"
                        />
                        <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#a78bfa"
                        />
                        </svg>
                        Continue with Google
                        </button>
                        
                        <div className="my-4 flex items-center gap-4">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-white/[0.22]" />
                        <span className="text-[11px] uppercase tracking-[0.22em] text-violet-200/42">
                        OR
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/[0.08] to-white/[0.22]" />
                        </div>
                        
                        <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-[13px] font-medium text-violet-200/75">
                        Email Address
                        </FormLabel>
                        <FormControl>
                        <div className="relative">
                        <Mail
                        className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-violet-200/42"
                        aria-hidden
                        />
                        <Input
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        className={glassInput}
                        {...field}
                        />
                        </div>
                        </FormControl>
                        <FormMessage className="text-[#fda4af]" />
                        </FormItem>
                        )}
                        />
                        
                        <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                        <FormItem>
                        <div className="flex items-end justify-between gap-3">
                        <FormLabel className="text-[13px] font-medium text-violet-200/75">
                        Password
                        </FormLabel>
                        <Link
                        to="/forgot-password"
                        className="text-[13px] font-medium text-[#f472b8] transition-colors hover:text-[#fbcfe8]"
                        >
                        Forgot?
                        </Link>
                        </div>
                        <FormControl>
                        <div className="relative">
                        <Lock
                        className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-violet-200/42"
                        aria-hidden
                        />
                        <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        className={cn(glassInput, "pr-11")}
                        {...field}
                        />
                        <button
                        type="button"
                        className="absolute right-3.5 top-1/2 z-[1] -translate-y-1/2 text-violet-200/50 transition-colors hover:text-violet-100"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                        </div>
                        </FormControl>
                        <FormMessage className="text-[#fda4af]" />
                        </FormItem>
                        )}
                        />
                        
                        <button
                        type="submit"
                        disabled={isLoading}
                        className="group relative mt-1 flex h-[54px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#E91E63] via-[#c026d3] to-[#9C27B0] py-3.5 text-[15px] font-semibold text-white shadow-[0_0_42px_-8px_rgba(233,30,99,0.55),inset_0_1px_0_rgba(255,255,255,0.18)] transition-[transform,box-shadow] duration-300 hover:shadow-[0_0_56px_-4px_rgba(168,85,247,0.45)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
                        >
                        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.28),transparent_55%)] opacity-60 mix-blend-screen" />
                        <span className="relative z-[1] flex items-center gap-2">
                        {isLoading ? (
                        <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Logging in?
                        </>
                        ) : (
                        <>
                        Log In
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </>
                        )}
                        </span>
                        </button>
                        </form>
                        </Form>
                        </>
                        )}
                        
                        {loginStep === "mfa" ? (
                        <form onSubmit={handleMfaSubmit} className="space-y-6">
                        <div className="text-center">
                        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#E91E63]/25 bg-gradient-to-br from-[#E91E63]/15 to-[#9C27B0]/12 shadow-[0_0_32px_-8px_rgba(233,30,99,0.45)]">
                        <Lock className="h-6 w-6 text-[#f9a8d4]" aria-hidden />
                        </div>
                        <h3 className="solace-login-serif text-xl font-medium text-[#faf8fc]">
                        Two-Factor Authentication
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-violet-200/65">
                        Enter the 6-digit code from your authenticator app.
                        </p>
                        </div>
                        
                        <div className="flex justify-center py-1">
                        <InputOTP
                        maxLength={6}
                        value={mfaCode}
                        onChange={(value) => setMfaCode(value)}
                        >
                        <InputOTPGroup>
                        <InputOTPSlot index={0} className={otpSlotClass} />
                        <InputOTPSlot index={1} className={otpSlotClass} />
                        <InputOTPSlot index={2} className={otpSlotClass} />
                        <InputOTPSlot index={3} className={otpSlotClass} />
                        <InputOTPSlot index={4} className={otpSlotClass} />
                        <InputOTPSlot index={5} className={otpSlotClass} />
                        </InputOTPGroup>
                        </InputOTP>
                        </div>
                        
                        <button
                        type="submit"
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#E91E63] to-[#9C27B0] py-3.5 text-[15px] font-semibold text-white shadow-[0_0_36px_-8px_rgba(233,30,99,0.5)] transition-[box-shadow] hover:shadow-[0_0_48px_-4px_rgba(168,85,247,0.4)] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isLoading || mfaCode.length !== 6}
                        >
                        {isLoading ? (
                        <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Verifying?
                        </>
                        ) : (
                        "Verify Code"
                        )}
                        </button>
                        
                        <Button
                        type="button"
                        variant="ghost"
                        className="w-full border border-white/10 bg-transparent text-violet-100/80 hover:bg-white/[0.05] hover:text-white"
                        onClick={() => {
                        setLoginStep("credentials");
                        setMfaCode("");
                        }}
                        disabled={isLoading}
                        >
                        Back to Login
                        </Button>
                        </form>
                        ) : null}
                        
                        {loginStep === "knowledge" ? (
                        <form onSubmit={handleKnowledgeSubmit} className="space-y-6">
                        <div className="text-center">
                        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#E91E63]/25 bg-gradient-to-br from-[#E91E63]/15 to-[#9C27B0]/12 shadow-[0_0_32px_-8px_rgba(233,30,99,0.45)]">
                        <Lock className="h-6 w-6 text-[#f9a8d4]" aria-hidden />
                        </div>
                        <h3 className="solace-login-serif text-xl font-medium text-[#faf8fc]">
                        Two-Factor Authentication
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-violet-200/65">
                        {knowledgeEmailEnabled
                        ? "Enter your email authentication code."
                        : "Enter your 2FA PIN or security answer."}
                        </p>
                        </div>
                        
                        {knowledgeEmailEnabled && (
                        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs leading-relaxed text-violet-200/55">
                        A 6-digit authentication code is sent to your account email at login.
                        </p>
                        <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-full border-white/15 bg-white/[0.04] text-violet-100/90 hover:bg-white/[0.07]"
                        onClick={async () => {
                        setIsLoading(true);
                        try {
                        await api.requestKnowledgeTwoFactorLoginCode();
                        setEmailAuthCodeSent(true);
                        toast.success("Authentication code sent to your email.");
                        } catch (error: unknown) {
                        const msg =
                        error instanceof Error
                        ? error.message
                        : "Failed to send authentication code";
                        toast.error(msg);
                        } finally {
                        setIsLoading(false);
                        }
                        }}
                        disabled={isLoading}
                        >
                        {emailAuthCodeSent ? "Resend authentication code" : "Send authentication code"}
                        </Button>
                        <div className="flex justify-center py-1">
                        <InputOTP
                        maxLength={6}
                        value={emailAuthCode}
                        onChange={(value) => setEmailAuthCode(value)}
                        >
                        <InputOTPGroup>
                        <InputOTPSlot index={0} className={otpSlotClass} />
                        <InputOTPSlot index={1} className={otpSlotClass} />
                        <InputOTPSlot index={2} className={otpSlotClass} />
                        <InputOTPSlot index={3} className={otpSlotClass} />
                        <InputOTPSlot index={4} className={otpSlotClass} />
                        <InputOTPSlot index={5} className={otpSlotClass} />
                        </InputOTPGroup>
                        </InputOTP>
                        </div>
                        <button
                        type="button"
                        className="flex w-full items-center justify-center rounded-full border border-white/12 bg-white/[0.06] py-3 text-sm font-medium text-white/95 transition-[background] hover:bg-white/[0.09]"
                        onClick={handleVerifyEmailAuthCode}
                        disabled={isLoading || emailAuthCode.trim().length !== 6}
                        >
                        Verify authentication code
                        </button>
                        </div>
                        )}
                        
                        <div className="relative">
                        <Lock
                        className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-violet-200/42"
                        aria-hidden
                        />
                        <Input
                        type="password"
                        value={knowledgeCode}
                        onChange={(e) => setKnowledgeCode(e.target.value)}
                        placeholder={
                        knowledgeEmailEnabled ? "PIN/answer not required" : "Enter PIN or answer"
                        }
                        className={cn(glassInput, "pl-11")}
                        />
                        </div>
                        
                        {!showRecovery ? (
                        <button
                        type="button"
                        className="w-full text-center text-sm font-medium text-[#f472b8] underline-offset-4 hover:underline disabled:opacity-50"
                        onClick={() => setShowRecovery(true)}
                        disabled={isLoading}
                        >
                        Lost PIN or answer? Try another way
                        </button>
                        ) : (
                        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs leading-relaxed text-violet-200/55">
                        We will email a 6-digit recovery code to your account email. Verifying it
                        will disable knowledge 2FA for this login.
                        </p>
                        <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-full border-white/15 bg-white/[0.04] text-violet-100/90 hover:bg-white/[0.07]"
                        onClick={handleRequestRecoveryCode}
                        disabled={isLoading}
                        >
                        {recoveryCodeSent ? "Resend recovery code" : "Send recovery code"}
                        </Button>
                        <div className="flex justify-center py-1">
                        <InputOTP
                        maxLength={6}
                        value={recoveryCode}
                        onChange={(value) => setRecoveryCode(value)}
                        >
                        <InputOTPGroup>
                        <InputOTPSlot index={0} className={otpSlotClass} />
                        <InputOTPSlot index={1} className={otpSlotClass} />
                        <InputOTPSlot index={2} className={otpSlotClass} />
                        <InputOTPSlot index={3} className={otpSlotClass} />
                        <InputOTPSlot index={4} className={otpSlotClass} />
                        <InputOTPSlot index={5} className={otpSlotClass} />
                        </InputOTPGroup>
                        </InputOTP>
                        </div>
                        <button
                        type="button"
                        className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#E91E63] to-[#9C27B0] py-3 text-sm font-semibold text-white shadow-[0_0_36px_-8px_rgba(233,30,99,0.45)]"
                        onClick={handleVerifyRecoveryCode}
                        disabled={isLoading || recoveryCode.trim().length !== 6}
                        >
                        Verify recovery code
                        </button>
                        </div>
                        )}
                        
                        <button
                        type="submit"
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#E91E63] to-[#9C27B0] py-3.5 text-[15px] font-semibold text-white shadow-[0_0_36px_-8px_rgba(233,30,99,0.5)] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isLoading || knowledgeEmailEnabled || !knowledgeCode.trim()}
                        >
                        {isLoading ? (
                        <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Verifying?
                        </>
                        ) : (
                        "Verify"
                        )}
                        </button>
                        
                        <Button
                        type="button"
                        variant="ghost"
                        className="w-full border border-white/10 bg-transparent text-violet-100/80 hover:bg-white/[0.05] hover:text-white"
                        onClick={() => {
                        setLoginStep("credentials");
                        setKnowledgeCode("");
                        setEmailAuthCode("");
                        setEmailAuthCodeSent(false);
                        setShowRecovery(false);
                        setRecoveryCode("");
                        setRecoveryCodeSent(false);
                        }}
                        disabled={isLoading}
                        >
                        Back to Login
                        </Button>
                        </form>
                        ) : null}
                        
                        {loginStep === "credentials" && (
                        <p className="mt-4 text-center text-[14px] text-violet-200/65">
                        Don&apos;t have an account?{" "}
                        <Link
                        to="/signup"
                        className="font-medium text-[#f472b8] transition-colors hover:text-[#fbcfe8]"
                        >
                        Sign up
                        </Link>
                        </p>
                        )}
                        
      <p className="mt-5 flex items-start justify-center gap-2 text-center text-[10px] leading-relaxed text-violet-200/42">
        <Shield size={12} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#f472b8]/65" aria-hidden />
        <span>
          By logging in, you agree to our{" "}
          <Link to="/terms" className="text-[#f472b8]/95 hover:text-[#fbcfe8]">Terms &amp; Conditions</Link> and{" "}
          <Link to="/privacy" className="text-[#f472b8]/95 hover:text-[#fbcfe8]">Privacy Policy</Link>
        </span>
      </p>
    </>
  );
}

export function Login() {
  const navigate = useNavigate();
  const { user, profile, isLoading: isAuthLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [loginStep, setLoginStep] = useState<"credentials" | "mfa" | "knowledge">(
    "credentials",
  );
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [knowledgeCode, setKnowledgeCode] = useState("");
  const [emailAuthCode, setEmailAuthCode] = useState("");
  const [emailAuthCodeSent, setEmailAuthCodeSent] = useState(false);
  const [knowledgeEmailEnabled, setKnowledgeEmailEnabled] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryCodeSent, setRecoveryCodeSent] = useState(false);

  const isMfaStillRequired = async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) return false;
    return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
  };

  const onboardingStartRoute =
    profile?.signup_type === "trial" ? "/app/dashboard" : "/onboarding/welcome";

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema as z.ZodTypeAny),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (loginStep !== "credentials") return;
    if (isAuthLoading || !user || !profile) return;
    let cancelled = false;
    (async () => {
      const needsMfa = await isMfaStillRequired();
      if (cancelled || needsMfa) return;
      if (profile.onboarding_completed === true) {
        navigate("/app/dashboard");
      } else {
        navigate(onboardingStartRoute);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, profile, isAuthLoading, navigate, onboardingStartRoute, loginStep]);

  useEffect(() => {
    if (loginStep !== "knowledge") return;
    if (!knowledgeEmailEnabled) return;
    let cancelled = false;
    const sendCode = async () => {
      try {
        await api.requestKnowledgeTwoFactorLoginCode();
        if (!cancelled) {
          setEmailAuthCodeSent(true);
          toast.success("Authentication code sent to your email.");
        }
      } catch (error: unknown) {
        if (!cancelled) {
          const msg = error instanceof Error ? error.message : "Failed to send authentication code";
          toast.error(msg);
        }
      }
    };
    void sendCode();
    return () => {
      cancelled = true;
    };
  }, [loginStep, knowledgeEmailEnabled]);

  const handleGoogleLogin = async () => {
    try {
      await supabase.auth.signOut({ scope: "global" }).catch(() => undefined);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: "select_account",
            access_type: "offline",
          },
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to sign in with Google";
      toast.error(msg);
    }
  };

  const handleResendVerification = async (emailToResend: string) => {
    try {
      const signupType = profile?.signup_type === "trial" ? "trial" : "plan";
      const { emailRedirectTo: redirectTo, targetPath, baseUrl, isLocal, source } =
        resolveVerificationRedirectForFlow(signupType);

      console.log(
        "Resend (Login Page): supabase.auth.resend emailRedirectTo (exact):",
        redirectTo,
        {
          origin: window.location.origin,
          hostname: window.location.hostname,
          env: import.meta.env.DEV ? "dev" : "prod",
          isLocal,
          signupType,
          targetPath,
          VITE_WEB_BASE_URL: import.meta.env.VITE_WEB_BASE_URL,
          WEB_BASE_URL: import.meta.env.VITE_WEB_BASE_URL,
          APP_URL: undefined,
          baseUrlResolved: baseUrl,
          baseUrlSource: source,
          flow: "frontend_login_supabase_resend",
        },
      );

      const { error } = await supabase.auth.resend({
        type: "signup",
        email: emailToResend,
        options: {
          emailRedirectTo: redirectTo,
        },
      });
      if (error) throw error;
      toast.success("Verification email sent! Please check your inbox.");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to resend verification email";
      toast.error(msg);
    }
  };

  const continueAfterLogin = async () => {
    try {
      const needsMfa = await isMfaStillRequired();
      if (needsMfa) return;
      const me = await api.getMe();
      const resolvedOnboardingStartRoute =
        me?.signup_type === "trial" ? "/app/dashboard" : "/onboarding/welcome";
      navigate(
        me?.onboarding_completed === true ? "/app/dashboard" : resolvedOnboardingStartRoute,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message === "Profile not found") {
        navigate(onboardingStartRoute);
      } else {
        console.error("Profile fetch error:", err);
        toast.error("Failed to load profile. Please try again.");
      }
    }
  };

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) throw error;

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const totpFactor = factors?.totp?.[0];

      if (totpFactor) {
        setMfaFactorId(totpFactor.id);
        setMfaCode("");
        setLoginStep("mfa");
        return;
      }

      const knowledgeStatus = (await api.getKnowledgeTwoFactorStatus()) as {
        enabled: boolean;
        email_code_enabled?: boolean;
      };
      if (knowledgeStatus.enabled === true) {
        setKnowledgeCode("");
        setEmailAuthCode("");
        setEmailAuthCodeSent(false);
        setKnowledgeEmailEnabled(knowledgeStatus.email_code_enabled === true);
        setLoginStep("knowledge");
        return;
      }

      await continueAfterLogin();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to sign in";
      if (msg.includes("Email not confirmed")) {
        toast.error("Email not confirmed", {
          action: {
            label: "Resend Link",
            onClick: () => handleResendVerification(data.email),
          },
          duration: 8000,
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId || mfaCode.length !== 6) return;
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

      await continueAfterLogin();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Invalid verification code";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKnowledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!knowledgeCode.trim()) return;
    setIsLoading(true);
    try {
      await api.verifyKnowledgeTwoFactor(knowledgeCode.trim());
      await continueAfterLogin();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Invalid 2FA PIN or answer";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestRecoveryCode = async () => {
    setIsLoading(true);
    try {
      await api.requestKnowledgeTwoFactorRecovery();
      setRecoveryCodeSent(true);
      toast.success("Recovery code sent to your email.");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to send recovery code";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyRecoveryCode = async () => {
    if (!/^\d{6}$/.test(recoveryCode.trim())) {
      toast.error("Enter a valid 6-digit recovery code");
      return;
    }
    setIsLoading(true);
    try {
      await api.verifyKnowledgeTwoFactorRecovery(recoveryCode.trim());
      toast.success("Recovery successful. Knowledge 2FA has been disabled.");
      await continueAfterLogin();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Invalid recovery code";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmailAuthCode = async () => {
    if (!/^\d{6}$/.test(emailAuthCode.trim())) {
      toast.error("Enter a valid 6-digit authentication code");
      return;
    }
    setIsLoading(true);
    try {
      await api.verifyKnowledgeTwoFactorLoginCode(emailAuthCode.trim());
      await continueAfterLogin();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Invalid authentication code";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const glassInput =
    "h-[54px] w-full rounded-[14px] border border-white/12 bg-white/[0.045] pl-11 pr-3 text-[15px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition-[box-shadow,border-color] placeholder:text-violet-200/35 focus:border-[#E91E63]/45 focus:ring-2 focus:ring-[#E91E63]/28";

  return (
    <div className="solace-login-page relative min-h-screen overflow-x-hidden bg-[#050612] text-[#f4f4f8]">
      <LoginSceneBackdrop />

      <SolaceLoginNav />

      <main className="relative z-10">
        <div className="grid grid-cols-1 items-center gap-6 px-5 py-6 sm:py-8 lg:grid-cols-2 lg:gap-10 lg:px-[clamp(32px,4.5vw,72px)] lg:py-10 lg:pb-14">
            <section className="hidden flex-col justify-center py-2 lg:flex">
              <WelcomeBlock />
              <TrustStack className="mt-7 max-w-lg" />
              <EmotionalQuoteCard className="mt-auto pt-8" />
            </section>

            <section className="order-first flex items-center justify-center lg:order-none lg:justify-end">
              <div className="w-full max-w-[min(100%,560px)]">
                <div className={LOGIN_PANEL_SHELL}>
                  <div className="pointer-events-none absolute -left-12 -top-12 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.28),transparent_70%)]" />
                  <div className="pointer-events-none absolute inset-0 rounded-[34px] bg-gradient-to-br from-[#E91E63]/[0.06] via-transparent to-[#9C27B0]/[0.05]" />
                  <div className="relative">
                    <LoginAuthPanel
                      loginStep={loginStep}
                      setLoginStep={setLoginStep}
                      form={form}
                      onSubmit={onSubmit}
                      handleGoogleLogin={handleGoogleLogin}
                      handleMfaSubmit={handleMfaSubmit}
                      handleKnowledgeSubmit={handleKnowledgeSubmit}
                      handleRequestRecoveryCode={handleRequestRecoveryCode}
                      handleVerifyRecoveryCode={handleVerifyRecoveryCode}
                      handleVerifyEmailAuthCode={handleVerifyEmailAuthCode}
                      isLoading={isLoading}
                      mfaCode={mfaCode}
                      setMfaCode={setMfaCode}
                      knowledgeCode={knowledgeCode}
                      setKnowledgeCode={setKnowledgeCode}
                      emailAuthCode={emailAuthCode}
                      setEmailAuthCode={setEmailAuthCode}
                      emailAuthCodeSent={emailAuthCodeSent}
                      setEmailAuthCodeSent={setEmailAuthCodeSent}
                      knowledgeEmailEnabled={knowledgeEmailEnabled}
                      showRecovery={showRecovery}
                      setShowRecovery={setShowRecovery}
                      recoveryCode={recoveryCode}
                      setRecoveryCode={setRecoveryCode}
                      recoveryCodeSent={recoveryCodeSent}
                      setEmailAuthCodeSentFalse={() => setEmailAuthCodeSent(false)}
                      resetKnowledgeFlow={() => {
                        setKnowledgeCode("");
                        setEmailAuthCode("");
                        setEmailAuthCodeSent(false);
                        setShowRecovery(false);
                        setRecoveryCode("");
                        setRecoveryCodeSent(false);
                      }}
                      glassInput={glassInput}
                      otpSlotClass={otpSlotClass}
                      setIsLoading={setIsLoading}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="shrink-0 pb-6 lg:hidden">
              <WelcomeBlock />
              <TrustStack className="mt-5" compact />
              <EmotionalQuoteCard className="mx-auto mt-4 max-w-md" />
            </section>
        </div>
      </main>
    </div>
  );
}
