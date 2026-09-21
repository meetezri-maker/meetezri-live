export const SUPPORTED_PHONEMES = ["AA","AE","AH","AO","AW","AY","B","CH","D","DH","EH","ER","EY","F","G","HH","IH","IY","JH","K","L","M","N","NG","OW","OY","P","R","S","SH","T","TH","UH","UW","V","W","Y","Z","ZH","SIL","SP","PAUSE"] as const;
export type SupportedPhoneme = (typeof SUPPORTED_PHONEMES)[number];
export const supportedPhonemeSet = new Set<SupportedPhoneme>(SUPPORTED_PHONEMES);

/**
 * `spn` IS NOT SILENCE, AND IT IS DELIBERATELY NOT ALIASED HERE.
 *
 * Montreal Forced Aligner emits `spn` ("spoken noise") for a word that is
 * missing from its pronunciation dictionary. It marks SPEECH THE ALIGNER COULD
 * NOT LABEL, and folding it into `SIL` — which this table used to do — makes the
 * renderer hold every mouth channel at rest for the whole word. That is the
 * "blue backpack" freeze: MFA's OOV log named `backpack`, its WORD tier had the
 * word, and only the phone tier was an `spn`.
 *
 * `spn` now falls through to `normalizePhoneme`'s unknown branch, which returns
 * `undefined` and warns, so an unrepaired OOV span is LOUD instead of silent.
 * The repair itself is `scripts/repair-oov-alignment.mjs`.
 */
export const phonemeAliases: Record<string, SupportedPhoneme> = {
  "": "SIL", _: "SIL", SILENCE: "SIL", silence: "SIL", REST: "SIL", rest: "SIL", SP: "SP", sp: "SP", PAUSE: "PAUSE", pause: "PAUSE",
  H: "HH", h: "HH", eh: "EH", l: "L", ow: "OW", m: "M", p: "P", b: "B", f: "F", v: "V",
  th: "TH", dh: "DH", sh: "SH", zh: "ZH", ch: "CH", jh: "JH", aa: "AA", ae: "AE",
  ah: "AH", ao: "AO", aw: "AW", ay: "AY", er: "ER", ey: "EY", ih: "IH", iy: "IY",
  uh: "UH", uw: "UW", r: "R", s: "S", z: "Z", t: "T", d: "D", n: "N", ng: "NG", k: "K", g: "G", y: "Y", w: "W"
};

