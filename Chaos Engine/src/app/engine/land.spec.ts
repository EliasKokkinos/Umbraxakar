import { PixelSampler, colorLandTest, parseHex } from './land';

const SEA: [number, number, number] = [196, 223, 255];
const WHITE: [number, number, number] = [255, 255, 255];
const INK: [number, number, number] = [40, 40, 120];

/** 100×100 image: sea on the left half, white land on the right, a thin ink label at x=20. */
const sampler: PixelSampler = (px) => {
  if (px === 20 || px === 21) return INK;
  return px >= 50 ? WHITE : SEA;
};

const detect = colorLandTest(sampler, 100, 100, {
  mode: 'color',
  seaColor: '#C4DFFF',
  tolerance: 40,
  sampleRadiusPx: 4,
  minLandRatio: 0.8,
});

describe('colorLandTest', () => {
  it('parses hex colours', () => {
    expect(parseHex('#C4DFFF')).toEqual(SEA);
  });

  it('accepts inland points and rejects open sea', () => {
    expect(detect({ x: 0.8, y: 0.5 })).toBe(true);
    expect(detect({ x: 0.1, y: 0.5 })).toBe(false);
  });

  it('rejects a thin label drawn on the sea', () => {
    expect(detect({ x: 0.2, y: 0.5 })).toBe(false);
  });

  it('rejects points on the coastline where too little land is nearby', () => {
    expect(detect({ x: 0.5, y: 0.5 })).toBe(false);
  });
});
