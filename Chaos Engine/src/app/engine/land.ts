import { LandDetection, Point } from './seed-types';

/** Answers whether a normalised map point is land a portal may open on. */
export type LandTest = (p: Point) => boolean;

/** Reads one pixel as [r, g, b]. The browser supplies this from a canvas. */
export type PixelSampler = (px: number, py: number) => [number, number, number];

export function parseHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`Bad colour: ${hex}`);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/**
 * Colour-mode land detection: a point is land when at least `minLandRatio` of the pixels
 * within `sampleRadiusPx` differ from the sea colour by more than `tolerance`. Sampling a
 * neighbourhood rejects ocean labels, rivers and coastline strokes.
 */
export function colorLandTest(sample: PixelSampler, width: number, height: number, d: LandDetection): LandTest {
  const sea = parseHex(d.seaColor ?? '#C4DFFF');
  const tolerance = d.tolerance ?? 40;
  const r = d.sampleRadiusPx ?? 6;
  const minRatio = d.minLandRatio ?? 0.8;

  const isLandPixel = (px: number, py: number) => {
    const [pr, pg, pb] = sample(px, py);
    return Math.max(Math.abs(pr - sea[0]), Math.abs(pg - sea[1]), Math.abs(pb - sea[2])) > tolerance;
  };

  return (p: Point) => {
    const cx = Math.round(p.x * (width - 1));
    const cy = Math.round(p.y * (height - 1));
    let total = 0;
    let land = 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const px = cx + dx;
        const py = cy + dy;
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        total++;
        if (isLandPixel(px, py)) land++;
      }
    }
    return total > 0 && land / total >= minRatio;
  };
}

/** Adapts raw RGBA pixel data (e.g. canvas ImageData) to a PixelSampler. */
export function samplerFromRgba(data: ArrayLike<number>, width: number): PixelSampler {
  return (px, py) => {
    const i = (py * width + px) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
}
