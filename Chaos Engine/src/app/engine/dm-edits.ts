// DM-only corrections: the DM can alter anything, within the rule ranges.
import { EventState, PortalState, TempleState } from './event-state';
import { makePortal, seedPortals } from './events';
import { GameState, Result, Rules, eventById, fail, ok, resourceById } from './game-state';
import { regionAt } from './geometry';
import { Injury, ResourceState } from './resource-state';
import { Rng } from './rng';
import { Point } from './seed-types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export type ResourcePatch = Partial<
  Pick<
    ResourceState,
    'name' | 'faction' | 'power' | 'morale' | 'tags' | 'canCleanse' | 'locked' | 'lockReason' | 'notes' | 'traits'
  > & { number: number; maxNumber: number; injured: number; replenishable: boolean; decimationResistance: number; injuryResistance: number; fallen: boolean; injuries: Injury[] }
>;

export function updateResource(state: GameState, id: string, patch: ResourcePatch): Result {
  const r = resourceById(state, id);
  if (!r) return fail(`No resource ${id}`);
  const next = { ...r, ...patch } as ResourceState;
  next.power = clamp(next.power, 1, 10);
  next.morale = clamp(next.morale, 1, 5);
  if (next.kind === 'group') {
    next.maxNumber = Math.max(1, next.maxNumber);
    next.number = clamp(next.number, 0, next.maxNumber);
    next.injured = clamp(next.injured, 0, next.number);
    next.decimationResistance = clamp(next.decimationResistance, 1, 5);
  } else {
    next.injuryResistance = clamp(next.injuryResistance, 1, 5);
  }
  // A resource locked away cannot remain in the field.
  let s: GameState = { ...state, resources: state.resources.map((x) => (x.id === id ? next : x)) };
  if (next.locked && !r.locked) s = withoutAssignment(s, id);
  return ok(s);
}

export function addResource(state: GameState, resource: ResourceState): Result {
  if (resourceById(state, resource.id)) return fail(`A resource with id ${resource.id} already exists`);
  return ok({ ...state, resources: [...state.resources, resource] });
}

function withoutAssignment(state: GameState, hostId: string): GameState {
  const drop = <T extends EventState>(e: T): T => ({ ...e, assigned: e.assigned.filter((id) => id !== hostId) });
  return { ...state, events: { ...state.events, portals: state.events.portals.map(drop), temples: state.events.temples.map(drop) } };
}

function replaceEvent(state: GameState, next: EventState): GameState {
  return {
    ...state,
    events: {
      ...state.events,
      portals: state.events.portals.map((p) => (p.id === next.id ? (next as PortalState) : p)),
      temples: state.events.temples.map((t) => (t.id === next.id ? (next as TempleState) : t)),
    },
  };
}

export type PortalPatch = Partial<Pick<PortalState, 'name' | 'corruption' | 'difficulty' | 'impact' | 'legendary' | 'hidden' | 'dmNotes' | 'status'>>;
export type TemplePatch = Partial<Pick<TempleState, 'name' | 'active' | 'discovered' | 'activationDifficulty' | 'hidden' | 'dmNotes'>>;

export function updatePortal(state: GameState, id: string, patch: PortalPatch, rules: Rules): Result {
  const p = eventById(state, id);
  if (!p || p.type !== 'chaos-portal') return fail(`No portal ${id}`);
  const cfg = rules.events.portal;
  const next: PortalState = { ...p, ...patch };
  next.corruption = clamp(next.corruption, 1, cfg.maxCorruption);
  next.difficulty = clamp(next.difficulty, 1, next.legendary ? cfg.maxDifficultyLegendary : cfg.maxDifficulty);
  next.impact = clamp(next.impact, 0, cfg.maxImpact);
  if (next.status === 'closed') next.assigned = [];
  return ok(replaceEvent(state, next));
}

export function updateTemple(state: GameState, id: string, patch: TemplePatch, rules: Rules): Result {
  const t = eventById(state, id);
  if (!t || t.type !== 'mother-dark-temple') return fail(`No temple ${id}`);
  const next: TempleState = { ...t, ...patch };
  next.activationDifficulty = clamp(next.activationDifficulty, 1, rules.events.portal.maxDifficulty);
  // An active temple is known to everyone.
  if (next.active) next.discovered = true;
  if (patch.discovered && patch.hidden === undefined) next.hidden = false;
  return ok(replaceEvent(state, next));
}

export function moveEvent(state: GameState, id: string, position: Point, rules: Rules): Result {
  const e = eventById(state, id);
  if (!e) return fail(`No event ${id}`);
  const p = { x: clamp(position.x, 0, 1), y: clamp(position.y, 0, 1) };
  const region = regionAt(p, rules.map.map.regions);
  return ok(replaceEvent(state, { ...e, position: p, regionId: region?.id ?? null }));
}

/** Opens a portal: at a chosen position, or at a random land position when none is given. */
export function addPortal(state: GameState, rules: Rules, position?: Point): Result {
  const rng = new Rng(state.rngState);
  if (!position) {
    const seeded = seedPortals(state.events, 1, rules.map, rng, rules.events);
    if (!seeded.created.length) return fail('No room on the map for another portal');
    return ok({ ...state, events: seeded.state, rngState: rng.state });
  }
  const p = { x: clamp(position.x, 0, 1), y: clamp(position.y, 0, 1) };
  const portal = makePortal(`portal-${state.events.nextPortalSerial}`, p, state.events, rules.map, rng, rules.events);
  return ok({
    ...state,
    rngState: rng.state,
    events: { ...state.events, portals: [...state.events.portals, portal], nextPortalSerial: state.events.nextPortalSerial + 1 },
  });
}

/** Seeds several random portals at once (the DM's "seed more"). */
export function seedMorePortals(state: GameState, count: number, rules: Rules): Result {
  const rng = new Rng(state.rngState);
  const seeded = seedPortals(state.events, count, rules.map, rng, rules.events);
  if (!seeded.created.length) return fail('No room on the map for more portals');
  return ok({ ...state, events: seeded.state, rngState: rng.state });
}

/** Removes an event; any cards there return to the castle. */
export function removeEvent(state: GameState, id: string): Result {
  if (!eventById(state, id)) return fail(`No event ${id}`);
  return ok({
    ...state,
    events: {
      ...state.events,
      portals: state.events.portals.filter((p) => p.id !== id),
      temples: state.events.temples.filter((t) => t.id !== id),
    },
  });
}

export function setCommander(state: GameState, commanderId: string | null): Result {
  return ok({ ...state, commanderId });
}

export function setTreasury(state: GameState, treasury: number, incomePerTurn = state.castle.incomePerTurn): Result {
  return ok({ ...state, castle: { ...state.castle, treasury: Math.max(0, Math.round(treasury)), incomePerTurn } });
}

export function setTreasuryVisibility(state: GameState, showTreasuryOnTable: boolean): Result {
  return ok({ ...state, castle: { ...state.castle, showTreasuryOnTable } });
}

export function setFacilityLevel(state: GameState, id: string, level: number): Result {
  if (!(id in state.castle.facilities)) return fail(`No facility ${id}`);
  return ok({ ...state, castle: { ...state.castle, facilities: { ...state.castle.facilities, [id]: clamp(level, 1, 3) } } });
}
