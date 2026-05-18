import { Link, useLocation } from "react-router";
import { Button } from "./ui/button";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function CinematicNavLink({
  to,
  children,
  isActive,
  onClick,
}: {
  to: string;
  children: ReactNode;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "relative pb-1 transition-colors",
        isActive ? "text-white" : "hover:text-white/95",
      )}
    >
      {children}
      {isActive ? (
        <span
          className="absolute -bottom-0.5 left-0 right-0 h-px bg-gradient-to-r from-[#E91E63] via-fuchsia-400 to-[#9C27B0] shadow-[0_0_14px_rgba(233,30,99,0.65)]"
          aria-hidden
        />
      ) : null}
    </Link>
  );
}

export interface PublicNavProps {
  variant?: "default" | "cinematic";
}

export function PublicNav({ variant = "default" }: PublicNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const isCinematic = variant === "cinematic";

  if (isCinematic) {
    return (
      <header
        className={cn(
          "relative z-50 border-b border-white/[0.08] bg-[#070815]/75 backdrop-blur-2xl",
          "shadow-[inset_0_-1px_0_rgba(233,30,99,0.14)] supports-[backdrop-filter]:bg-[#070815]/55",
        )}
      >
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="relative z-10 flex shrink-0 items-center">
            <BrandLogo heightClass="h-10" />
          </Link>

          <nav
            className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 text-sm font-normal tracking-wide text-violet-100/78 md:flex"
            aria-label="Primary"
          >
            <CinematicNavLink to="/how-it-works" isActive={pathname === "/how-it-works"}>
              How It Works
            </CinematicNavLink>
            <CinematicNavLink to="/pricing" isActive={pathname === "/pricing"}>
              Pricing
            </CinematicNavLink>
            <CinematicNavLink to="/privacy" isActive={pathname === "/privacy"}>
              Privacy &amp; Safety
            </CinematicNavLink>
          </nav>

          <div className="relative z-10 hidden items-center gap-5 sm:flex">
            <Link
              to="/login"
              className="text-sm text-violet-100/78 transition-colors hover:text-white"
            >
              Log In
            </Link>
            <Link
              to="/#pricing"
              className="landing-cta-glow rounded-full bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-6 py-2.5 text-[13px] font-medium text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Get Started
            </Link>
          </div>

          <button
            type="button"
            className="relative z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/90 sm:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-white/[0.06] bg-[#070812]/90 px-4 py-4 backdrop-blur-xl sm:hidden">
            <nav className="flex flex-col gap-3 text-sm text-violet-100/85">
              <Link to="/how-it-works" onClick={() => setMobileMenuOpen(false)}>
                How It Works
              </Link>
              <Link to="/pricing" onClick={() => setMobileMenuOpen(false)}>
                Pricing
              </Link>
              <Link to="/privacy" onClick={() => setMobileMenuOpen(false)}>
                Privacy &amp; Safety
              </Link>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                Log In
              </Link>
              <Link
                to="/#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-6 py-2.5 text-center text-sm font-medium text-white"
              >
                Get Started
              </Link>
            </nav>
          </div>
        ) : null}
      </header>
    );
  }

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100 }}
      className="sticky top-0 z-50 border-b border-border bg-white/80 backdrop-blur-md"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center"
            >
              <BrandLogo heightClass="h-10" />
            </motion.div>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <Link
              to="/how-it-works"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              How It Works
            </Link>
            <Link
              to="/pricing"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              to="/privacy"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Privacy & Safety
            </Link>
          </div>

          <motion.div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 sm:flex">
              <Link to="/login">
                <Button variant="ghost">Log In</Button>
              </Link>
              <Link to="/#pricing">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button>Get Started</Button>
                </motion.div>
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 md:hidden"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              <Menu className="h-6 w-6" />
            </button>
          </motion.div>
        </div>

        {mobileMenuOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 py-4 md:hidden"
          >
            <Link
              to="/how-it-works"
              className="block py-2 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              How It Works
            </Link>
            <Link
              to="/pricing"
              className="block py-2 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link
              to="/privacy"
              className="block py-2 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Privacy & Safety
            </Link>
            <div className="space-y-2 pt-2">
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full">
                  Log In
                </Button>
              </Link>
              <Link to="/#pricing" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full">Get Started</Button>
              </Link>
            </div>
          </motion.div>
        ) : null}
      </div>
    </motion.nav>
  );
}
