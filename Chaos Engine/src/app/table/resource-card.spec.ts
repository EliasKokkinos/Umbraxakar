import { factionHue, monogram } from './resource-card';

describe('resource card helpers', () => {
  it('gives story factions their banner colours', () => {
    expect(factionHue('Bluerose')).toBe(212);
    expect(factionHue('Avowed')).toBe(356);
  });

  it('gives any other faction a stable hue', () => {
    expect(factionHue('The Keres')).toBe(factionHue('The Keres'));
    expect(factionHue('The Keres')).toBeGreaterThanOrEqual(0);
    expect(factionHue('The Keres')).toBeLessThan(360);
  });

  it('makes monograms from the meaningful words', () => {
    expect(monogram("Avowed: The Prince's Company")).toBe('AP');
    expect(monogram('Korlat')).toBe('K');
    expect(monogram('John (AHL117)')).toBe('JA');
  });
});
