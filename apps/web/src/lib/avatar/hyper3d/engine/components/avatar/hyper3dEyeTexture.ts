import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RedFormat, RepeatWrapping, RGBAFormat, SRGBColorSpace, type Texture } from "three";

/**
 * TEMPORARY HYPER3D DEMO EYE MATERIAL — procedural iris.
 *
 * ============================================================================
 * THIS IS A PLACEHOLDER. Delete this file and the `eyeTexture` block in
 * `hyper3dMaterials.ts` the moment the vendor supplies a real eye map; the
 * eyeball material falls straight back to its flat sclera colour with nothing
 * else to unwind.
 * ============================================================================
 *
 * Why a procedural texture rather than an asset: the Hyper3D export contains no
 * eye appearance data of any kind — zero Texture objects in either FBX, all 23
 * materials identical default Phong stubs, and all three supplied maps are the
 * same face projection that returns plain skin over the eyeball's UV footprint.
 * The GEOMETRY is complete and correctly unwrapped, so only appearance is
 * missing, and appearance is all this adds.
 *
 * Nothing here touches geometry, UVs, topology, the eye morphs or
 * `EyeGeometryController`. It produces one image; the material binds it.
 *
 * Placement is MEASURED, not guessed
 * ----------------------------------
 * Every eyeball vertex was projected against its angle from the forward axis:
 *
 *   UV pole (the point the eye looks through)   (0.5029, 0.4740)
 *   front-hemisphere fit    ruv = 0.004406 * degrees + 0.0103   (n = 1782/eye)
 *
 * Left and right agree to four decimal places, which is why ONE texture serves
 * both eyes — they share the same unwrap.
 *
 * The mapping is linear in ANGLE, so anatomy converts directly. A human iris is
 * about 11.7 mm across on a 24 mm eyeball, i.e. a 29 degree half-angle, and a
 * relaxed indoor pupil is about 12 degrees:
 *
 *   iris  29 deg -> UV radius 0.138
 *   pupil 12 deg -> UV radius 0.063
 *
 * That is where the brief's "oversized iris / oversized pupil" failure modes are
 * ruled out: both come from the anatomy, not from taste.
 */

/** Measured centre of the eyeball unwrap. Both eyes. */
export const EYE_UV_POLE = { u: 0.5029, v: 0.474 } as const;
/** Measured linear fit of UV radius against degrees from the forward axis. */
export const EYE_UV_PER_DEGREE = 0.004406;
export const EYE_UV_INTERCEPT = 0.0103;

/** UV radius for a given half-angle in degrees, from the measured fit. */
export const uvRadiusForDegrees = (degrees: number) => EYE_UV_PER_DEGREE * degrees + EYE_UV_INTERCEPT;

export const IRIS_UV_RADIUS = uvRadiusForDegrees(29);
export const PUPIL_UV_RADIUS = uvRadiusForDegrees(12);
/** The limbal ring occupies only the outer edge of the iris, and fades. */
export const LIMBUS_UV_INNER = IRIS_UV_RADIUS * 0.86;

type RGB = [number, number, number];

/**
 * EYE INTEGRATION VARIANTS — appearance only.
 *
 * Iris and pupil geometry are LOCKED for this pass: `IRIS_UV_RADIUS`,
 * `PUPIL_UV_RADIUS` and `EYE_UV_POLE` are not variant-dependent and no variant
 * touches them.
 *
 * What the variants move, and why, from the measured render:
 *
 * - The under-eye skin renders at 66-94 luma while the sclera at (222,216,206)
 *   renders at ~217 — the eyeball is 2.3-3.3x brighter than the face it sits in,
 *   which is the "too bright/flat" reading. Both variants darken and warm it.
 * - `scleraShade` controls how fast the sclera darkens toward the socket. Raising
 *   it is what seats the eyeball in the lids instead of leaving it a bright ball.
 * - `upperLash` strengthens the upper lash line only. `lowerLash` stays sparse.
 */
export interface Hyper3dEyeVariant {
  sclera: RGB;
  scleraShade: RGB;
  /** How strongly the sclera darkens toward the periphery. */
  shadeStrength: number;
  /** Where the peripheral shading starts, as a UV radius. Earlier = deeper socket. */
  shadeFrom: number;
  upperLash: number;
  lowerLash: number;
}

