import { clamp } from "./clamp";
export const smoothstep = (edge0: number, edge1: number, x: number) => { const t = clamp((x - edge0) / Math.max(0.0001, edge1 - edge0)); return t * t * (3 - 2 * t); };
export const easeInOutCubic = (x: number) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
