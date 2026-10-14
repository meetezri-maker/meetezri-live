import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * EVERY VOICE DEMO THE UI ASKS FOR MUST EXIST ON DISK.
 *
 * On 2026-10-14 the preview clips were replaced: four `.wav` files became four
 * `.mp3`s numbered within each gender. Both consumers kept requesting the old
 * names, and nothing caught it — because a missing file under `public/` is NOT
 * a 404. The SPA rewrite answers it with `index.html` at HTTP 200 and
 * `text/html`, the media element fails to demux that, and the only symptom is
 * a toast saying "Could not play voice preview".
 *
 * This reads the filenames straight out of the two components that build the
 * URL and checks each one against `public/avatarvoices/`, so the next rename
 * fails here instead of in front of a member.
 */

const WEB = resolve(__dirname, "../../..");
const VOICE_DIR = resolve(WEB, "public/avatarvoices");

const CONSUMERS = [
  "src/app/pages/app/SessionLobby.tsx",
  "src/app/pages/app/ChangeAvatar.tsx",
] as const;

/** Every `*.mp3` / `*.wav` literal in a file that builds an `avatarvoices` URL. */
function demoFilesIn(relativePath: string): string[] {
  const source = readFileSync(resolve(WEB, relativePath), "utf8");
  const matches = source.matchAll(/"([A-Za-z0-9._-]+\.(?:mp3|wav|ogg|m4a))"/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

describe("voice preview assets", () => {
  it.each(CONSUMERS)("%s references at least one demo clip", (file) => {
    expect(demoFilesIn(file).length).toBeGreaterThan(0);
  });

  it.each(CONSUMERS)("every demo clip %s requests exists in public/avatarvoices", (file) => {
    const missing = demoFilesIn(file).filter((name) => !existsSync(resolve(VOICE_DIR, name)));
    expect(missing, `missing from public/avatarvoices: ${missing.join(", ")}`).toEqual([]);
  });

  /**
   * The lobby offers two voices per category, so both of each must be present —
   * otherwise a filtered list would show an option that cannot be previewed.
   */
  it.each([
    "voice1female.mp3",
    "voice2female.mp3",
    "voice1male.mp3",
    "voice2male.mp3",
  ])("the delivered clip %s is present", (name) => {
    expect(existsSync(resolve(VOICE_DIR, name))).toBe(true);
  });

  /** The removed names must not creep back into either consumer. */
  it.each(CONSUMERS)("%s no longer references the retired .wav clips", (file) => {
    const retired = demoFilesIn(file).filter((name) => name.endsWith(".wav"));
    expect(retired, `retired clips still referenced: ${retired.join(", ")}`).toEqual([]);
  });
});