export const EYE_INTEGRATION: Record<"clean" | "a" | "b", Hyper3dEyeVariant> = {
  /** The accepted CLEAN EYE FIX, unchanged. The A/B reference. */
  clean: { sclera: [222, 216, 206], scleraShade: [188, 184, 180], shadeStrength: 0.9, shadeFrom: 0.46, upperLash: 1, lowerLash: 0.34 },
  /** Moderate: warmer and darker sclera, deeper socket shading, slightly stronger upper lash. */
  a: { sclera: [204, 196, 183], scleraShade: [162, 156, 149], shadeStrength: 1, shadeFrom: 0.40, upperLash: 1.15, lowerLash: 0.34 },
  /** Stronger on all three, for the far end of the range. */
  b: { sclera: [190, 180, 165], scleraShade: [143, 136, 128], shadeStrength: 1, shadeFrom: 0.34, upperLash: 1.32, lowerLash: 0.30 }
};

export type Hyper3dEyeVariantId = keyof typeof EYE_INTEGRATION;

const mix = (a: RGB, b: RGB, t: number): RGB => {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * Deterministic value noise. No `Math.random`, so the texture is byte-identical
 * on every run and can be unit-tested.
 */
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * The palette. Sclera colours live in `EYE_INTEGRATION` because they are the
 * thing the integration pass varies; everything below is shared by all variants.
 *
 * No variant uses a white sclera — a white sclera is the single strongest
 * "computer graphics eye" tell, and every value in the table is a warm off-white
 * in the range a real sclera photographs at.
 */
/** Faint warmth near the inner corner. Not a vein — the brief rules those out. */
const SCLERA_WARM: RGB = [214, 200, 190];
/** Medium/dark brown, the most common human iris. */
const IRIS_MID: RGB = [92, 64, 40];
/** Lighter collarette just outside the pupil, where real irises brighten. */
const IRIS_INNER: RGB = [116, 84, 52];
/** The iris darkens toward the limbus before the ring itself. */
const IRIS_OUTER: RGB = [58, 40, 26];
/** Subtle limbal ring. Dark grey-brown rather than black, and it fades both ways. */
const LIMBAL_RING: RGB = [34, 26, 22];
/** Pupil. Near-black but not pure black, which reads as a hole. */
const PUPIL: RGB = [11, 9, 10];

/**
 * Colour of one texel of the eye map, in sRGB 0-255.
 *
 * Pure, deterministic and free of any renderer dependency, so the whole
 * appearance can be asserted in tests without a GPU or a canvas.
 */
export const sampleHyper3dEyeTexel = (u: number, v: number, variantId: Hyper3dEyeVariantId = "clean"): RGB => {
  const variant = EYE_INTEGRATION[variantId];
  const du = u - EYE_UV_POLE.u;
  const dv = v - EYE_UV_POLE.v;
  const r = Math.hypot(du, dv);
  const theta = Math.atan2(dv, du);

  // ---- sclera --------------------------------------------------------------
  if (r >= IRIS_UV_RADIUS) {
    // Gentle darkening with distance from the cornea, so the eyeball reads as a
    // sphere rather than a flat disc, plus a little low-frequency mottling.
    const away = smoothstep(IRIS_UV_RADIUS, variant.shadeFrom, r);
    let c = mix(variant.sclera, variant.scleraShade, away * variant.shadeStrength);
    // A touch of warmth toward one side, standing in for the caruncle without
    // drawing anything as literal as a vein.
    c = mix(c, SCLERA_WARM, smoothstep(0.16, 0.40, r) * (0.5 + 0.5 * Math.cos(theta)) * 0.35);
    // Slight natural variation. Deliberately small: +-3 of 222 is visible as
    // texture at close range and invisible as noise at conversational distance.
    const n = (hash(Math.floor(u * 90), Math.floor(v * 90)) - 0.5) * 6;
    /**
     * The sclera meets the iris over a soft limbus rather than a hard cut. At
     * 512 px this band is ~9 texels; the earlier 0.012 was ~6, which is
     * sub-pixel once the eye is only about 40 px on screen and read as a stamped
     * edge. The PUPIL edge is deliberately left crisp — a real pupil boundary is
     * sharp, and softening it makes the eye look out of focus.
     */
    const blend = smoothstep(IRIS_UV_RADIUS, IRIS_UV_RADIUS + 0.018, r);
    const edge = mix(mix(IRIS_OUTER, LIMBAL_RING, 0.5), c, blend);
    return [edge[0] + n, edge[1] + n, edge[2] + n];
  }

  // ---- pupil ---------------------------------------------------------------
  if (r <= PUPIL_UV_RADIUS) {
    // Soft edge so the pupil is not a stamped circle.
    const t = smoothstep(PUPIL_UV_RADIUS - 0.008, PUPIL_UV_RADIUS, r);
    return mix(PUPIL, IRIS_INNER, t * 0.45);
  }

  // ---- iris ----------------------------------------------------------------
  // 0 at the pupil edge, 1 at the limbus.
  const t = (r - PUPIL_UV_RADIUS) / (IRIS_UV_RADIUS - PUPIL_UV_RADIUS);
  // Brighter collarette near the pupil, darkening outward.
  let c = t < 0.35
    ? mix(IRIS_INNER, IRIS_MID, smoothstep(0, 0.35, t))
    : mix(IRIS_MID, IRIS_OUTER, smoothstep(0.35, 1, t));

  /**
   * Radial fibre detail. Three octaves of angular stripe, each modulated so the
   * fibres are strongest in the mid-iris and fade at both the pupil and the
   * limbus — which is how a real iris reads. Amplitude is small on purpose: the
   * brief asks for SUBTLE detail, and high-contrast striping is what makes a
   * procedural eye look synthetic.
   */
  const fibreEnvelope = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ;
  const fibre =
    Math.sin(theta * 34 + hash(3, 7) * 6.283) * 0.55 +
    Math.sin(theta * 71 + hash(11, 5) * 6.283) * 0.3 +
    Math.sin(theta * 133 + hash(17, 2) * 6.283) * 0.15;
  const fibreAmount = fibre * fibreEnvelope * 9;
  c = [c[0] + fibreAmount, c[1] + fibreAmount * 0.85, c[2] + fibreAmount * 0.7];

  // Fine speckle, so the fibres are not perfectly periodic.
  const speck = (hash(Math.floor(theta * 60), Math.floor(r * 900)) - 0.5) * 5 * fibreEnvelope;
  c = [c[0] + speck, c[1] + speck * 0.9, c[2] + speck * 0.8];

  /**
   * Limbal ring. Only the outer 14% of the iris, and it fades IN and OUT, so it
   * never becomes the "uncanny high-contrast ring" the brief rules out.
   */
  const ring = smoothstep(LIMBUS_UV_INNER, IRIS_UV_RADIUS * 0.97, r) * (1 - smoothstep(IRIS_UV_RADIUS * 0.97, IRIS_UV_RADIUS, r) * 0.35);
  c = mix(c, LIMBAL_RING, ring * 0.65);

  return c;
};

/**
 * Builds the eye map as a `DataTexture`.
 *
 * A DataTexture rather than a canvas: it needs no DOM, so the same code path
 * runs under test, and there is no `flipY` ambiguity — row 0 is v=0 and this
 * generates it that way.
 *
 * 512 is ample. The iris spans 2 * 0.138 = 0.276 of UV width, i.e. 141 px here,
 * against roughly 40 px on screen at the head-framed camera.
 */
export const createHyper3dEyeTexture = (size = 512, variant: Hyper3dEyeVariantId = "clean"): Texture => {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const [r, g, b] = sampleHyper3dEyeTexel(u, v, variant);
      const i = (y * size + x) * 4;
      data[i] = Math.max(0, Math.min(255, Math.round(r)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
      data[i + 3] = 255;
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.name = "TEMPORARY HYPER3D DEMO EYE MATERIAL (procedural)";
  texture.needsUpdate = true;
  return texture;
};

// ===========================================================================
// TEMPORARY HYPER3D DEMO EYE MATERIAL — lash alpha
// ===========================================================================

/**
 * Procedural alpha cutout for the 12 eyelash cards.
 *
 * The problem it solves, measured rather than guessed. Each eye carries SIX lash
 * cards in two bands, positioned against that eye's centre:
 *
 *   upper band  009/013/014 (L), 018/019/020 (R)   mean +1.2..+1.4 mm, 30% below
 *   lower band  015/016/017 (L), 021/022/023 (R)   mean -6.2..-6.4 mm, 100% below
 *
 * The lower band is three cards, each about 30 x 8 mm, sitting ENTIRELY below the
 * eye and facing the camera (mean normal z 0.65-0.70). They are alpha-cutout
 * strips in the original pipeline and the package ships no alpha map, so with any
 * opaque-ish material they are solid quads — and three stacked at opacity 0.55
 * composite to 1 - 0.45^3 = 91% opaque. That is the black slab under each eye.
 *
 * No opacity value fixes this on its own: without a cutout the card is always a
 * rectangle. So this supplies the missing cutout.
 *
 * It uses the asset's REAL UVs, no invented transform. Measured layout:
 *
 *   u 6.510..6.988   corr(u, world X) = 0.99   -> u runs ALONG the lash line
 *   v 0.848..0.988   upper band
 *   v 0.346..0.486   lower band
 *
 * With `RepeatWrapping`, u 6.51..6.99 samples 0.51..0.99, so the two bands are
 * painted where the cards actually land.
 */
const LASH_BANDS = [
  { min: 0.848, max: 0.988, strength: 1 },
  // Real lower lashes are sparse, short and far fainter than the upper set.
  { min: 0.346, max: 0.486, strength: 0.34 }
];

/**
 * Alpha for one texel of the lash map.
 *
 * Falloff is from the band CENTRE toward both v edges rather than root-to-tip.
 * The upper cards arc forward rather than vertically (corr(v, world Y) = 0.075),
 * so which v edge is the root is not well defined for them; a symmetric falloff
 * reads as a lash band whichever way the card is oriented and, critically,
 * guarantees the card never ends in a hard edge. Everything outside the two
 * bands is fully transparent, which is what removes the slab.
 */
export const sampleHyper3dLashAlpha = (u: number, v: number, variantId: Hyper3dEyeVariantId = "clean"): number => {
  const variant = EYE_INTEGRATION[variantId];
  const uu = u - Math.floor(u);
  let alpha = 0;
  for (const band of LASH_BANDS) {
    if (v < band.min || v > band.max) continue;
    const t = (v - band.min) / (band.max - band.min);
    // Soft across the strand band, zero at both edges.
    const across = Math.sin(Math.PI * t) ** 1.6;
    /**
     * Strand comb along the lid. Two interleaved frequencies so the lashes are
     * not a regular picket fence, with real gaps between them — the gaps are
     * what make this read as lashes instead of a bar.
     */
    const comb =
      Math.max(0, Math.sin(uu * Math.PI * 2 * 58 + Math.sin(uu * 31) * 1.7)) ** 2.2 * 0.75 +
      Math.max(0, Math.sin(uu * Math.PI * 2 * 37 + 1.1)) ** 3 * 0.25;
    // Lashes thin out toward the outer and inner corners of the lid.
    const alongLid = Math.sin(Math.PI * Math.min(1, Math.max(0, (uu - 0.51) / 0.478))) ** 0.6;
    const strength = band.min > 0.6 ? variant.upperLash : variant.lowerLash;
    alpha = Math.min(1, Math.max(alpha, across * comb * alongLid * strength));
  }
  return Math.min(1, alpha);
};

/**
 * The lash alpha map. Wide in u because the strand comb is the whole point;
 * 1024 keeps individual strands resolvable rather than aliasing into a bar.
 */
export const createHyper3dLashAlphaTexture = (size = 1024, variant: Hyper3dEyeVariantId = "clean"): Texture => {
  const data = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      data[y * size + x] = Math.round(sampleHyper3dLashAlpha(u, v, variant) * 255);
    }
  }
  const texture = new DataTexture(data, size, size, RedFormat);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.name = "TEMPORARY HYPER3D DEMO EYE MATERIAL (lash alpha)";
  texture.needsUpdate = true;
  return texture;
};
