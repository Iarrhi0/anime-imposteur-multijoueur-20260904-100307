// Générateur aléatoire déterministe (mulberry32) : permet le « défi du jour »
// (même graine = même partie pour tout le monde) et des parties rejouables.

export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: readonly T[]): T[];
  chance(p: number): boolean;
  sample<T>(arr: readonly T[], n: number): T[];
}

export function makeRng(seed: number = Date.now() ^ Math.floor(Math.random() * 1e9)): Rng {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => {
      const x = [...arr];
      for (let i = x.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [x[i], x[j]] = [x[j], x[i]];
      }
      return x;
    },
    chance: (p) => next() < p,
    sample: (arr, n) => rng.shuffle(arr).slice(0, Math.max(0, n))
  };
  return rng;
}

export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function uid(prefix = ''): string {
  const r = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix + r.replace(/-/g, '').slice(0, 12);
}
