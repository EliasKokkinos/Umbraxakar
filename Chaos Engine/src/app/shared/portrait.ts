/** Portraits are stored as small square JPEGs: plenty for a card, cheap to keep and to sync. */
export const PORTRAIT_SIZE = 320;
const QUALITY = 0.85;
/** How far down a tall image the square sits: faces are usually in the upper part. */
const TOP_BIAS = 0.25;

export interface Crop {
  sx: number;
  sy: number;
  side: number;
}

/** The square to cut from a w×h image: centred across, biased towards the top on tall images. */
export function cropSquare(w: number, h: number): Crop {
  const side = Math.min(w, h);
  return {
    sx: Math.round((w - side) / 2),
    sy: Math.round((h - side) * (h > w ? TOP_BIAS : 0.5)),
    side,
  };
}

/** Crops and shrinks any image file to a portrait data URL. */
export async function makePortrait(file: Blob): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('That image could not be read.');
  });
  const { sx, sy, side } = cropSquare(bitmap.width, bitmap.height);
  const out = Math.min(PORTRAIT_SIZE, side);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', QUALITY);
}
