import * as THREE from "three";
import type { Hyper3dViewportFacts } from "./hyper3dFrameOrchestrator";

/**
 * DEV-ONLY: how large the avatar and its jaw travel are on screen.
 *
 * Reads the canvas, the camera and the face mesh's REST geometry plus the
 * `jawOpen` morph delta. Allocates its own vectors, mutates nothing it is
 * given, and is called only when the canvas size changes. The result is never
 * used by rendering or animation.
 *
 * Projection uses the matrices from the most recent render, which is exact for
 * this static camera and within a head-motion degree for the face.
 */
export function measureHyper3dViewport(input: {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  root: THREE.Object3D;
  faceMesh: THREE.Mesh | null;
  nowMs: number;
}): Hyper3dViewportFacts | null {
  const canvas = (input.renderer as { domElement?: HTMLCanvasElement }).domElement;
  if (!canvas || typeof canvas.clientWidth !== "number") return null;
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  if (!cssWidth || !cssHeight) return null;

  const camera = input.camera;
  const project = (world: THREE.Vector3) => {
    const v = world.clone().project(camera);
    return { x: ((v.x + 1) / 2) * cssWidth, y: ((1 - v.y) / 2) * cssHeight };
  };
  const projectedBox = (min: THREE.Vector3, max: THREE.Vector3, matrixWorld: THREE.Matrix4) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const x of [min.x, max.x]) {
      for (const y of [min.y, max.y]) {
        for (const z of [min.z, max.z]) {
          const p = project(new THREE.Vector3(x, y, z).applyMatrix4(matrixWorld));
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }
      }
    }
    return { width: maxX - minX, height: maxY - minY };
  };

  let headBox: { width: number; height: number } | null = null;
  let jawBox: { width: number; height: number } | null = null;
  let jawTravelPx: number | null = null;
  let jawTravelMeters: number | null = null;
  let note = "rest geometry; projection from the last rendered camera/face matrices";

  const mesh = input.faceMesh;
  const positions = mesh?.geometry?.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (mesh && positions) {
    const matrixWorld = mesh.matrixWorld;
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    const local = new THREE.Vector3();
    for (let i = 0; i < positions.count; i += 1) {
      local.fromBufferAttribute(positions, i);
      min.min(local);
      max.max(local);
    }
    headBox = projectedBox(min, max, matrixWorld);

    const jawIndex = mesh.morphTargetDictionary?.jawOpen;
    const deltas =
      jawIndex !== undefined
        ? (mesh.geometry.morphAttributes.position?.[jawIndex] as THREE.BufferAttribute | undefined)
        : undefined;
    if (deltas) {
      const relative = mesh.geometry.morphTargetsRelative;
      const delta = new THREE.Vector3();
      let maxMagnitude = 0;
      let maxVertex = -1;
      const magnitudes = new Float32Array(positions.count);
      for (let i = 0; i < positions.count; i += 1) {
        delta.fromBufferAttribute(deltas, i);
        if (!relative) delta.sub(local.fromBufferAttribute(positions, i));
        const magnitude = delta.length();
        magnitudes[i] = magnitude;
        if (magnitude > maxMagnitude) {
          maxMagnitude = magnitude;
          maxVertex = i;
        }
      }
      if (maxVertex >= 0 && maxMagnitude > 0) {
        const jawMin = new THREE.Vector3(Infinity, Infinity, Infinity);
        const jawMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
        for (let i = 0; i < positions.count; i += 1) {
          if (magnitudes[i] < maxMagnitude * 0.1) continue;
          local.fromBufferAttribute(positions, i);
          jawMin.min(local);
          jawMax.max(local);
        }
        jawBox = projectedBox(jawMin, jawMax, matrixWorld);

        const rest = new THREE.Vector3().fromBufferAttribute(positions, maxVertex);
        const moved = new THREE.Vector3().fromBufferAttribute(deltas, maxVertex);
        if (relative) moved.add(rest);
        const restWorld = rest.clone().applyMatrix4(matrixWorld);
        const movedWorld = moved.clone().applyMatrix4(matrixWorld);
        jawTravelMeters = restWorld.distanceTo(movedWorld);
        const a = project(restWorld);
        const b = project(movedWorld);
        jawTravelPx = Math.hypot(b.x - a.x, b.y - a.y);
      } else {
        note += "; jawOpen delta buffer empty";
      }
    } else {
      note += "; jawOpen morph not found on face mesh";
    }
  } else {
    note = "face mesh or its position attribute unavailable";
  }

  const renderer = input.renderer as { getPixelRatio?: () => number };
  return {
    measuredAtMs: input.nowMs,
    canvasCssWidth: cssWidth,
    canvasCssHeight: cssHeight,
    canvasBackingWidth: canvas.width,
    canvasBackingHeight: canvas.height,
    devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio : 1,
    rendererPixelRatio: typeof renderer.getPixelRatio === "function" ? renderer.getPixelRatio() : null,
    cameraFov: camera.fov,
    cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
    avatarRootScale: [input.root.scale.x, input.root.scale.y, input.root.scale.z],
    headBoxCssWidth: headBox?.width ?? null,
    headBoxCssHeight: headBox?.height ?? null,
    jawRegionCssWidth: jawBox?.width ?? null,
    jawRegionCssHeight: jawBox?.height ?? null,
    jawOpenMaxVertexCssPxAtFullInfluence: jawTravelPx,
    jawOpenMaxTravelWorldMeters: jawTravelMeters,
    note,
  };
}
