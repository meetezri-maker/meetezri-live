import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRODUCT_SCREENS, type ProductScreenId } from "./prelaunch.imagery";

const ROTATE_INTERVAL_MS = 5000;

export interface ProductPreviewCarouselProps {
  /**
   * Screen highlighted by a hovered feature card. When set, the carousel shows
   * that screen and pauses its own rotation.
   */
  activeScreenId?: ProductScreenId | null;
  /** Restrict the rotation to a subset, in the given order. */
  screenIds?: readonly ProductScreenId[];
  showCaption?: boolean;
  className?: string;
  label: string;
}

/**
 * Device-framed preview of real Solace screens.
 *
 * Rotation pauses when off-screen, while the visitor interacts, and under
 * `prefers-reduced-motion`. Screens without an approved screenshot render a
 * labelled placeholder — no fabricated UI is ever shown.
 */
export function ProductPreviewCarousel({
  activeScreenId = null,
  screenIds,
  showCaption = true,
  className,
  label,
}: ProductPreviewCarouselProps) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  const screens = screenIds
    ? screenIds
        .map((id) => PRODUCT_SCREENS.find((screen) => screen.id === id))
        .filter((screen): screen is (typeof PRODUCT_SCREENS)[number] => Boolean(screen))
    : PRODUCT_SCREENS;

  // Only animate while the carousel is actually on screen.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const pinnedIndex = activeScreenId
    ? screens.findIndex((screen) => screen.id === activeScreenId)
    : -1;
  const isPinned = pinnedIndex >= 0;

  useEffect(() => {
    if (isPinned || isInteracting || reduceMotion || !isVisible) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % screens.length);
    }, ROTATE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isPinned, isInteracting, reduceMotion, isVisible, screens.length]);

  const activeIndex = isPinned ? pinnedIndex : index % screens.length;
  const activeScreen = screens[activeIndex];

  if (!activeScreen) return null;

  return (
    <div
      ref={containerRef}
      className={cn("flex w-full flex-col gap-4", className)}
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onFocusCapture={() => setIsInteracting(true)}
      onBlurCapture={() => setIsInteracting(false)}
    >
      <div
        className="landing-glass landing-glow-purple relative w-full overflow-hidden"
        role="group"
        aria-roledescription="carousel"
        aria-label={label}
      >
        {/* 16:10 frame reserves the space before the image loads, so nothing shifts. */}
        <div className="relative aspect-[16/10] w-full">
          {screens.map((screen, screenIndex) => (
            <div
              key={screen.id}
              className={cn(
                "absolute inset-0 transition-opacity duration-700",
                screenIndex === activeIndex ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              aria-hidden={screenIndex !== activeIndex}
            >
              {screen.src ? (
                <img
                  src={screen.src}
                  alt={`Solace ${screen.label} screen`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <PendingScreenPlaceholder label={screen.label} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2" role="tablist" aria-label={`${label} screens`}>
        {screens.map((screen, screenIndex) => (
          <button
            key={screen.id}
            type="button"
            role="tab"
            aria-selected={screenIndex === activeIndex}
            aria-label={screen.label}
            onClick={() => setIndex(screenIndex)}
            className={cn(
              "h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300",
              screenIndex === activeIndex
                ? "w-6 bg-gradient-to-r from-[#E91E63] to-[#9C27B0]"
                : "w-2 bg-white/25 hover:bg-white/45",
            )}
          />
        ))}
      </div>

      {showCaption ? (
        <p
          className="min-h-[3rem] text-center text-sm leading-relaxed text-[var(--solace-ds-text-muted)]"
          aria-live="polite"
        >
          <span className="font-semibold text-white/90">{activeScreen.label}</span>
          <span className="mx-2 text-white/25" aria-hidden>
            •
          </span>
          {activeScreen.caption}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Placeholder for a screen whose approved screenshot has not been supplied yet.
 * Preserves the frame, ratio, and hierarchy without inventing product UI.
 */
function PendingScreenPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[linear-gradient(160deg,rgba(30,20,60,0.95),rgba(8,10,26,0.98))] px-6 text-center">
      <ImageOff className="h-7 w-7 text-white/30" aria-hidden />
      <p className="text-sm font-semibold text-white/75">{label}</p>
      <p className="max-w-xs text-xs leading-relaxed text-white/45">
        Approved product screenshot pending.
      </p>
    </div>
  );
}
