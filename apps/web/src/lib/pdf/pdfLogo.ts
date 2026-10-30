import { PUBLIC_BRAND_LOGO_ON_LIGHT_PATH } from "@meetezri/public-content";

// ---------------------------------------------------------------------------------------------
// Logo (optional — never blocks generation). Moved unchanged from the Goals PDF exporter.
// ---------------------------------------------------------------------------------------------

export interface LogoImage {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * The dark Solace wordmark for white pages ("logo white.png"), 9 mm high at its own aspect ratio.
 * Always the bundled brand asset — never the admin custom-logo override.
 */
export async function loadLogo(): Promise<LogoImage | null> {
  try {
    if (typeof fetch !== "function" || typeof FileReader === "undefined") return null;
    const res = await fetch(PUBLIC_BRAND_LOGO_ON_LIGHT_PATH);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("logo read failed"));
      reader.readAsDataURL(blob);
    });
    if (!dataUrl.startsWith("data:image")) return null;
    const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
      if (typeof Image === "undefined") return resolve(null);
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
    const height = 9;
    const ratio = dims && dims.h > 0 ? dims.w / dims.h : 2.6;
    return { dataUrl, width: Math.min(height * ratio, 42), height };
  } catch {
    return null;
  }
}
