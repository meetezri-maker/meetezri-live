import type { BehaviorRange } from "../../../types/behaviorNaturalism";

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

class Stream {
  private state: number;
  constructor(seed: number) {
    this.state = (seed || 1) >>> 0;
  }
  next() {
    // xorshift32: stable, dependency free, and identical across platforms.
    let x = this.state;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    this.state = x;
    return x / 0x100000000;
  }
  range(min: number, max: number) {
    return min + (max - min) * this.next();
  }
}

/**
 * Deterministic randomness for coordinated behaviour.
 *
 * Each named stream advances independently, so adding a draw to one subsystem
 * never shifts another subsystem's sequence. That keeps blink, gaze, stillness
 * and expression tests stable when unrelated behaviour changes.
 */
export class BehaviorRandom {
  private streams = new Map<string, Stream>();
  private seedValue = 0;

  constructor(private seedText = "avatar-behaviour") {
    this.seedValue = hashString(seedText);
  }

  get seed() {
    return this.seedText;
  }

  reseed(seedText: string) {
    this.seedText = seedText;
    this.seedValue = hashString(seedText);
    this.streams.clear();
  }

  private stream(name: string) {
    let stream = this.streams.get(name);
    if (!stream) {
      stream = new Stream((this.seedValue ^ hashString(name)) >>> 0);
      this.streams.set(name, stream);
    }
    return stream;
  }

  next(name: string) {
    return this.stream(name).next();
  }

  range(name: string, min: number, max: number) {
    return this.stream(name).range(min, max);
  }

  fromRange(name: string, value: BehaviorRange) {
    return this.stream(name).range(value.min, value.max);
  }

  chance(name: string, probability: number) {
    return this.stream(name).next() < probability;
  }

  /** Picks a signed value while avoiding the sign that was used last. */
  signAvoiding(name: string, avoid: -1 | 1 | 0) {
    if (avoid === 0) return this.stream(name).next() < 0.5 ? -1 : 1;
    // 78% chance of switching away from the previous side, so no side is favoured.
    return this.stream(name).next() < 0.78 ? (-avoid as -1 | 1) : avoid;
  }
}
