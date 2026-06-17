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

type DocumentTheme = "light" | "dark";

function readDocumentTheme(): DocumentTheme {
  if (typeof document === "undefined") return "dark";
  const root = document.documentElement;
  if (
    root.getAttribute("data-ezri-theme") === "light" ||
    root.getAttribute("data-theme") === "light"
  ) {
    return "light";
  }
  return "dark";
}

interface BrandLogoProps {
  heightClass?: string;
  className?: string;
  /** `onDark` = light wordmark on dark backgrounds; `onLight` = dark wordmark on light backgrounds */
  variant?: BrandLogoVariant;
  /**
   * When true, logo follows `html[data-ezri-theme]` / `data-theme`:
   * light → `/logos/logo white.png`, dark → `/logos/logo black.png`.
   */
  themeAware?: boolean;
}

export function BrandLogo({
  heightClass = "h-24",
  className = "",
  variant = "onLight",
  themeAware = false,
}: BrandLogoProps) {
  const [customLogoUrl, setCustomLogoUrl] = useState<string>("");
  const [documentTheme, setDocumentTheme] = useState<DocumentTheme>(() =>
    themeAware ? readDocumentTheme() : "dark"
  );

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

  useEffect(() => {
    if (!themeAware || typeof document === "undefined") return;

    const sync = () => setDocumentTheme(readDocumentTheme());
    sync();

    const root = document.documentElement;
    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-ezri-theme", "data-theme"],
    });
    window.addEventListener("ezri-appearance-change", sync);

    return () => {
      observer.disconnect();
      window.removeEventListener("ezri-appearance-change", sync);
    };
  }, [themeAware]);

  const resolvedVariant: BrandLogoVariant = themeAware
    ? documentTheme === "light"
      ? "onLight"
      : "onDark"
    : variant;

  const defaultSrc =
    resolvedVariant === "onDark" ? BRAND_LOGO_ON_DARK_BG : BRAND_LOGO_ON_LIGHT_BG;
  const logoSrc = customLogoUrl || defaultSrc;

  return (
    <span
      role="img"
      aria-label={customLogoUrl ? "App Logo" : "Solace"}
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
