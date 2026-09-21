import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetHyper3dEngineFactoryForTests,
  registerHyper3dEngineFactory,
  type Hyper3dEngineHandle,
} from "./hyper3dEngineRegistry";

/**
 * jsdom has no WebGL, so a real `WebGLRenderer` throws on construction. That is
 * itself one of the paths under test (see "no WebGL"), but reaching the LATER
 * stages needs a renderer that constructs. `webglAvailable` switches between
 * the two worlds; nothing else about the host is stubbed.
 */
const webgl = { available: true };

vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  class StubRenderer {
    domElement: HTMLCanvasElement;
    constructor(parameters: { canvas: HTMLCanvasElement }) {
      if (!webgl.available) throw new Error("WebGL is not supported");
      this.domElement = parameters.canvas;
    }
    setPixelRatio() {}
    setClearColor() {}
    setSize() {}
    render() {}
    dispose() {}
    forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer: StubRenderer };
});

const { createHyper3dImperativeHost } = await import("./hyper3dImperativeHost");

/**
 * Host failure isolation.
 *
 * The NO CRASH RULE names failures React cannot see — async init, GLB/texture
 * load, rig and morph binding, the animation frame, a lost WebGL context. Each
 * must become one `onFailure` call and must never propagate.
 */

const container = () => {
  const el = document.createElement("div");
  Object.defineProperty(el, "clientWidth", { value: 640, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: 480, configurable: true });
  document.body.appendChild(el);
  return el;
};

const hostOptions = (
  el: HTMLElement,
  onFailure: (failure: { stage: string; message: string }) => void = vi.fn(),
) => ({
  container: el,
  getPlaybackTime: () => 0,
  getConversationState: () => ({ isSpeaking: false, isListening: false, isThinking: false }),
  getAudioLevel: () => 0,
  onFailure,
});

beforeEach(() => {
  __resetHyper3dEngineFactoryForTests();
  webgl.available = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  __resetHyper3dEngineFactoryForTests();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("imperative host — failure isolation", () => {
  it("reports engine-missing instead of throwing when no engine is registered", async () => {
    const onFailure = vi.fn();
    const el = container();
    const host = createHyper3dImperativeHost(hostOptions(el, onFailure));

    await vi.waitFor(() => expect(onFailure).toHaveBeenCalled());
    expect(onFailure.mock.calls[0][0].stage).toBe("engine-missing");
    expect(host.getStatus()).toBe("unavailable");
    host.dispose();
  });

  it("falls back rather than throwing when WebGL is unavailable", async () => {
    webgl.available = false;
    registerHyper3dEngineFactory(async () => ({ update: () => {}, dispose: () => {} }));
    const onFailure = vi.fn();
    const el = container();
    const host = createHyper3dImperativeHost(hostOptions(el, onFailure));

    await vi.waitFor(() => expect(onFailure).toHaveBeenCalled());
    expect(onFailure.mock.calls[0][0].stage).toBe("webgl-context");
    expect(host.getStatus()).toBe("failed");
    host.dispose();
  });

  it("reports a rejected engine init — a failed GLB or texture load", async () => {
    registerHyper3dEngineFactory(async () => {
      throw new Error("GLB 404");
    });
    const onFailure = vi.fn();
    const el = container();
    const host = createHyper3dImperativeHost(hostOptions(el, onFailure));

    await vi.waitFor(() => expect(onFailure).toHaveBeenCalled());
    expect(onFailure.mock.calls[0][0].stage).toBe("engine-init");
    expect(onFailure.mock.calls[0][0].message).toContain("GLB 404");
    expect(host.getStatus()).toBe("failed");
    host.dispose();
  });

  it("never reports more than once", async () => {
    registerHyper3dEngineFactory(async () => {
      throw new Error("first and only");
    });
    const onFailure = vi.fn();
    const el = container();
    const host = createHyper3dImperativeHost(hostOptions(el, onFailure));

    await vi.waitFor(() => expect(onFailure).toHaveBeenCalled());
    host.dispose();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it("survives a failure handler that itself throws", async () => {
    registerHyper3dEngineFactory(async () => {
      throw new Error("engine down");
    });
    const el = container();
    const host = createHyper3dImperativeHost(
      hostOptions(el, () => {
        throw new Error("fallback handler is buggy too");
      }),
    );

    // The session must still be standing after both the engine and the handler
    // fail; nothing may escape into the caller.
    await vi.waitFor(() => expect(host.getStatus()).toBe("failed"));
    expect(() => host.dispose()).not.toThrow();
  });

  it("disposes cleanly before a slow engine load resolves", async () => {
    const disposeSpy = vi.fn();
    const pending: { resolve?: (handle: Hyper3dEngineHandle) => void } = {};
    registerHyper3dEngineFactory(
      () =>
        new Promise<Hyper3dEngineHandle>((resolve) => {
          pending.resolve = resolve;
        }),
    );

    const onFailure = vi.fn();
    const el = container();
    const host = createHyper3dImperativeHost(hostOptions(el, onFailure));
    host.dispose();

    // The GLB finishes loading after the user has already left the session.
    pending.resolve?.({ update: () => {}, dispose: disposeSpy });
    await new Promise((resolve) => setTimeout(resolve, 20));

    // The late engine is released, not adopted, and no failure is invented.
    expect(disposeSpy).toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("reports nothing when a load REJECTS after disposal", async () => {
    // The sibling test above covers a late RESOLVE. This is the other half, and
    // the one that actually happens: `dispose()` aborts the signal, so a load in
    // flight rejects. Reporting that would latch `AvatarRuntimeSwitch`'s one-way
    // fallback — which outlives this host — and pin the old avatar for the rest
    // of the session because of a teardown rather than a fault.
    const pending: { reject?: (error: unknown) => void } = {};
    registerHyper3dEngineFactory(
      () =>
        new Promise<Hyper3dEngineHandle>((_resolve, reject) => {
          pending.reject = reject;
        }),
    );

    const onFailure = vi.fn();
    const host = createHyper3dImperativeHost(hostOptions(container(), onFailure));
    host.dispose();

    pending.reject?.(new Error("aborted"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onFailure).not.toHaveBeenCalled();
  });

  it("is safe to dispose twice", async () => {
    const el = container();
    const host = createHyper3dImperativeHost(hostOptions(el));
    await vi.waitFor(() => expect(host.getStatus()).toBe("unavailable"));
    host.dispose();
    expect(() => host.dispose()).not.toThrow();
  });

  it("holds no reference to audio, the scheduler or the socket", () => {
    // Structural: the options this host accepts are three read-only getters and
    // a callback. There is no channel through which it could reach playback.
    const el = container();
    const options = hostOptions(el);
    expect(Object.keys(options).sort()).toEqual([
      "container",
      "getAudioLevel",
      "getConversationState",
      "getPlaybackTime",
      "onFailure",
    ]);
  });
});
