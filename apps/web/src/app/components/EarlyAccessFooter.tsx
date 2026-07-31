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

export function EarlyAccessFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#04060f]/90">
      <div className="landing-section py-10 md:py-12">
        <div className="mt-0 text-center text-xs text-[var(--solace-ds-text-muted)] sm:text-sm">
          <p>&copy; {PUBLIC_FOOTER_COPYRIGHT_YEAR} Solace. All rights reserved.</p>
          <p className="mt-1.5">
            This is not a replacement for professional medical or mental health services.
          </p>
        </div>
      </div>
    </footer>
  );
}
