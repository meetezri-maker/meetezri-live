import { describe, expect, it } from "vitest";
import { hyper3dPhonemeToBlendshape } from "./engine/mappings/phonemeToBlendshape";
import { hyper3dMorphCalibration } from "./engine/mappings/avatars/hyper3dCalibration";
import type { BlendshapePose } from "./engine/types/facialAnimation";

/**
 * §3 / §6 — AUTHORED VALUE vs EFFECTIVE VALUE vs HEADROOM.
 *
 * The diagnosis needs to know not only what each phoneme renders but how much
 * room the asset still allows before a channel hits its own `naturalMax` — the
 * largest influence the calibration records as still reading as a real face.
 * Proposing a value above that would be proposing a caricature, and proposing
 * one above `cap` would be proposing nothing at all, since the cap silently
 * truncates it.
 *
 * Prints only. No production value is read by anything but this report.
 */

const definitionOf = (phoneme: string) =>
  (hyper3dPhonemeToBlendshape as unknown as Record<string, {
    pose: BlendshapePose;
    defaultIntensity: number;
  }>)[phoneme];

const FOCUS = [
  "AA", "AE", "AH", "AY", "AW", "AO",
  "IY", "EY", "EH", "IH",
  "UW", "OW", "UH", "ER", "OY",
  "R", "W", "SH", "ZH", "CH", "JH", "L", "Y", "HH"
];

describe("authored vs effective vs headroom", () => {
  it("prints the per-channel headroom for the phonemes under review", () => {
    const lines: string[] = [""];
    lines.push("=== AUTHORED x defaultIntensity x gain -> EFFECTIVE, against the asset's own limits ===");
    lines.push("(eff = authored x intensity x gain, capped. nat = naturalMax, the largest influence that reads as a real face)");
    for (const phoneme of FOCUS) {
      const definition = definitionOf(phoneme);
      if (!definition) continue;
      lines.push("");
      lines.push(`${phoneme}   defaultIntensity ${definition.defaultIntensity}`);
      for (const [name, authored] of Object.entries(definition.pose).sort((a, b) => b[1] - a[1])) {
        const entry = hyper3dMorphCalibration[name];
        const scaled = authored * definition.defaultIntensity;
        const effective = entry ? Math.min(scaled * entry.gain, entry.cap) : scaled;
        const capped = entry ? scaled * entry.gain > entry.cap : false;
        /**
         * The authored value that would land exactly on `naturalMax` — the
         * ceiling a proposal should be read against, not the cap.
         */
        const authoredAtNatural = entry
          ? entry.naturalMax / (entry.gain * definition.defaultIntensity)
          : Infinity;
        lines.push(
          `   ${name.padEnd(22)} auth ${authored.toFixed(3)}` +
          `  eff ${effective.toFixed(3)}` +
          `  gain ${(entry?.gain ?? 1).toFixed(2)}` +
          `  cap ${(entry?.cap ?? 1).toFixed(2)}` +
          `  nat ${(entry?.naturalMax ?? 1).toFixed(2)}` +
          `  mm ${((entry?.travelMM ?? 0) * effective).toFixed(2).padStart(6)}` +
          `  authored@nat ${authoredAtNatural === Infinity ? "-" : authoredAtNatural.toFixed(2)}` +
          (capped ? "   CAPPED" : "") +
          (entry && effective < entry.usefulMin ? "   BELOW usefulMin" : "")
        );
      }
    }

    lines.push("");
    lines.push("=== MOUTH CHANNELS NO PHONEME USES AT ALL ===");
    const used = new Set<string>();
    for (const phoneme of Object.keys(hyper3dPhonemeToBlendshape)) {
      const definition = definitionOf(phoneme);
      if (definition) for (const name of Object.keys(definition.pose)) used.add(name);
    }
    for (const [name, entry] of Object.entries(hyper3dMorphCalibration)) {
      if (!/^mouth|^jaw/.test(name)) continue;
      if (used.has(name)) continue;
      lines.push(
        `   ${name.padEnd(22)} travel ${entry.travelMM.toFixed(2).padStart(6)} mm` +
        `  gain ${entry.gain.toFixed(2)}  cap ${entry.cap.toFixed(2)}  nat ${entry.naturalMax.toFixed(2)}` +
        `  verdict ${entry.verdict}   ${entry.note}`
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(lines.length).toBeGreaterThan(20);
  });
});
