/**
 * Brand mark used across the app.
 * - If the admin has uploaded a custom logo via /admin/branding-customization,
 *   that logo (stored in localStorage "ezri_branding") is shown for all themes.
 * - Otherwise falls back to the static white logo in public/logos.
 */
import { useState, useEffect } from "react";

const LS_KEY = "ezri_branding";
const DEFAULT_LOGO_SRC = "/logos/logo black.png";

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

interface BrandLogoProps {
  heightClass?: string;
  className?: string;
  /** `light` = white mark for dark backgrounds; `dark` = default black mark */
  variant?: "light" | "dark";
}

export function BrandLogo({
  heightClass = "h-24",
  className = "",
  variant = "dark",
}: BrandLogoProps) {
  const [customLogoUrl, setCustomLogoUrl] = useState<string>("");

  useEffect(() => {
    // Read on mount
    setCustomLogoUrl(readCustomLogoUrl());

    // React to branding updates from the admin page (same tab)
    const handleUpdate = () => setCustomLogoUrl(readCustomLogoUrl());
    window.addEventListener("ezri-branding-updated", handleUpdate);
    // React to updates from other tabs
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("ezri-branding-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const defaultSrc =
    variant === "light" ? "/logos/logo white.png" : DEFAULT_LOGO_SRC;
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
