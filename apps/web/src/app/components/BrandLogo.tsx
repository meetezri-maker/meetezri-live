/**
 * Theme-aware brand mark.
 * - If the admin has uploaded a custom logo via /admin/branding-customization,
 *   that logo (stored in localStorage "ezri_branding") is shown for all themes.
 * - Otherwise falls back to the static light/dark logo files.
 */
import { useState, useEffect } from "react";

const LS_KEY = "ezri_branding";

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

export function BrandLogo({
  heightClass = "h-24",
  className = "",
}: {
  heightClass?: string;
  className?: string;
}) {
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

  if (customLogoUrl) {
    return (
      <span
        role="img"
        aria-label="App Logo"
        className={`inline-flex shrink-0 items-center justify-center overflow-visible ${heightClass} ${className}`}
      >
        <img
          src={customLogoUrl}
          alt=""
          className="h-[130%] w-auto max-h-none object-contain object-center"
        />
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label="MeetEzri"
      className={`inline-flex shrink-0 items-center justify-center overflow-visible ${heightClass} ${className}`}
    >
      <img
        src="/logos/logo white.png"
        alt=""
        className="h-[130%] w-auto max-h-none object-contain object-center dark:hidden"
      />
      <img
        src="/logos/logo black.png"
        alt=""
        className="hidden h-[130%] w-auto max-h-none object-contain object-center dark:block"
      />
    </span>
  );
}
