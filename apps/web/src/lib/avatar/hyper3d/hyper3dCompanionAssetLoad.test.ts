import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createHyper3dEngineFactory, Hyper3dBindingError } from "./hyper3dEngineFactory";
import type { Hyper3dEngineInit } from "./hyper3dEngineRegistry";
import type { Hyper3dAssetId } from "./engine/mappings/avatars/hyper3dAssetSelection";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WHICH FILE THE ENGINE ACTUALLY ASKS FOR, AND WHAT IT DOES WHEN IT IS MISSING.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The real `createHyper3dEngineFactory` runs here against the real
 * `GLTFLoader`. jsdom cannot fetch the GLB, so every load fails — which is
 * precisely the case under test. The factory's attempt list is the one place
 * that could substitute a different person's model, and the assertions below
 * read the URLs it actually requested.
 *
 * Nothing after the load is exercised: `renderer` is never touched, because the
 * factory throws before appearance, lighting or controller construction.
 */

const liveStub = {
  shouldCaptureReviewFrame: () => false,
  noteControllerCreated: () => {},
  recordReviewFrame: () => {},
  getPayload: () => ({ performance_seed: "test" }) as never,
  getAcousticFrames: () => [],
  getRevision: () => 0,
  getSentencePlans: () => [],
  resolveSentencePlanAt: () => null,
  freezeSentencePlans: () => {},
  getSentencePlannerStats: () => ({ turnId: 0 }) as never,
  noteSentencePlanConsumed: () => {},
};

/** Records every URL the loader is asked for, then fails it. */
function captureRequestedUrls() {
  const urls: string[] = [];
  vi.spyOn(THREE.FileLoader.prototype, "load").mockImplementation(function (
    this: unknown,
    url: string,
    _onLoad?: unknown,
    _onProgress?: unknown,
    onError?: (e: unknown) => void,
  ) {
    urls.push(url);
    queueMicrotask(() => onError?.(new Error("network disabled in test")));
    return undefined as never;
  });
  return urls;
}

const initFor = (assetId: Hyper3dAssetId): Hyper3dEngineInit => ({
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(),
  renderer: null as never,
  signal: new AbortController().signal,
  assetId,
});

describe("per-companion asset loading", () => {
  it.each([
    ["hyper3d_afr", "/avatars/hyper3d/afr.glb"],
    ["hyper3d_sara", "/avatars/hyper3d/sara.glb"],
    ["hyper3d_perm", "/avatars/hyper3d/perm.glb"],
    ["hyper3d_frankie", "/avatars/hyper3d/frankie.glb"],
    ["hyper3d_jordan", "/avatars/hyper3d/jordan.glb"],
    ["hyper3d_bianca", "/avatars/hyper3d/bianca.glb"],
    ["hyper3d_damian", "/avatars/hyper3d/damian.glb"],
    ["hyper3d_sasha", "/avatars/hyper3d/sasha.glb"],
  ])("%s requests exactly its own file", async (assetId, url) => {
    const urls = captureRequestedUrls();
    const factory = createHyper3dEngineFactory(liveStub as never);

    await expect(factory(initFor(assetId as Hyper3dAssetId))).rejects.toBeInstanceOf(
      Hyper3dBindingError,
    );

    expect(urls).toEqual([url]);
    vi.restoreAllMocks();
  });

  /**
   * THE IDENTITY GUARANTEE AT THE LOWEST LEVEL. A companion's failed load must
   * not reach for a second Hyper3D asset, because every other one is a
   * DIFFERENT PERSON. One attempt, then throw — and the seam above returns that
   * companion to their own legacy avatar.
   */
  it.each(["hyper3d_afr", "hyper3d_sara", "hyper3d_perm", "hyper3d_frankie", "hyper3d_jordan", "hyper3d_bianca", "hyper3d_damian", "hyper3d_sasha"])(
    "%s never falls back to another companion's model",
    async (assetId) => {
      const urls = captureRequestedUrls();
      const factory = createHyper3dEngineFactory(liveStub as never);

      await factory(initFor(assetId as Hyper3dAssetId)).catch(() => undefined);

      expect(urls).toHaveLength(1);
      expect(urls[0]).not.toContain("female_229");
      expect(urls[0]).not.toContain("female_2291");
      vi.restoreAllMocks();
    },
  );

  /**
   * FRANKIE'S BACKUP IS THE SEAM'S DECISION, NOT THE LOADER'S. A failed
   * frankie.glb load must not reach for perm.glb inside the same attempt — the
   * seam starts perm.glb as a SEPARATE attempt with its own host and token.
   */
  it("frankie.glb's own attempt never requests perm.glb or the legacy Alex.glb", async () => {
    const urls = captureRequestedUrls();
    const factory = createHyper3dEngineFactory(liveStub as never);

    await factory(initFor("hyper3d_frankie")).catch(() => undefined);

    expect(urls).toEqual(["/avatars/hyper3d/frankie.glb"]);
    vi.restoreAllMocks();
  });

  /**
   * THE SINGLE-AVATAR PATH IS UNCHANGED. With no `assetId` the factory still
   * walks female_2291 -> female_229, because those two are the same character
   * and the second cannot change who is on screen.
   */
  it("keeps the shipped two-step chain when no companion asset is given", async () => {
    const urls = captureRequestedUrls();
    const factory = createHyper3dEngineFactory(liveStub as never);

    await factory({
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(),
      renderer: null as never,
      signal: new AbortController().signal,
    }).catch(() => undefined);

    expect(urls).toEqual(["/avatars/female_2291.glb", "/avatars/female_229.glb"]);
    vi.restoreAllMocks();
  });
});
