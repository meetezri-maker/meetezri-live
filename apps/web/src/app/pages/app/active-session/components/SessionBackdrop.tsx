import { memo, useMemo } from "react";
import type {
  SessionBackdropLayers,
  SessionBackdropPreference,
} from "@/lib/sessionBackdropPresets";
import { resolveSessionMoodSwatchGradient } from "@/lib/sessionBackdropPresets";

export interface SessionBackdropProps {
  sessionBackdropLayers: SessionBackdropLayers;
  sessionBackdropPreference: SessionBackdropPreference;
  latestMoodSlug: string | null;
}

/** Static mood atmosphere layers (z-0). */
export const SessionBackdrop = memo(function SessionBackdrop({
  sessionBackdropLayers,
  sessionBackdropPreference,
  latestMoodSlug,
}: SessionBackdropProps) {
  const moodSwatchGradient = useMemo(
    () =>
      resolveSessionMoodSwatchGradient(
        sessionBackdropPreference,
        latestMoodSlug,
      ),
    [sessionBackdropPreference, latestMoodSlug],
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 min-h-full w-full transition-[background] duration-700 ease-out"
      style={{ background: moodSwatchGradient }}
      aria-hidden
    >
      <div
        className="absolute inset-0 transition-[background-color,opacity] duration-700 ease-out"
        style={{ backgroundColor: sessionBackdropLayers.rootBg, opacity: 0.42 }}
      />
      <div
        className="absolute inset-0 transition-[background-image,opacity] duration-700 ease-out"
        style={{
          backgroundImage: sessionBackdropLayers.radialPrimary,
          opacity: 0.72,
        }}
      />
      <div
        className="absolute inset-0 transition-[background-image,opacity] duration-700 ease-out"
        style={{
          backgroundImage: sessionBackdropLayers.radialFloor,
          opacity: 0.85,
        }}
      />
      <div
        className="absolute inset-0 transition-[background-image,opacity] duration-700 ease-out"
        style={{
          backgroundImage: sessionBackdropLayers.linearAccent,
          opacity: 0.9,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.045] mix-blend-soft-light"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.35' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
});
