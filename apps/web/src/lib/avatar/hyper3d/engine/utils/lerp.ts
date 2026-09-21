export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const exponentialSmoothingAlpha = (speed: number, deltaSeconds: number) => 1 - Math.exp(-speed * Math.max(0, deltaSeconds));
