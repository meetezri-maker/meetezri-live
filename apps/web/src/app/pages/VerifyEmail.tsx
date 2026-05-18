import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Mail, Menu, X } from "lucide-react";
import { motion } from "motion/react";
import { BrandLogo } from "../components/BrandLogo";
import { cn } from "@/lib/utils";

const VERIFY_HERO_BG = "/solace/login-cinematic-lock.png";
const VERIFY_NAV_H = "72px";

interface SolaceVerifyNavProps {
  className?: string;
}

function SolaceVerifyNav({ className }: SolaceVerifyNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className={cn(
        "relative z-50 shrink-0 border-b border-white/[0.08] bg-[#070815]/75 backdrop-blur-2xl",
        "shadow-[inset_0_-1px_0_rgba(233,30,99,0.14)] supports-[backdrop-filter]:bg-[#070815]/55",
        className,
      )}
      style={{ height: VERIFY_NAV_H }}
    >
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#E91E63]/20 to-transparent"
        aria-hidden
        animate={{ opacity: [0.35, 0.65, 0.35] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="relative flex h-full w-full items-center justify-between gap-4 px-5 sm:px-8 lg:px-10"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <Link to="/" className="relative z-10 flex shrink-0 items-center">
          <BrandLogo heightClass="h-10" />
        </Link>

        <nav
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 text-[14px] font-normal tracking-wide text-violet-100/78 md:flex"
          aria-label="Primary"
        >
          <Link to="/how-it-works" className="transition-colors hover:text-white/95">
            How It Works
          </Link>
          <Link to="/pricing" className="transition-colors hover:text-white/95">
            Pricing
          </Link>
          <Link to="/privacy" className="transition-colors hover:text-white/95">
            Privacy &amp; Safety
          </Link>
        </nav>

        <motion.div
          className="relative z-10 hidden items-center gap-5 sm:flex"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
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
        </motion.div>

        <button
          type="button"
          className="relative z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/90 sm:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="solace-verify-mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </motion.div>

      {open ? (
        <div
          id="solace-verify-mobile-nav"
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

function VerifyEmailCinematicBackdrop() {
  const particles = useMemo(() => [...Array(8)].map((_, i) => i), []);

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#05040a]"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <img
        src={VERIFY_HERO_BG}
        alt=""
        className="absolute inset-0 h-full w-full scale-[1.02] object-cover"
        style={{ objectPosition: "center bottom" }}
      />

      <motion.div
        className="absolute inset-0 bg-[#0a0b1e]/72"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7 }}
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#0a0818]/88 via-[#12051f]/45 to-[#07040d]/92"
        aria-hidden
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_38%,rgba(168,85,247,0.18),transparent_62%)]"
        animate={{ opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_72%_18%,rgba(233,30,99,0.12),transparent_55%)]"
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(5,4,12,0.55)_100%)]"
        aria-hidden
      />

      <div
        className="solace-login-water-shimmer pointer-events-none absolute inset-x-[-20%] bottom-0 h-[42%] bg-gradient-to-t from-orange-400/[0.07] via-fuchsia-500/[0.04] to-transparent mix-blend-screen"
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute inset-x-[-10%] bottom-[-8%] h-[52%] bg-[radial-gradient(ellipse_at_50%_100%,rgba(125,74,218,0.22),transparent_58%)] blur-3xl"
        animate={{ opacity: [0.65, 0.95, 0.65] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="pointer-events-none absolute left-[8%] top-[14%] h-px w-px rounded-full bg-white/90 opacity-95 shadow-[2px_14px_0_0_rgba(255,255,255,0.85),118px_32px_0_0_rgba(255,255,255,0.35),212px_-10px_0_0_rgba(255,255,255,0.45),286px_24px_0_0_rgba(255,255,255,0.25),356px_-6px_0_0_rgba(255,255,255,0.4)]" />

      <div className="pointer-events-none absolute inset-x-0 bottom-[-2%] h-[52%]" aria-hidden>
        <motion.div
          className="solace-login-lantern-breathe absolute bottom-[10%] left-[calc(42%-72px)] h-28 w-24"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="absolute bottom-10 left-1/2 flex h-[120px] w-[120px] -translate-x-1/2 items-end justify-center"
            animate={{ opacity: [0.88, 1, 0.88] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div
              className="absolute bottom-[84px] left-1/2 h-16 w-16 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,193,7,0.95)_12%,rgba(255,154,71,0.55)_42%,transparent_68%)] opacity-92 blur-[0.5px] mix-blend-screen"
              animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute bottom-[52px] h-8 w-[56px] rounded-t-full bg-gradient-to-b from-amber-200/55 to-amber-500/85 shadow-[inset_0_-4px_10px_rgba(0,0,0,0.35)]"
              animate={{ opacity: [0.9, 1, 0.9] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="absolute bottom-0 h-[78px] w-[58px] rounded-sm bg-gradient-to-b from-orange-950/94 via-orange-950/92 to-orange-950/88 shadow-[0_26px_50px_-8px_rgba(0,0,0,0.65)] outline outline-1 outline-amber-400/35" />
          </motion.div>
          <div className="absolute bottom-[4%] left-[42%] h-24 w-[min(560px,80vw)] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(ellipse_at_50%_50%,rgba(255,173,74,0.35),transparent_62%)] mix-blend-screen blur-md" />
        </motion.div>

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
    </motion.div>
  );
}

interface VerifyEmailIconProps {
  className?: string;
}

function VerifyEmailIcon({ className }: VerifyEmailIconProps) {
  return (
    <div className={cn("relative mx-auto mb-8 flex h-[120px] w-[120px] items-center justify-center", className)}>
      <motion.div
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(233,30,99,0.35)_0%,rgba(168,85,247,0.18)_45%,transparent_70%)] blur-md"
        animate={{ opacity: [0.55, 0.9, 0.55], scale: [1, 1.05, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <motion.div
        className="absolute inset-[6px] rounded-full border border-[#E91E63]/25 bg-[radial-gradient(circle_at_50%_35%,rgba(233,30,99,0.22),rgba(99,59,188,0.12)_55%,transparent_72%)] shadow-[0_0_48px_-8px_rgba(233,30,99,0.55),inset_0_0_32px_rgba(168,85,247,0.15)]"
        animate={{ opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        aria-hidden
      />
      <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full border border-white/[0.1] bg-[#0c0e18]/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_32px_-6px_rgba(168,85,247,0.45)] backdrop-blur-sm">
        <Mail className="h-9 w-9 text-[#f9a8d4] drop-shadow-[0_0_18px_rgba(233,30,99,0.45)]" strokeWidth={1.35} aria-hidden />
      </div>
    </div>
  );
}

interface VerifyNextStepsPanelProps {
  className?: string;
}

function VerifyNextStepsPanel({ className }: VerifyNextStepsPanelProps) {
  const steps = [
    "Open the email from Solace",
    "Click the verification link",
    "Return here to log in",
  ] as const;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px] border border-[#9C27B0]/22 bg-gradient-to-br from-[#1a0a28]/75 via-[#12051f]/65 to-[#0c0e18]/80 px-5 py-5 text-left backdrop-blur-xl",
        "shadow-[0_0_0_1px_rgba(168,85,247,0.1),0_0_40px_-12px_rgba(168,85,247,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]",
        className,
      )}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-[22px] bg-gradient-to-br from-[#E91E63]/[0.06] via-transparent to-[#633BBC]/[0.08] opacity-80"
        aria-hidden
        animate={{ opacity: [0.45, 0.75, 0.45] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="relative flex gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <CheckCircle2
          className="mt-0.5 h-5 w-5 shrink-0 text-[#e879f9] drop-shadow-[0_0_10px_rgba(168,85,247,0.45)]"
          aria-hidden
        />
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08, delayChildren: 0.38 } },
          }}
        >
          <p className="text-[14px] font-medium text-white/92">Next steps:</p>
          <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-white/[0.72]">
            {steps.map((step) => (
              <motion.li
                key={step}
                className="flex gap-2.5"
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
                }}
              >
                <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-[#f472b8]/80 shadow-[0_0_8px_rgba(233,30,99,0.55)]" aria-hidden />
                <span>{step}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </motion.div>
    </div>
  );
}

export function VerifyEmail() {
  return (
    <motion.div
      className="solace-login-page flex min-h-screen flex-col overflow-x-hidden bg-[#0a0b1e] text-[#f4f4f8]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <SolaceVerifyNav />

      <main className="relative flex flex-1 flex-col">
        <VerifyEmailCinematicBackdrop />

        <div className="relative z-[1] flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
          <motion.div
            className="relative w-[92%] max-w-[560px]"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="pointer-events-none absolute -inset-4 rounded-[40px] bg-[radial-gradient(ellipse_at_50%_0%,rgba(168,85,247,0.22),transparent_65%)] blur-2xl"
              animate={{ opacity: [0.4, 0.65, 0.4] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            />

            <article
              className={cn(
                "relative overflow-hidden rounded-[32px] border border-white/[0.06] bg-[#0c0e18]/78 px-8 py-10 backdrop-blur-2xl sm:px-12 sm:py-14",
                "shadow-[0_0_0_1px_rgba(168,85,247,0.1),0_0_80px_-24px_rgba(168,85,247,0.38),0_48px_120px_-48px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.06)]",
              )}
            >
              <motion.div
                className="pointer-events-none absolute inset-0 rounded-[32px] bg-gradient-to-br from-[#E91E63]/[0.06] via-transparent to-[#633BBC]/[0.1]"
                aria-hidden
                animate={{ opacity: [0.5, 0.85, 0.5] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                aria-hidden
                animate={{ opacity: [0.25, 0.55, 0.25] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              />

              <motion.div
                className="relative text-center"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                <VerifyEmailIcon />

                <h1 className="text-[clamp(1.65rem,4vw,2rem)] font-semibold tracking-tight text-white/96">
                  Check your email
                </h1>
                <p className="mx-auto mt-4 max-w-[420px] text-[15px] leading-relaxed text-white/[0.72]">
                  We&apos;ve sent a verification link to your email address. Please click the link
                  to verify your account and get started.
                </p>

                <div className="mt-8 space-y-6">
                  <VerifyNextStepsPanel className="relative" />

                  <Link to="/login" className="block">
                    <motion.span
                      className={cn(
                        "group flex h-[60px] w-full items-center justify-center gap-2 rounded-[18px]",
                        "bg-gradient-to-r from-[#D42680] via-[#E91E63] to-[#633BBC] text-[15px] font-medium text-white",
                        "shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_40px_-8px_rgba(233,30,99,0.65),0_16px_48px_-16px_rgba(99,59,188,0.55)]",
                        "transition-[box-shadow,transform] duration-300",
                        "hover:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_0_56px_-4px_rgba(233,30,99,0.75),0_20px_56px_-12px_rgba(99,59,188,0.65)]",
                        "hover:-translate-y-0.5 active:translate-y-0",
                      )}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      Back to Login
                      <ArrowRight
                        className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </motion.span>
                  </Link>

                  <p className="text-center text-[12px] leading-relaxed text-white/[0.52] sm:text-[13px]">
                    Didn&apos;t receive the email? Check your spam folder or{" "}
                    <Link
                      to="/signup"
                      className="font-medium text-[#e879f9] transition-colors hover:text-[#f9a8d4] hover:underline"
                    >
                      try signing up again
                    </Link>{" "}
                    with a different email.
                  </p>
                </div>
              </motion.div>
            </article>
          </motion.div>
        </div>
      </main>
    </motion.div>
  );
}
