export class SeededRandom {
  private state: number;
  constructor(seed = 123456) { this.state = seed >>> 0; }
  next() { this.state = (1664525 * this.state + 1013904223) >>> 0; return this.state / 0xffffffff; }
  range(min: number, max: number) { return min + (max - min) * this.next(); }
}
