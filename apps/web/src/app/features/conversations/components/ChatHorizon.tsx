import { getVitePublicBaseUrl } from "@/lib/avatar/avatarModelUrl";

/**
 * Purple/pink horizon behind the chat — reuses the existing approved Solace twilight-lake artwork
 * (`public/solace/onboarding-complete-twilight-lake-*`) under a readability scrim, matching the
 * sunset/mountain aesthetic of the Conversations references. Decorative only.
 */
export function ChatHorizon() {
  const base = `${getVitePublicBaseUrl()}solace/onboarding-complete-twilight-lake`;
  const widths = [480, 768, 1024, 1536];
  const srcSet = (ext: string) => widths.map((w) => `${base}-${w}.${ext} ${w}w`).join(", ");
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <picture>
        <source type="image/avif" srcSet={srcSet("avif")} sizes="(min-width: 1024px) 60vw, 100vw" />
        <source type="image/webp" srcSet={srcSet("webp")} sizes="(min-width: 1024px) 60vw, 100vw" />
        <img
          src={`${base}.jpg`}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-[50%_40%] opacity-70 [html[data-ezri-theme=light]_&]:opacity-35"
        />
      </picture>
      {/* Readability scrim: darker at the top (header) and bottom (composer). */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,10,46,0.82)_0%,rgba(38,16,82,0.45)_38%,rgba(46,16,90,0.4)_65%,rgba(24,10,52,0.78)_100%)] [html[data-ezri-theme=light]_&]:bg-[linear-gradient(180deg,rgba(250,247,255,0.92)_0%,rgba(243,236,255,0.6)_40%,rgba(246,238,255,0.55)_65%,rgba(250,247,255,0.92)_100%)]" />
    </div>
  );
}
