import { Point, Rect, Region } from './seed-types';

/**
 * Distance between normalised points, in units of map width. `aspect` is height / width,
 * so a radius means the same on-screen distance horizontally and vertically.
 */
export function mapDistance(a: Point, b: Point, aspect: number): number {
  const dx = a.x - b.x;
  const dy = (a.y - b.y) * aspect;
  return Math.hypot(dx, dy);
}

export function inRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/** The smallest region containing the point, so nested regions win over broad ones. */
export function regionAt(p: Point, regions: Region[]): Region | null {
  let best: Region | null = null;
  for (const r of regions) {
    if (inRect(p, r) && (!best || r.w * r.h < best.w * best.h)) best = r;
  }
  return best;
}
