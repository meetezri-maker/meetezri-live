import { useMemo, useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { PhoneInput } from "../components/ui/phone-input";
import { Label } from "../components/ui/label";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Sparkles,
  Loader2,
  Heart,
  Shield,
  Lock,
  Users,
  Menu,
  X,
  Mail,
  User,
  Calendar,
  Eye,
  EyeOff,
} from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { resolveVerificationRedirectForFlow } from "@/lib/verificationRedirect";
import { PasswordStrengthMeter } from "../components/ui/PasswordStrengthMeter";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form";
import { cn } from "@/lib/utils";

const signupSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  age: z.string().refine((val) => {
    const num = parseInt(val);
    return !isNaN(num) && num >= 18;
  }, "You must be 18+ to create an account"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

const SIGNUP_HERO_BG = "/solace/login-cinematic-lock.png";
const SIGNUP_NAV_H = "4.75rem";

const glassInput =
  "h-12 w-full rounded-2xl border border-white/12 bg-white/[0.045] text-[15px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition-[box-shadow,border-color] placeholder:text-violet-200/35 focus:border-[#E91E63]/45 focus:ring-2 focus:ring-[#E91E63]/28 focus-visible:ring-[#E91E63]/28";

const SIGNUP_BENEFITS = [
  {
    title: "7-Day Trial",
    description: "Try all features with no commitment",
    Icon: Heart,
    glowClass:
      "shadow-[0_0_36px_-4px_rgba(233,30,99,0.55)] ring-[#E91E63]/35 text-[#fda4cf]",
    ringClass: "from-[#E91E63]/55 to-purple-900/20",
  },
  {
    title: "24/7 Access",
    description: "Connect with Solace anytime, anywhere",
    Icon: Users,
    glowClass:
      "shadow-[0_0_36px_-4px_rgba(156,39,176,0.5)] ring-[#a855f7]/35 text-[#d8b4fe]",
    ringClass: "from-[#9C27B0]/55 to-indigo-900/25",
  },
  {
    title: "Cancel Anytime",
    description: "No long-term commitment required",
    Icon: Shield,
    glowClass:
      "shadow-[0_0_36px_-4px_rgba(45,212,191,0.35)] ring-teal-400/30 text-[#99f6e4]",
    ringClass: "from-teal-400/45 to-emerald-900/20",
  },
  {
    title: "Private & Secure",
    description: "Your data is encrypted and protected",
    Icon: Lock,
    glowClass:
      "shadow-[0_0_36px_-4px_rgba(129,140,248,0.4)] ring-indigo-400/30 text-[#a5b4fc]",
    ringClass: "from-indigo-400/45 to-violet-900/20",
  },
] as const;

interface SolaceSignupNavProps {
  className?: string;
}

function SolaceSignupNav({ className }: SolaceSignupNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className={cn(
        "relative z-50 shrink-0 border-b border-white/[0.08] bg-[#070815]/75 backdrop-blur-2xl",
        "shadow-[inset_0_-1px_0_rgba(233,30,99,0.14)] supports-[backdrop-filter]:bg-[#070815]/55",
        className,
      )}
      style={{ height: SIGNUP_NAV_H }}
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
            to="/signup"
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
          aria-controls="solace-signup-mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open ? (
        <div
          id="solace-signup-mobile-nav"
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
              to="/signup"
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

interface SignupBenefitsListProps {
  className?: string;
  compact?: boolean;
}

function SignupBenefitsList({ className, compact }: SignupBenefitsListProps) {
  return (
    <ul
      className={cn("flex flex-col gap-5", compact && "gap-4", className)}
      aria-label="Membership benefits"
    >
      {SIGNUP_BENEFITS.map(({ title, description, Icon, glowClass, ringClass }) => (
        <li key={title} className="flex gap-4">
          <div
            className={cn(
              "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-black/35 ring-1 backdrop-blur-md",
              glowClass,
            )}
          >
            <div
              className={cn(
                "pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br opacity-55 blur-[2px]",
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

interface SignupTrustCardProps {
  className?: string;
}

function SignupTrustCard({ className }: SignupTrustCardProps) {
  return (
    <aside
      className={cn(
        "rounded-[1.5rem] border border-[#f472b8]/22 bg-black/28 px-6 py-5 backdrop-blur-xl",
        "shadow-[0_0_0_1px_rgba(236,72,153,0.1),0_0_48px_-16px_rgba(168,85,247,0.35),0_22px_64px_-32px_rgba(0,0,0,0.86)]",
        className,
      )}
      aria-label="Privacy assurance"
    >
      <div className="flex gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E91E63]/30 bg-gradient-to-br from-[#E91E63]/15 to-[#9C27B0]/12 shadow-[0_0_28px_-6px_rgba(233,30,99,0.45)]">
          <Shield className="h-5 w-5 text-[#f9a8d4]" aria-hidden />
        </div>
        <div>
          <p className="text-[15px] font-medium text-white/95">You&apos;re in safe hands</p>
          <p className="mt-2 text-[13px] leading-relaxed text-violet-200/65">
            Solace is designed to support you with care, compassion, and complete privacy.
          </p>
        </div>
      </div>
    </aside>
  );
}

interface SignupWelcomeBlockProps {
  className?: string;
  showMark?: boolean;
}

function SignupWelcomeBlock({ className, showMark = true }: SignupWelcomeBlockProps) {
  return (
    <div className={cn(className)}>
      {showMark ? (
        <div className="mb-8 flex items-center">
          <BrandLogo heightClass="h-12" />
        </div>
      ) : null}
      <h1 className="solace-login-serif text-[clamp(2rem,3.4vw,3.1rem)] font-medium leading-[1.1] text-[#faf8fc] drop-shadow-[0_2px_28px_rgba(0,0,0,0.45)]">
        Start Your
        <br />
        Wellness Journey{" "}
        <span className="relative inline-flex items-center gap-2">
          <span className="bg-gradient-to-r from-[#f472b8] via-[#e879f9] to-[#c084fc] bg-clip-text text-transparent drop-shadow-[0_0_22px_rgba(233,30,99,0.35)]">
            Today
          </span>
          <Sparkles
            className="h-5 w-5 shrink-0 text-[#f472b8] drop-shadow-[0_0_12px_rgba(233,30,99,0.55)]"
            aria-hidden
          />
        </span>
      </h1>
      <p className="mt-5 max-w-md text-[15px] leading-relaxed text-violet-200/72">
        Join thousands who trust Solace for their mental health and wellbeing
      </p>
    </div>
  );
}

interface SignupCinematicLeftProps {
  className?: string;
  variant: "immersive" | "hero-banner";
}

function SignupCinematicLeft({ className, variant }: SignupCinematicLeftProps) {
  const particles = useMemo(() => [...Array(10)].map((_, i) => i), []);
  const isBanner = variant === "hero-banner";

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[#05040a]",
        isBanner
          ? "min-h-[260px] sm:min-h-[320px]"
          : "min-h-[280px] lg:h-full lg:min-h-[calc(100vh-4.75rem)]",
        className,
      )}
    >
      <img
        src={SIGNUP_HERO_BG}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-[1.02] object-cover"
      />
      <div
        className="absolute inset-0 bg-gradient-to-br from-[#0a0a12]/88 via-[#15051f]/55 to-transparent"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#07040d]/94 via-transparent to-[#0a0814]/72"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[#090515]/92 to-transparent"
        aria-hidden
      />
      <div
        className="solace-login-water-shimmer pointer-events-none absolute inset-x-[-20%] bottom-0 h-[42%] bg-gradient-to-t from-orange-400/[0.07] via-fuchsia-500/[0.04] to-transparent mix-blend-screen"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-[-10%] bottom-[-8%] h-[52%] bg-[radial-gradient(ellipse_at_50%_100%,rgba(125,74,218,0.22),transparent_58%)] blur-3xl" />
      <div className="pointer-events-none absolute left-[8%] top-[14%] h-px w-px rounded-full bg-white/90 shadow-[2px_14px_0_0_rgba(255,255,255,0.85),118px_32px_0_0_rgba(255,255,255,0.35),212px_-10px_0_0_rgba(255,255,255,0.45),286px_24px_0_0_rgba(255,255,255,0.25),356px_-6px_0_0_rgba(255,255,255,0.4)] opacity-95" />

      <div
        className="pointer-events-none absolute right-[10%] top-[14%] h-11 w-11 rounded-full bg-gradient-to-br from-[#f5f0ff] to-[#9b87c9]/25 opacity-[0.9] shadow-[0_0_32px_-4px_rgba(200,181,255,0.45)] [mask-image:radial-gradient(circle_at_76%_24%,transparent_58%,black_58.8%)] [-webkit-mask-image:radial-gradient(circle_at_76%_24%,transparent_58%,black_58.8%)]"
        aria-hidden
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-[-2%] h-[52%]" aria-hidden>
        <div className="absolute bottom-[-4%] left-1/2 h-[62%] w-[120%] -translate-x-1/2 skew-x-[10deg] bg-gradient-to-t from-orange-950/45 via-purple-950/12 to-transparent opacity-95 mix-blend-multiply blur-sm" />
        <div className="absolute bottom-[6%] left-[42%] h-2 w-[min(340px,38vw)] -translate-x-1/2 rotate-[-6deg] rounded-full bg-gradient-to-r from-amber-900/95 via-orange-950/58 to-transparent shadow-[inset_0_1px_0_rgba(255,237,206,0.25)] blur-[0.8px]" />
        <div
          className="solace-login-lantern-breathe absolute bottom-[10%] left-[calc(42%-72px)] h-28 w-24"
          aria-hidden
        >
          <div className="absolute bottom-10 left-1/2 flex h-[120px] w-[120px] -translate-x-1/2 items-end justify-center">
            <div className="h-full w-[2px] bg-gradient-to-b from-transparent via-amber-800/58 to-transparent" />
            <div className="absolute bottom-0 h-[78px] w-[58px] rounded-sm bg-gradient-to-b from-orange-950/94 via-orange-950/92 to-orange-950/88 shadow-[0_26px_50px_-8px_rgba(0,0,0,0.65)] outline outline-1 outline-amber-400/35" />
            <div className="absolute bottom-[52px] h-8 w-[56px] rounded-t-full bg-gradient-to-b from-amber-200/55 to-amber-500/85 shadow-[inset_0_-4px_10px_rgba(0,0,0,0.35)]" />
            <div className="absolute bottom-[74px] left-1/2 h-10 w-[68px] -translate-x-1/2 rounded-lg bg-orange-950/88 shadow-inner ring-2 ring-orange-700/58" />
            <div className="absolute bottom-[92px] left-1/2 h-7 w-[46px] -translate-x-1/2 rounded-md bg-orange-950/78" />
            <div className="absolute bottom-[84px] left-1/2 h-16 w-16 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,193,7,0.95)_12%,rgba(255,154,71,0.55)_42%,transparent_68%)] opacity-92 blur-[0.5px] mix-blend-screen" />
          </div>
          <div className="absolute bottom-[4%] left-[42%] h-24 w-[min(560px,80vw)] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(ellipse_at_50%_50%,rgba(255,173,74,0.35),transparent_62%)] mix-blend-screen blur-md" />
        </div>

        {particles.map((i) => (
          <span
            key={i}
            className="solace-login-particle"
            style={
              {
                "--delay": `${i * 0.92}s`,
                "--ox": `${(i % 7) * 26 - 78}px`,
                "--sx": `${(i % 5) * 12 - 24}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {!isBanner ? (
        <div className="relative z-[1] hidden h-full min-h-[calc(100vh-4.75rem)] flex-col justify-between gap-10 px-10 py-10 lg:flex xl:px-14">
          <div className="max-w-md shrink-0">
            <SignupWelcomeBlock />
            <div className="mt-10">
              <SignupBenefitsList />
            </div>
          </div>
          <SignupTrustCard className="mt-auto max-w-sm shrink-0" />
          <div className="pointer-events-none h-4 shrink-0" />
        </div>
      ) : null}
    </div>
  );
}

function ShieldEmblem({ className }: { className?: string }) {
  return (
    <div className={cn("flex", className)}>
      <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full border border-[#E91E63]/25 bg-gradient-to-b from-[#E91E63]/14 to-[#9C27B0]/10 shadow-[0_0_40px_-8px_rgba(233,30,99,0.55),inset_0_0_24px_rgba(168,85,247,0.12)]">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_40%,rgba(233,30,99,0.35),transparent_68%)] opacity-80" />
        <Shield
          className="relative h-9 w-9 text-[#f9a8d4] drop-shadow-[0_0_18px_rgba(233,30,99,0.45)]"
          aria-hidden
        />
      </div>
    </div>
  );
}

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  name: string;
  placeholder: string;
  show: boolean;
  onToggle: () => void;
  autoComplete?: string;
}

function PasswordField({
  value,
  onChange,
  onBlur,
  name,
  placeholder,
  show,
  onToggle,
  autoComplete,
}: PasswordFieldProps) {
  return (
    <div className="relative">
      <Lock
        className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-violet-200/42"
        aria-hidden
      />
      <Input
        type={show ? "text" : "password"}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={cn(glassInput, "pr-11 pl-11")}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 z-[1] -translate-y-1/2 rounded-md p-1 text-violet-200/50 transition-colors hover:text-violet-100/90"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, isLoading: isAuthLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<"form" | "trialDetails">("form");
  const [trialContact, setTrialContact] = useState({
    name: "",
    phone: "",
    relationship: "",
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [trialDetailsLoading, setTrialDetailsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isExactContactPhone = (value: string) => /^\+\d{12}$/.test(value.trim());
  const contactValid =
    trialContact.name.trim().length >= 2 &&
    isExactContactPhone(trialContact.phone) &&
    trialContact.relationship.trim().length >= 2;

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema as any),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      age: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (!isAuthLoading && user && profile) {
      try {
        const selectedPlan = window.localStorage.getItem("selectedPlan");
        if (selectedPlan === "trial" && phase === "trialDetails") {
          return;
        }
      } catch {}
      navigate(profile?.onboarding_completed === true ? "/app/dashboard" : "/onboarding/welcome");
    }
  }, [user, profile, isAuthLoading, navigate, phase]);

  useEffect(() => {
    try {
      const current = window.localStorage.getItem("selectedPlan");
      if (!current) {
        window.localStorage.setItem("selectedPlan", "trial");
        window.localStorage.removeItem("planPurchased");
      } else if (current === "trial") {
        window.localStorage.removeItem("planPurchased");
      }
    } catch {}
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const postCheckout = params.get("postCheckout") === "1";
    const plan = params.get("plan");
    const sessionId = params.get("session_id");

    if (postCheckout) {
      try {
        window.localStorage.setItem("planPurchased", "1");
        if (plan) {
          window.localStorage.setItem("selectedPlan", plan);
        }
        if (sessionId) {
          window.localStorage.setItem("stripeSessionId", sessionId);
        }
      } catch {}
    }
  }, [location.search]);

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
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in with Google");
    }
  };

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);
    try {
      const checkResult = await api.checkUserExists(data.email);

      const selectedPlan = window.localStorage.getItem("selectedPlan");
      const planPurchased = window.localStorage.getItem("planPurchased") === "1";

      if (checkResult.exists) {
        if (selectedPlan === "trial") {
          if (checkResult.state === "FULLY_ONBOARDED") {
            toast.error("Your account is already active. Please sign in.");
            setIsLoading(false);
            navigate("/login");
            return;
          }

          if (checkResult.state === "EMAIL_UNVERIFIED") {
            toast.error("Your account exists but email verification is still pending.");
            setIsLoading(false);
            navigate("/verify-email");
            return;
          }

          toast.error("Your account setup is incomplete. Please sign in to continue onboarding.");
          setIsLoading(false);
          navigate("/login");
          return;
        }

        if (checkResult.state === "FULLY_ONBOARDED") {
          toast.error("Your account is already active. Please sign in.");
          setIsLoading(false);
          navigate("/login");
          return;
        }

        if (
          checkResult.state === "EMAIL_VERIFIED_ONBOARDING_INCOMPLETE" ||
          checkResult.state === "AUTH_CREATED_PROFILE_CREATED_ONBOARDING_INCOMPLETE"
        ) {
          toast.error("Your account setup is incomplete. Please sign in to continue onboarding.");
          setIsLoading(false);
          navigate("/login");
          return;
        }
      }

      if (selectedPlan === "trial") {
        const redirectUrl = `${window.location.origin}/app/user-profile`;
        const targetPath = "/app/user-profile";
        const baseUrl = window.location.origin;
        const isLocal = true;
        const source = "window.location.origin(trial_hardcode)";

        console.log("Trial signup: supabase.auth.signUp emailRedirectTo (exact):", redirectUrl, {
          flow: "frontend_trial_supabase_signup",
          origin: window.location.origin,
          hostname: window.location.hostname,
          env: import.meta.env.DEV ? "dev" : "prod",
          isLocal,
          VITE_WEB_BASE_URL: import.meta.env.VITE_WEB_BASE_URL,
          WEB_BASE_URL: import.meta.env.VITE_WEB_BASE_URL,
          APP_URL: undefined,
          targetPath,
          baseUrlResolved: baseUrl,
          baseUrlSource: source,
        });

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              first_name: data.firstName,
              last_name: data.lastName,
              age: data.age,
              email_verification_required: true,
              signup_type: "trial",
              signup_source: "app",
            },
          },
        });
        if (signUpError) {
          throw signUpError;
        }
        setPhase("trialDetails");
        toast.success("Account created! Add an emergency contact to continue.");
        return;
      }

      const stripeSessionId = window.localStorage.getItem("stripeSessionId");

      const signupRes = await api.signup({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        age: data.age,
        stripe_session_id: stripeSessionId || undefined,
      });

      if (signupRes?.action === "continue_onboarding") {
        toast.success(signupRes?.message || "Please sign in to continue onboarding.");
        navigate("/login");
      } else {
        toast.success(
          signupRes?.message || "Account created! Please verify your email to continue.",
        );
        navigate("/verify-email");
      }
    } catch (error: any) {
      const rawMessage = error.message || "";
      const message = rawMessage.toLowerCase();

      const isRateLimit = error.code === "over_email_send_rate_limit";
      const isDuplicateEmail =
        error.code === "user_already_exists" ||
        error.code === "email_exists" ||
        message.includes("user already registered") ||
        message.includes("already exists") ||
        message.includes("duplicate key value") ||
        message.includes("users_email_key") ||
        message.includes("email address is already in use");

      if (isRateLimit) {
        toast.error("Too many attempts. Please try again later or use a different email.");
      } else if (isDuplicateEmail) {
        toast.error("Account already created. Please log in instead.");
        navigate("/login");
      } else {
        toast.error(rawMessage || "Failed to create account");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const trialGlassLabel = "text-[13px] font-medium text-violet-200/75";
  const trialGlassInput = cn(glassInput, "pl-3");

  return (
    <div className="solace-login-page min-h-screen bg-[#0a0a12] text-[#f4f4f8]">
      <SolaceSignupNav />

      <div className="flex flex-col lg:hidden">
        <SignupCinematicLeft variant="hero-banner" />
        <div className="relative z-[2] mx-auto w-full max-w-lg px-5 pb-2 pt-8">
          <SignupWelcomeBlock showMark={false} />
          <div className="mt-8">
            <SignupBenefitsList compact />
          </div>
          <SignupTrustCard className="mt-8" />
        </div>
      </div>

      <div className="relative z-[1] flex w-full justify-center px-3 sm:px-5 lg:min-h-[calc(100vh-4.75rem)] lg:px-6 xl:px-8">
        <div
          className={cn(
            "flex w-full max-w-[min(1320px,calc(100vw-1.5rem))] flex-col gap-0 xl:max-w-[1360px]",
            "lg:flex-row lg:items-stretch lg:overflow-hidden lg:rounded-[2rem]",
            "lg:border lg:border-white/[0.08] lg:bg-[#05040a]/40",
            "lg:shadow-[0_0_0_1px_rgba(233,30,99,0.06),0_48px_120px_-48px_rgba(0,0,0,0.82)]",
            "lg:min-h-[calc(100vh-4.75rem)]",
          )}
        >
          <div className="relative hidden min-h-0 lg:block lg:w-[52%] lg:min-w-0 lg:flex-none">
            <SignupCinematicLeft variant="immersive" className="h-full min-h-[calc(100vh-4.75rem)]" />
          </div>

          <div
            className={cn(
              "flex w-full flex-col justify-center lg:w-[48%] lg:min-w-0 lg:flex-none",
              "lg:min-h-[calc(100vh-4.75rem)] lg:border-l lg:border-white/[0.06]",
              "lg:bg-[#080812]/55 lg:px-6 lg:py-10 xl:px-10 xl:py-12",
            )}
          >
            <div className="mx-auto w-full max-w-[600px] px-5 pb-12 pt-4 sm:px-8 lg:px-0 lg:pb-0 lg:pt-0">
              <div className="relative rounded-[2rem] border border-[#E91E63]/22 bg-[#0c0e18]/75 p-7 shadow-[0_0_0_1px_rgba(168,85,247,0.08),0_48px_120px_-48px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl sm:p-9">
                <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-br from-[#E91E63]/[0.07] via-transparent to-[#9C27B0]/[0.08]" />
                <div className="relative">
                  <ShieldEmblem className="mb-6" />
                  <div className="mb-8">
                    <h2 className="solace-login-serif text-[1.85rem] font-medium leading-tight text-[#faf8fc] sm:text-[2rem]">
                      {phase === "form" ? "Create Your Account" : "Emergency Contact & Terms"}
                    </h2>
                    <p className="mt-2 text-[14px] leading-relaxed text-violet-200/75 sm:text-[15px]">
                      {phase === "form"
                        ? "Begin your journey to a better you"
                        : "One more step before your first session"}
                    </p>
                  </div>

                  {phase === "form" ? (
                    <>
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="flex w-full items-center justify-center gap-3 rounded-[1.125rem] border border-white/14 bg-white/[0.05] py-3.5 text-[15px] font-medium text-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_24px_-12px_rgba(233,30,99,0.25)] transition-[box-shadow,background-color,border-color] hover:border-[#E91E63]/28 hover:bg-white/[0.08] hover:shadow-[0_0_40px_-12px_rgba(168,85,247,0.28)]"
                      >
                        <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" aria-hidden>
                          <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                          />
                          <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                          />
                          <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            fill="#FBBC05"
                          />
                          <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                          />
                        </svg>
                        Sign up with Google
                      </button>

                      <div className="my-7 flex items-center gap-4">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#E91E63]/25 to-white/[0.18]" />
                        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-violet-200/45">
                          Or sign up with email
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#E91E63]/25 to-white/[0.18]" />
                      </div>

                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <FormField
                              control={form.control}
                              name="firstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className={trialGlassLabel}>First Name</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <User
                                        className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-violet-200/42"
                                        aria-hidden
                                      />
                                      <Input
                                        placeholder="John"
                                        autoComplete="given-name"
                                        className={cn(glassInput, "pl-11")}
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
                              name="lastName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className={trialGlassLabel}>Last Name</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <User
                                        className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-violet-200/42"
                                        aria-hidden
                                      />
                                      <Input
                                        placeholder="Doe"
                                        autoComplete="family-name"
                                        className={cn(glassInput, "pl-11")}
                                        {...field}
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage className="text-[#fda4af]" />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={trialGlassLabel}>Email Address</FormLabel>
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
                                      className={cn(glassInput, "pl-11")}
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
                            name="age"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={trialGlassLabel}>Age</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Calendar
                                      className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-violet-200/42"
                                      aria-hidden
                                    />
                                    <Input
                                      type="number"
                                      min="18"
                                      placeholder="18"
                                      autoComplete="off"
                                      className={cn(glassInput, "pl-11")}
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
                                <FormLabel className={trialGlassLabel}>Password</FormLabel>
                                <FormControl>
                                  <PasswordField
                                    value={field.value ?? ""}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    placeholder="At least 8 characters"
                                    show={showPassword}
                                    onToggle={() => setShowPassword((v) => !v)}
                                    autoComplete="new-password"
                                  />
                                </FormControl>
                                <PasswordStrengthMeter password={field.value ?? ""} />
                                <FormMessage className="text-[#fda4af]" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="confirmPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={trialGlassLabel}>Confirm Password</FormLabel>
                                <FormControl>
                                  <PasswordField
                                    value={field.value ?? ""}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    placeholder="Re-enter your password"
                                    show={showConfirmPassword}
                                    onToggle={() => setShowConfirmPassword((v) => !v)}
                                    autoComplete="new-password"
                                  />
                                </FormControl>
                                <FormMessage className="text-[#fda4af]" />
                              </FormItem>
                            )}
                          />

                          <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[#E91E63] via-[#c026d3] to-[#9C27B0] py-3.5 text-[15px] font-semibold text-white shadow-[0_0_42px_-8px_rgba(233,30,99,0.55),inset_0_1px_0_rgba(255,255,255,0.18)] transition-[transform,box-shadow] duration-300 hover:shadow-[0_0_56px_-4px_rgba(168,85,247,0.45)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
                          >
                            <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.28),transparent_55%)] opacity-60 mix-blend-screen" />
                            <span className="relative z-[1] flex items-center gap-2">
                              {isLoading ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                  Creating Account...
                                </>
                              ) : (
                                <>
                                  Create Account
                                  <ArrowRight
                                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                                    aria-hidden
                                  />
                                </>
                              )}
                            </span>
                          </button>
                        </form>
                      </Form>
                    </>
                  ) : (
                    <>
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <Label className={trialGlassLabel}>Emergency Contact Name</Label>
                          <Input
                            placeholder="e.g., Jane Doe"
                            value={trialContact.name}
                            aria-invalid={!trialContact.name.trim()}
                            className={cn(
                              trialGlassInput,
                              !trialContact.name.trim() &&
                                "border-red-400/50 focus:border-red-400/50 focus:ring-red-400/25",
                            )}
                            onChange={(e) =>
                              setTrialContact({ ...trialContact, name: e.target.value })
                            }
                          />
                          {!trialContact.name.trim() && (
                            <p className="mt-1 text-xs text-[#fda4af]">Name is required</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className={trialGlassLabel}>Emergency Contact Phone</Label>
                          <PhoneInput
                            value={trialContact.phone}
                            onChange={(value) =>
                              setTrialContact({ ...trialContact, phone: value || "" })
                            }
                            placeholder="Phone number"
                          />
                          {trialContact.phone && !isExactContactPhone(trialContact.phone) && (
                            <p className="mt-1 text-xs text-[#fda4af]">
                              Use country code and exactly 12 digits total
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className={trialGlassLabel}>Relationship</Label>
                          <Input
                            placeholder="e.g., Sister"
                            value={trialContact.relationship}
                            aria-invalid={!trialContact.relationship.trim()}
                            className={cn(
                              trialGlassInput,
                              !trialContact.relationship.trim() &&
                                "border-red-400/50 focus:border-red-400/50 focus:ring-red-400/25",
                            )}
                            onChange={(e) =>
                              setTrialContact({ ...trialContact, relationship: e.target.value })
                            }
                          />
                          {!trialContact.relationship.trim() && (
                            <p className="mt-1 text-xs text-[#fda4af]">Relationship is required</p>
                          )}
                        </div>
                        <label className="flex items-start gap-3 text-sm text-violet-200/75">
                          <input
                            type="checkbox"
                            checked={termsAccepted}
                            onChange={(e) => setTermsAccepted(e.target.checked)}
                            className="mt-1 rounded border-white/20 bg-white/[0.06]"
                          />
                          <span>
                            I agree to the{" "}
                            <Link
                              to="/terms"
                              className="font-medium text-[#f472b8] hover:text-[#fbcfe8]"
                            >
                              Terms &amp; Conditions
                            </Link>{" "}
                            and{" "}
                            <Link
                              to="/privacy"
                              className="font-medium text-[#f472b8] hover:text-[#fbcfe8]"
                            >
                              Privacy Policy
                            </Link>
                          </span>
                        </label>
                        {!termsAccepted && (
                          <p className="text-xs text-[#fda4af]">
                            Please accept the terms to continue
                          </p>
                        )}
                      </div>
                      <div className="mt-6">
                        <button
                          type="button"
                          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#E91E63] via-[#c026d3] to-[#9C27B0] py-3.5 text-[15px] font-semibold text-white shadow-[0_0_42px_-8px_rgba(233,30,99,0.55)] transition-[box-shadow] hover:shadow-[0_0_56px_-4px_rgba(168,85,247,0.45)] disabled:cursor-not-allowed disabled:opacity-55"
                          disabled={!termsAccepted || !contactValid || trialDetailsLoading}
                          onClick={async () => {
                            try {
                              if (!termsAccepted) {
                                toast.error(
                                  "Please accept the terms and conditions to continue.",
                                );
                                return;
                              }
                              if (!contactValid) {
                                const errors = [];
                                if (trialContact.name.trim().length < 2)
                                  errors.push("name (minimum 2 characters)");
                                if (!isExactContactPhone(trialContact.phone))
                                  errors.push("phone (country code + exactly 12 digits)");
                                if (trialContact.relationship.trim().length < 2)
                                  errors.push("relationship (minimum 2 characters)");
                                toast.error(
                                  `Please complete emergency contact details correctly: ${errors.join(", ")}`,
                                );
                                return;
                              }
                              setTrialDetailsLoading(true);

                              const { data: sessionData } = await supabase.auth.getSession();
                              console.log(
                                "Session status:",
                                sessionData?.session ? "Active" : "None",
                              );

                              if (!sessionData?.session) {
                                const email = form.getValues("email");
                                const password = form.getValues("password");

                                const { error } = await supabase.auth.signInWithPassword({
                                  email,
                                  password,
                                });

                                if (error) {
                                  console.error("Sign in failed:", error);

                                  const isEmailNotConfirmed =
                                    error.message?.toLowerCase().includes("email not confirmed") ||
                                    error.message?.toLowerCase().includes("confirm your email") ||
                                    error.code === "email_not_confirmed";

                                  if (isEmailNotConfirmed) {
                                    toast.error(
                                      "Verification required. Please check your email to activate your account.",
                                      {
                                        action: {
                                          label: "Resend Email",
                                          onClick: async () => {
                                            const redirectUrl = `${window.location.origin}/app/user-profile`;
                                            const targetPath = "/app/user-profile";
                                            const baseUrl = window.location.origin;
                                            const isLocal = true;
                                            const source =
                                              "window.location.origin(trial_hardcode)";

                                            console.log(
                                              "Trial retry resend: supabase.auth.resend emailRedirectTo (exact):",
                                              redirectUrl,
                                              {
                                                flow: "frontend_trial_supabase_resend",
                                                origin: window.location.origin,
                                                hostname: window.location.hostname,
                                                env: import.meta.env.DEV ? "dev" : "prod",
                                                isLocal,
                                                VITE_WEB_BASE_URL: import.meta.env.VITE_WEB_BASE_URL,
                                                WEB_BASE_URL: import.meta.env.VITE_WEB_BASE_URL,
                                                APP_URL: undefined,
                                                targetPath,
                                                baseUrlResolved: baseUrl,
                                                baseUrlSource: source,
                                              },
                                            );

                                            await supabase.auth.resend({
                                              type: "signup",
                                              email,
                                              options: {
                                                emailRedirectTo: redirectUrl,
                                              },
                                            });
                                            toast.success("Sent!");
                                          },
                                        },
                                      },
                                    );
                                    setTrialDetailsLoading(false);
                                    return;
                                  }
                                  throw error;
                                }
                              }

                              try {
                                const { api } = await import("@/lib/api");

                                console.log("Initializing profile...");
                                await api.initProfile();

                                console.log(
                                  "Updating profile with emergency contact:",
                                  trialContact,
                                );
                                await api.updateProfile({
                                  emergency_contact_name: trialContact.name,
                                  emergency_contact_phone: trialContact.phone,
                                  emergency_contact_relationship: trialContact.relationship,
                                });

                                console.log("Profile updated successfully");
                                await api.billing.createSubscription({
                                  plan_type: "trial",
                                  billing_cycle: "monthly",
                                });
                              } catch (subErr) {
                                console.error("Post-signup setup error:", subErr);
                              }

                              navigate("/app/dashboard");
                            } catch (err: any) {
                              toast.error(err.message || "Failed to start session");
                            } finally {
                              setTrialDetailsLoading(false);
                            }
                          }}
                        >
                          {trialDetailsLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                              Setting up your account…
                            </>
                          ) : (
                            <>
                              Start Your First Session
                              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}

                  {phase === "form" && (
                    <p className="mt-7 text-center text-[14px] text-violet-200/65">
                      Already have an account?{" "}
                      <Link
                        to="/login"
                        className="font-medium text-[#f472b8] transition-colors hover:text-[#fbcfe8]"
                      >
                        Log in
                      </Link>
                    </p>
                  )}

                  {phase === "form" && (
                    <p className="mt-6 text-center text-[11px] leading-relaxed text-violet-200/42">
                      By signing up, you agree to our{" "}
                      <Link
                        to="/terms"
                        className="text-[#f472b8]/95 hover:text-[#fbcfe8]"
                      >
                        Terms &amp; Conditions
                      </Link>{" "}
                      and{" "}
                      <Link
                        to="/privacy"
                        className="text-[#f472b8]/95 hover:text-[#fbcfe8]"
                      >
                        Privacy Policy
                      </Link>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
