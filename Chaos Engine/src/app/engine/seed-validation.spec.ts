import commanders from '../../../data/commanders.json';
import resources from '../../../data/resources.json';
import temples from '../../../data/temples.json';
import map from '../../../data/map.json';
import eventsConfig from '../../../data/events-config.json';
import resolutionConfig from '../../../data/resolution-config.json';
import castle from '../../../data/castle.json';
import { Seed } from './seed-types';
import { validateSeed } from './seed-validation';

const realSeed = {
  commanders,
  resources,
  temples,
  map,
  eventsConfig,
  resolutionConfig,
  castle,
} as unknown as Seed;

describe('seed data in /data', () => {
  it('passes validation', () => {
    expect(validateSeed(realSeed)).toEqual([]);
  });

  it('has the six level-17 commanders and no DM-run characters', () => {
    expect(realSeed.commanders.map((c) => c.id)).toEqual([
      'morgran',
      'imogen',
      'darwin',
      'neldor-andarist',
      'onos-toolan',
      'col',
    ]);
    expect(realSeed.commanders.every((c) => c.level === 17)).toBe(true);
  });

  it('starts with five active temples', () => {
    expect(realSeed.temples.filter((t) => t.active)).toHaveLength(5);
  });
});

describe('validateSeed', () => {
  const clone = (): Seed => structuredClone(realSeed);

  it('reports duplicate ids', () => {
    const seed = clone();
    seed.resources.heroes[1].id = seed.resources.heroes[0].id;
    expect(validateSeed(seed)).toContain(`Duplicate id: ${seed.resources.heroes[0].id}`);
  });

  it('reports out-of-range power and morale', () => {
    const seed = clone();
    seed.resources.groups[0].power = 11;
    seed.resources.groups[0].morale = 0;
    const errors = validateSeed(seed);
    expect(errors.some((e) => e.includes('power 11'))).toBe(true);
    expect(errors.some((e) => e.includes('morale 0'))).toBe(true);
  });

  it('reports locked resources with no reason', () => {
    const seed = clone();
    const locked = seed.resources.heroes.find((h) => h.locked)!;
    delete locked.lockReason;
    expect(validateSeed(seed)).toContain(`${locked.id}: locked without lockReason`);
  });

  it('reports positions off the map', () => {
    const seed = clone();
    seed.temples[0].position = { x: 1.2, y: 0.5 };
    expect(validateSeed(seed)).toContain(`${seed.temples[0].id}: position off map`);
  });
});
