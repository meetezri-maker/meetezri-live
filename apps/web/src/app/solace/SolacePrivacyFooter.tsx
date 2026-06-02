import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  solaceCinematicBanner,
  solaceCinematicBannerBody,
  solaceCinematicBannerContent,
  solaceCinematicBannerIcon,
  solaceCinematicBannerLink,
  solaceCinematicBannerOverlay,
  solaceCinematicBannerTitle,
  solaceHeroImage,
} from "@/app/solace/solacePageChrome";

const PRIVACY_BANNER_IMG = "/community/hero-lake.jpg";

export interface SolacePrivacyFooterProps {
  className?: string;
  privacyHref?: string;
}

export function SolacePrivacyFooter({ className, privacyHref = "/privacy" }: SolacePrivacyFooterProps) {
  return (
    <footer className={cn(solaceCinematicBanner, className)}>
      <img
        src={PRIVACY_BANNER_IMG}
        alt=""
        className={solaceHeroImage}
        width={900}
        height={600}
        loading="lazy"
        decoding="async"
      />
      <div className={solaceCinematicBannerOverlay} aria-hidden />
      <div className={solaceCinematicBannerContent}>
        <div className={solaceCinematicBannerIcon}>
          <Lock aria-hidden />
        </div>
        <div className="min-w-0">
          <p className={solaceCinematicBannerTitle}>Your privacy and peace of mind are our priority.</p>
          <p className={solaceCinematicBannerBody}>
            Your data is encrypted, secure, and never shared.{" "}
            <Link to={privacyHref} className={solaceCinematicBannerLink}>
              Read our Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
