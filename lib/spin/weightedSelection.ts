import crypto from "node:crypto";

export interface Weighted {
  weight: number;
}

/**
 * Cryptographically secure weighted random pick.
 * Items with weight <= 0 are never picked. Returns null when nothing is eligible.
 * Weights may be fractional; they are scaled to integers (3 decimal places).
 */
export function weightedPick<T extends Weighted>(
  items: T[],
  randomInt: (max: number) => number = (max) => crypto.randomInt(max),
): T | null {
  const scaled = items.map((item) => ({
    item,
    w: Number.isFinite(item.weight) && item.weight > 0 ? Math.round(item.weight * 1000) : 0,
  }));
  const total = scaled.reduce((sum, s) => sum + s.w, 0);
  if (total <= 0) return null;
  // crypto.randomInt upper bound must be <= 2^48
  let r = randomInt(total);
  for (const s of scaled) {
    if (r < s.w) return s.item;
    r -= s.w;
  }
  return null; // unreachable
}
