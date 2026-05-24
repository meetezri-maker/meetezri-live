/**
 * Brand mark used across the app.
 * - Custom logo from admin branding (localStorage "ezri_branding") overrides defaults.
 * - Static assets: `logo black.png` = white wordmark for dark backgrounds;
 *   `logo white.png` = dark wordmark for light backgrounds (filenames are legacy).
 */
import { useState, useEffect } from "react";

const LS_KEY = "ezri_branding";

/** White/light wordmark — use on dark pages (login, signup, onboarding, app shell). */
export const BRAND_LOGO_ON_DARK_BG = "/logos/logo black.png";

/** Dark wordmark — use on light pages (marketing nav on white, admin). */
export const BRAND_LOGO_ON_LIGHT_BG = "/logos/logo white.png";

function readCustomLogoUrl(): string {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { branding?: { logoUrl?: string } };
    return parsed.branding?.logoUrl ?? "";
  } catch {
    return "";
  }
}

export type BrandLogoVariant = "onDark" | "onLight";

interface BrandLogoProps {
  heightClass?: string;
  className?: string;
  /** `onDark` = light wordmark on dark backgrounds; `onLight` = dark wordmark on light backgrounds */
  variant?: BrandLogoVariant;
}

export function BrandLogo({
  heightClass = "h-24",
  className = "",
  variant = "onLight",
}: BrandLogoProps) {
  const [customLogoUrl, setCustomLogoUrl] = useState<string>("");

  useEffect(() => {
    setCustomLogoUrl(readCustomLogoUrl());

    const handleUpdate = () => setCustomLogoUrl(readCustomLogoUrl());
    window.addEventListener("ezri-branding-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("ezri-branding-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const defaultSrc =
    variant === "onDark" ? BRAND_LOGO_ON_DARK_BG : BRAND_LOGO_ON_LIGHT_BG;
  const logoSrc = customLogoUrl || defaultSrc;

  return (
    <span
      role="img"
      aria-label={customLogoUrl ? "App Logo" : "MeetEzri"}
      className={`inline-flex shrink-0 items-center justify-center overflow-visible ${heightClass} ${className}`}
    >
      <img
        src={logoSrc}
        alt=""
        className="h-[130%] w-auto max-h-none object-contain object-center"
      />
    </span>
  );
}
