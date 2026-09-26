// Test helpers for engine specs. Not imported by production code.
import resources from '../../../data/resources.json';
import resolutionConfig from '../../../data/resolution-config.json';
import { GroupState, HeroState, resourcesFromSeed } from './resource-state';
import { Rng } from './rng';
import { ResolutionConfig, ResourcesSeed } from './seed-types';

export const CFG = resolutionConfig as unknown as ResolutionConfig;

const all = () => resourcesFromSeed(resources as unknown as ResourcesSeed);

export function hero(id: string, overrides: Partial<HeroState> = {}): HeroState {
  const r = all().find((x) => x.id === id);
  if (!r || r.kind === 'group') throw new Error(`No hero ${id}`);
  return { ...r, ...overrides };
}

export function group(id: string, overrides: Partial<GroupState> = {}): GroupState {
  const r = all().find((x) => x.id === id);
  if (!r || r.kind !== 'group') throw new Error(`No group ${id}`);
  return { ...r, ...overrides };
}

/** Rng that returns scripted floats in order, then throws if exhausted. */
export class ScriptedRng extends Rng {
  private readonly queue: number[];

  constructor(values: number[]) {
    super(0);
    this.queue = [...values];
  }

  override next(): number {
    const v = this.queue.shift();
    if (v === undefined) throw new Error('ScriptedRng exhausted');
    return v;
  }
}

/** Float that makes `rng.d(sides)` return exactly `face`. */
export const face = (value: number, sides: number) => (value - 1) / sides + 1e-6;

// ---------------------------------------------------------------- events fixtures
import eventsConfig from '../../../data/events-config.json';
import mapSeed from '../../../data/map.json';
import templesSeed from '../../../data/temples.json';
import { EventsState, PortalState, templeFromSeed } from './event-state';
import { inRect } from './geometry';
import { MapContext } from './events';
import { EventsConfig, MapDef, MapSeed, TempleSeed } from './seed-types';

export const EVENTS_CFG = eventsConfig as unknown as EventsConfig;
export const MAP: MapDef = (mapSeed as unknown as MapSeed).maps[0];

/** Stand-in for pixel land detection: every named region counts as land. */
export const REGION_LAND: MapContext = { map: MAP, isLand: (p) => MAP.regions.some((r) => inRect(p, r)) };

export function eventsState(overrides: Partial<EventsState> = {}): EventsState {
  return {
    turn: 1,
    portals: [],
    temples: (templesSeed as unknown as TempleSeed[]).map(templeFromSeed),
    civilianDeaths: 0,
    nextPortalSerial: 1,
    auraRadius: null,
    ...overrides,
  };
}

export function portal(overrides: Partial<PortalState> = {}): PortalState {
  return {
    id: 'portal-x',
    type: 'chaos-portal',
    name: 'The Test Rift of Nowhere',
    // Open sea south of Jacuruku: far from every temple.
    position: { x: 0.45, y: 0.8 },
    regionId: null,
    hidden: false,
    assigned: [],
    dmNotes: '',
    createdTurn: 1,
    lastOutcome: null,
    corruption: 1,
    difficulty: 5,
    impact: 5,
    legendary: false,
    status: 'open',
    ...overrides,
  };
}

// ---------------------------------------------------------------- full-game fixtures
import castleSeed from '../../../data/castle.json';
import commandersSeed from '../../../data/commanders.json';
import { Rules, rulesFromSeed } from './game-state';
import { Seed } from './seed-types';

export const SEED = {
  commanders: commandersSeed,
  resources,
  temples: templesSeed,
  map: mapSeed,
  eventsConfig,
  resolutionConfig,
  castle: castleSeed,
} as unknown as Seed;

export const RULES: Rules = rulesFromSeed(SEED, REGION_LAND);
