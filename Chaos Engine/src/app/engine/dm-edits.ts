// DM-only corrections: the DM can alter anything, within the rule ranges.
import { EventState, PortalState, TempleState } from './event-state';
import { AURA_RADIUS_RANGE, makePortal, seedPortals } from './events';
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

/** What the DM fills in to bring a new hero, avatar or group into the game. */
export interface NewResourceSpec {
  kind: 'hero' | 'avatar' | 'group';
  name: string;
  faction: string;
  power: number;
  morale: number;
  /** Heroes and avatars. */
  injuryResistance?: number;
  /** Groups. */
  number?: number;
  decimationResistance?: number;
  replenishable?: boolean;
  canCleanse: boolean;
  tisteAndii: boolean;
  healer: boolean;
  /** Kept off the table until the DM unlocks it. */
  hidden: boolean;
  notes: string;
}

/**
 * A readable, unique id from a name ("Captain Luke" -> "captain-luke"). It is safe as a
 * portrait key and never clashes with a resource, event or commander.
 */
export function newResourceId(state: GameState, name: string, rules: Rules): string {
  const slug =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'resource';
  const taken = new Set([
    ...state.resources.map((r) => r.id),
    ...state.events.portals.map((p) => p.id),
    ...state.events.temples.map((t) => t.id),
    ...rules.commanders.map((c) => c.id),
  ]);
  if (!taken.has(slug)) return slug;
  let n = 2;
  while (taken.has(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}

/** Brings a new resource into the game, at the castle. */
export function createResource(state: GameState, spec: NewResourceSpec, rules: Rules): Result {
  const name = spec.name.trim();
  if (!name) return fail('A new resource needs a name');
  const tags = [
    ...(spec.tisteAndii ? [rules.events.temple.bonusTag] : []),
    ...(spec.healer && spec.kind !== 'group' ? ['healer'] : []),
  ];
  const base = {
    id: newResourceId(state, name, rules),
    name,
    faction: spec.faction.trim() || 'Iron Company',
    power: clamp(Math.round(spec.power), 1, 10),
    morale: clamp(Math.round(spec.morale), 1, 5),
    tags,
    canCleanse: spec.canCleanse,
    locked: spec.hidden,
    lockReason: spec.hidden ? 'Not yet revealed to the table' : undefined,
    traits: [],
    notes: spec.notes.trim(),
    attachedTo: null,
    trainingBonus: 0,
    trainingTurnsLeft: 0,
  };
  let resource: ResourceState;
  if (spec.kind === 'group') {
    const number = Math.max(1, Math.round(spec.number ?? 100));
    resource = {
      ...base,
      kind: 'group',
      number,
      maxNumber: number,
      injured: 0,
      replenishable: spec.replenishable ?? true,
      decimationResistance: clamp(Math.round(spec.decimationResistance ?? 3), 1, 5),
      forged: false,
    };
  } else {
    resource = {
      ...base,
      kind: spec.kind,
      injuryResistance: clamp(Math.round(spec.injuryResistance ?? 3), 1, 5),
      injuries: [],
      fallen: false,
    };
  }
  return addResource(state, resource);
}

/**
 * Takes a resource out of the game entirely: called home from any event, its attached heroes
 * freed, and any castle work on it dropped.
 */
export function removeResource(state: GameState, id: string): Result {
  if (!resourceById(state, id)) return fail(`No resource ${id}`);
  const s = withoutAssignment(state, id);
  const c = s.castle;
  const { [id]: _recruits, ...recruits } = c.recruits;
  const commanderInfluence = Object.fromEntries(
    Object.entries(s.commanderInfluence).map(([c, list]) => [c, list.filter((i) => i.resourceId !== id)]),
  );
  return ok({
    ...s,
    commanderInfluence,
    resources: s.resources.filter((r) => r.id !== id).map((r) => (r.attachedTo === id ? { ...r, attachedTo: null } : r)),
    castle: {
      ...c,
      training: c.training.filter((t) => t !== id),
      treatments: c.treatments.filter((t) => t.resourceId !== id),
      recruits,
      projects: c.projects.filter((p) => !(p.kind === 'forge' && p.groupId === id)),
    },
  });
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

/** The reach of every Mother Dark temple, as a share of the map's width; null restores the config's. */
export function setAuraRadius(state: GameState, radius: number | null): Result {
  if (radius !== null && !Number.isFinite(radius)) return fail('The reach must be a number');
  const next = radius === null ? null : clamp(Math.round(radius * 1000) / 1000, AURA_RADIUS_RANGE[0], AURA_RADIUS_RANGE[1]);
  return ok({ ...state, events: { ...state.events, auraRadius: next } });
}
