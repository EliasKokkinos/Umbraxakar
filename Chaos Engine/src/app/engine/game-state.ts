import { BattleResult } from './battle';
import { EventState, EventsState, templeFromSeed } from './event-state';
import { EventPhaseReport, MapContext, initialPortalCount, seedPortals } from './events';
import { canDeploy } from './morale';
import { effectivePower } from './power';
import { HeroState, ResourceState, resourcesFromSeed } from './resource-state';
import { Rng } from './rng';
import { CastleSeed, Commander, CommanderInfluence, EventsConfig, ResolutionConfig, Seed } from './seed-types';

export const GAME_STATE_VERSION = 4;

/** A hero in the Healers' Hall: occupies a slot and the hero until done. */
export interface Treatment {
  resourceId: string;
  severity: 'serious' | 'grievous';
  turnsLeft: number;
}

export type Project =
  | { kind: 'militia'; turnsLeft: number }
  | { kind: 'forge'; groupId: string; turnsLeft: number }
  | { kind: 'upgrade'; facilityId: string; toLevel: number; turnsLeft: number };

export interface CastleState {
  treasury: number;
  incomePerTurn: number;
  showTreasuryOnTable: boolean;
  facilities: Record<string, number>;
  entertainersTurnsLeft: number;
  casksServed: number;
  /** Resources training this turn; they skip castle morale recovery. */
  training: string[];
  treatments: Treatment[];
  /** Recruitment ordered this turn: group id → soldiers. */
  recruits: Record<string, number>;
  projects: Project[];
  nextMilitiaSerial: number;
}

export interface TurnLogEntry {
  turn: number;
  commanderId: string | null;
  battles: Record<string, BattleResult>;
  events: EventPhaseReport;
  civilianDeaths: number;
  routed: string[];
  completed: string[];
}

export interface GameState {
  version: number;
  rngState: number;
  commanderId: string | null;
  /** The turn the current commander took command; null before anyone has. */
  commanderTurn: number | null;
  /** The sway applied when the current commander took command, as it stood then. */
  commandSway: CommanderInfluence[] | null;
  /** The DM's own sway for a commander, replacing the archive's (the seed) for that commander. */
  commanderInfluence: Record<string, CommanderInfluence[]>;
  resources: ResourceState[];
  events: EventsState;
  castle: CastleState;
  log: TurnLogEntry[];
}

/** Static rules and map, passed to every engine operation. */
export interface Rules {
  resolution: ResolutionConfig;
  events: EventsConfig;
  castle: CastleSeed;
  commanders: Commander[];
  map: MapContext;
}

export function rulesFromSeed(seed: Seed, map: MapContext): Rules {
  return { resolution: seed.resolutionConfig, events: seed.eventsConfig, castle: seed.castle, commanders: seed.commanders, map };
}

export type Result<T = GameState> = { ok: true; state: T } | { ok: false; error: string };
export const ok = <T>(state: T): Result<T> => ({ ok: true, state });
export const fail = <T = GameState>(error: string): Result<T> => ({ ok: false, error });

// ---------------------------------------------------------------- lookups

export function resourceById(state: GameState, id: string): ResourceState | undefined {
  return state.resources.find((r) => r.id === id);
}

export function allEvents(state: GameState): EventState[] {
  return [...state.events.portals, ...state.events.temples];
}

export function eventById(state: GameState, id: string): EventState | undefined {
  return allEvents(state).find((e) => e.id === id);
}

/** Heroes attached to a host card. */
export function attachedTo(state: GameState, hostId: string): HeroState[] {
  return state.resources.filter((r): r is HeroState => r.kind !== 'group' && r.attachedTo === hostId);
}

/** The event a resource (or the card it is attached to) is assigned to, if any. */
export function eventOf(state: GameState, resourceId: string): EventState | undefined {
  const r = resourceById(state, resourceId);
  const hostId = r?.attachedTo ?? resourceId;
  return allEvents(state).find((e) => e.assigned.includes(hostId));
}

export function isAtCastle(state: GameState, resourceId: string): boolean {
  return !eventOf(state, resourceId);
}

export function isOccupied(state: GameState, resourceId: string): boolean {
  return state.castle.training.includes(resourceId) || state.castle.treatments.some((t) => t.resourceId === resourceId);
}

/** Groups that could be sent to an event right now (used for the opening portal count). */
export function deployableHosts(state: GameState, rules: Rules): ResourceState[] {
  return state.resources.filter((r) => {
    if (r.kind !== 'group') return false;
    const power = effectivePower(r, { cfg: rules.resolution, attached: attachedTo(state, r.id) }).total;
    return canDeploy(r, 1, power, rules.resolution).ok && !isOccupied(state, r.id);
  });
}

// ---------------------------------------------------------------- new game

function castleFromSeed(c: CastleSeed): CastleState {
  return {
    treasury: c.treasury,
    incomePerTurn: c.incomePerTurn,
    showTreasuryOnTable: c.showTreasuryOnTable,
    facilities: Object.fromEntries(c.facilities.map((f) => [f.id, f.level])),
    entertainersTurnsLeft: 0,
    casksServed: 0,
    training: [],
    treatments: [],
    recruits: {},
    projects: [],
    nextMilitiaSerial: 1,
  };
}

/** A fresh session: seed data plus the initial portals (deployable resources + 1d6). */
export function newGame(seed: Seed, rules: Rules, rngSeed: number): GameState {
  const rng = new Rng(rngSeed);
  const events: EventsState = {
    turn: 1,
    portals: [],
    temples: seed.temples.map(templeFromSeed),
    civilianDeaths: 0,
    nextPortalSerial: 1,
  };
  const state: GameState = {
    version: GAME_STATE_VERSION,
    rngState: rng.state,
    commanderId: null,
    commanderTurn: null,
    commandSway: null,
    commanderInfluence: {},
    resources: resourcesFromSeed(seed.resources),
    events,
    castle: castleFromSeed(seed.castle),
    log: [],
  };
  const count = initialPortalCount(deployableHosts(state, rules).length, rng, rules.events);
  const seeded = seedPortals(events, count, rules.map, rng, rules.events);
  return { ...state, events: seeded.state, rngState: rng.state };
}
