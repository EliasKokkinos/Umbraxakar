import { mapDistance, regionAt } from './geometry';
import { MAP } from './testing';

describe('mapDistance', () => {
  it('measures in map-width units, scaling y by the aspect ratio', () => {
    expect(mapDistance({ x: 0, y: 0 }, { x: 0.3, y: 0 }, 0.5)).toBeCloseTo(0.3);
    expect(mapDistance({ x: 0, y: 0 }, { x: 0, y: 0.3 }, 0.5)).toBeCloseTo(0.15);
    expect(mapDistance({ x: 0, y: 0 }, { x: 0.3, y: 0.8 }, 0.5)).toBeCloseTo(0.5);
  });
});

describe('regionAt', () => {
  it('finds the region containing a point', () => {
    expect(regionAt({ x: 0.469, y: 0.285 }, MAP.regions)?.name).toBe('Seven Cities');
    expect(regionAt({ x: 0.45, y: 0.8 }, MAP.regions)).toBeNull();
  });

  it('prefers the smallest region where regions overlap', () => {
    // Quon Tali's rect sits inside Seven Cities' broad rect.
    expect(regionAt({ x: 0.52, y: 0.4 }, MAP.regions)?.id).toBe('quon-tali');
  });
});
