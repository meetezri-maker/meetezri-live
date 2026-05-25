import { Link } from "react-router";
import { Twitter, Instagram, Facebook, Youtube } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

const SOCIAL_LINKS = [
  { Icon: Twitter, label: "Twitter" },
  { Icon: Instagram, label: "Instagram" },
  { Icon: Facebook, label: "Facebook" },
  { Icon: Youtube, label: "YouTube" },
] as const;

export const PUBLIC_FOOTER_COPYRIGHT_YEAR = 2026;

export function PublicFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#04060f]/90">
      <div className="pointer-events-none mx-auto h-px max-w-7xl bg-gradient-to-r from-transparent via-violet-500/35 to-transparent" />
      <div className="landing-section py-10 md:py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <BrandLogo heightClass="h-14" themeAware />
            <p className="mt-3 text-sm text-[var(--solace-ds-text-muted)]">
              Your AI-powered wellness companion, available 24/7
            </p>
            <div className="mt-4 flex gap-2.5">
              {SOCIAL_LINKS.map(({ Icon, label }) => (
                <span
                  key={label}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/55"
                  aria-label={label}
                  role="img"
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">Product</h4>
            <ul className="space-y-1.5 text-sm text-[var(--solace-ds-text-muted)]">
              <li>
                <Link to="/how-it-works" className="hover:text-white">
                  How It Works
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-white">
                  Pricing
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-white">
                  Privacy & Safety
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">Legal</h4>
            <ul className="space-y-1.5 text-sm text-[var(--solace-ds-text-muted)]">
              <li>
                <Link to="/terms" className="hover:text-white">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-white">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">Get Started</h4>
            <ul className="space-y-1.5 text-sm text-[var(--solace-ds-text-muted)]">
              <li>
                <Link to="/signup" className="hover:text-white">
                  Sign Up
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white">
                  Log In
                </Link>
              </li>
              <li>
                <Link
                  to="/admin/credentials"
                  className="font-semibold text-violet-300 hover:text-violet-200"
                >
                  Admin Credentials
                </Link>
              </li>
              <li>
                <Link to="/admin/login" className="text-violet-300/90 hover:text-violet-200">
                  Admin Portal
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-white/[0.06] pt-6 text-center text-xs text-[var(--solace-ds-text-muted)] sm:text-sm">
          <p>&copy; {PUBLIC_FOOTER_COPYRIGHT_YEAR} Solace. All rights reserved.</p>
          <p className="mt-1.5">
            This is not a replacement for professional medical or mental health services.
          </p>
        </div>
      </div>
    </footer>
  );
}
