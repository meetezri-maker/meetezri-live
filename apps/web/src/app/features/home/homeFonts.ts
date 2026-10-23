import { useEffect } from "react";

/**
 * The homepage design's typefaces, loaded with the same families and weights the design used.
 *
 * The page is served by the SPA (`/landing-page`), whose document only links the site fonts, so
 * `useHomeFonts` adds this stylesheet when the page mounts.
 */
export const HOME_FONT_STYLESHEET_URL =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600&family=Inter:wght@400;500;600;700&family=Montserrat:wght@400;500;600&display=swap";

export const HOME_FONT_LINK_ATTRIBUTE = "data-solace-home-fonts";

export function useHomeFonts(): void {
  useEffect(() => {
    if (document.head.querySelector(`link[${HOME_FONT_LINK_ATTRIBUTE}]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = HOME_FONT_STYLESHEET_URL;
    link.setAttribute(HOME_FONT_LINK_ATTRIBUTE, "true");
    document.head.appendChild(link);
  }, []);
}
