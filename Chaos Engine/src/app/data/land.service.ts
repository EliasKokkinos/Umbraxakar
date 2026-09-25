import { Injectable } from '@angular/core';
import { LandTest, colorLandTest, samplerFromRgba } from '../engine/land';
import { MapDef } from '../engine/seed-types';

/** Longest edge the map is downscaled to for land sampling; the full atlas would need ~100 MB of pixels. */
const SAMPLE_EDGE = 2048;

const LOAD_TIMEOUT_MS = 10000;

/** Loads an image with load/error events; `decode()` can stall indefinitely in some browsers. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error(`Timed out loading ${src}`)), LOAD_TIMEOUT_MS);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`Could not load ${src}`));
    };
    img.src = src;
  });
}

/** Builds the engine's land test from the active map image, in the browser. */
@Injectable({ providedIn: 'root' })
export class LandService {
  async landTestFor(map: MapDef): Promise<LandTest> {
    const d = map.landDetection;
    if (d.mode !== 'color') throw new Error(`Land detection mode "${d.mode}" is not supported yet`);

    const img = await loadImage(map.asset);

    const scale = Math.min(1, SAMPLE_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    // The sample radius is defined in source pixels; scale it with the image.
    const radius = Math.max(1, Math.round((d.sampleRadiusPx ?? 6) * scale));
    return colorLandTest(samplerFromRgba(data, w), w, h, { ...d, sampleRadiusPx: radius });
  }
}
