import { rollExpression } from './dice';
import { EventOutcome, EventsState, PortalState, TempleState } from './event-state';
import { inRect, mapDistance, regionAt } from './geometry';
import { LandTest } from './land';
import { Rng } from './rng';
import { EventsConfig, MapDef, Point } from './seed-types';

export interface MapContext {
  map: MapDef;
  isLand: LandTest;
}

const aspectOf = (map: MapDef) => map.height / map.width;
const MAX_PLACEMENT_ATTEMPTS = 500;

// ---------------------------------------------------------------- temple aura

export function activeTemplesCovering(p: Point, temples: TempleState[], cfg: EventsConfig, map: MapDef): TempleState[] {
  const aspect = aspectOf(map);
  return temples.filter((t) => t.active && mapDistance(p, t.position, aspect) <= cfg.temple.auraRadius);
}

export function inTempleAura(p: Point, temples: TempleState[], cfg: EventsConfig, map: MapDef): boolean {
  return activeTemplesCovering(p, temples, cfg, map).length > 0;
}

/** Highest corruption a portal at this position may reach. */
export function corruptionCap(p: Point, temples: TempleState[], cfg: EventsConfig, map: MapDef): number {
  return inTempleAura(p, temples, cfg, map) ? cfg.temple.corruptionCapInAura : cfg.portal.maxCorruption;
}

// ---------------------------------------------------------------- seeding

export function portalName(regionName: string | null, rng: Rng, cfg: EventsConfig): string {
  const { descriptors, nouns } = cfg.portalNames;
  const d = descriptors[rng.int(0, descriptors.length - 1)];
  const n = nouns[rng.int(0, nouns.length - 1)];
  return `${d} ${n} of ${regionName ?? 'the Wastes'}`;
}

/** A random valid spawn point, or null if none was found. */
export function findSpawnPoint(occupied: Point[], ctx: MapContext, rng: Rng, cfg: EventsConfig): Point | null {
  const aspect = aspectOf(ctx.map);
  for (let i = 0; i < MAX_PLACEMENT_ATTEMPTS; i++) {
    const p = { x: rng.next(), y: rng.next() };
    if (ctx.map.noSpawnZones.some((z) => inRect(p, z))) continue;
    if (occupied.some((o) => mapDistance(p, o, aspect) < cfg.portal.minSpacing)) continue;
    if (!ctx.isLand(p)) continue;
    return p;
  }
  return null;
}

export interface SeedResult {
  state: EventsState;
  created: PortalState[];
  /** Portals requested but not placed (the map ran out of valid space). */
  unplaced: number;
}

/** A fresh portal at a position, with seeded difficulty, impact and name. */
export function makePortal(id: string, position: Point, state: EventsState, ctx: MapContext, rng: Rng, cfg: EventsConfig): PortalState {
  const region = regionAt(position, ctx.map.regions);
  const [dLo, dHi] = cfg.portal.difficultySeedRange;
  const [iLo, iHi] = cfg.portal.impactSeedRange;
  return {
    id,
    type: 'chaos-portal',
    name: portalName(region?.name ?? null, rng, cfg),
    position,
    regionId: region?.id ?? null,
    hidden: false,
    assigned: [],
    dmNotes: '',
    createdTurn: state.turn,
    lastOutcome: null,
    corruption: Math.min(cfg.portal.startingCorruption, corruptionCap(position, state.temples, cfg, ctx.map)),
    difficulty: rng.int(dLo, dHi),
    impact: rng.int(iLo, iHi),
    legendary: false,
    status: 'open',
  };
}

/** Opens `count` new portals at random land positions. */
export function seedPortals(state: EventsState, count: number, ctx: MapContext, rng: Rng, cfg: EventsConfig): SeedResult {
  const occupied: Point[] = [
    ...state.temples.map((t) => t.position),
    ...state.portals.filter((p) => p.status === 'open').map((p) => p.position),
  ];
  const created: PortalState[] = [];
  let serial = state.nextPortalSerial;

  for (let i = 0; i < count; i++) {
    const position = findSpawnPoint(occupied, ctx, rng, cfg);
    if (!position) break;
    occupied.push(position);
    created.push(makePortal(`portal-${serial++}`, position, state, ctx, rng, cfg));
  }

  return {
    state: { ...state, portals: [...state.portals, ...created], nextPortalSerial: serial },
    created,
    unplaced: count - created.length,
  };
}

export function initialPortalCount(deployableResources: number, rng: Rng, cfg: EventsConfig): number {
  return Math.max(0, rollExpression(cfg.portal.initialSeed, rng, { deployableResources }));
}

export function newPortalsThisRound(rng: Rng, cfg: EventsConfig): number {
  return Math.max(0, rollExpression(cfg.portal.newPortalsPerRound, rng));
}

// ---------------------------------------------------------------- end of turn

/** Result of battle resolution at one event, supplied by the resolution phase. */
export interface EventBattle {
  outcome: 'won' | 'lost';
  /** A resource with canCleanse was on the winning side. */
  cleanser: boolean;
}

export function casualties(portal: PortalState, outcome: EventOutcome, rng: Rng, cfg: EventsConfig): number {
  if (outcome === 'won' || outcome === 'contained') return 0;
  const [lo, hi] = cfg.portal.casualtyVariance;
  const factor = outcome === 'lost' ? cfg.portal.lostBattleCasualtyFactor : 1;
  const variance = lo + rng.next() * (hi - lo);
  return Math.round(portal.impact * cfg.portal.civiliansPerImpact * variance * factor);
}

/** What a battle result means for a portal: closed, held, or not. */
export function portalOutcome(portal: PortalState, battle: EventBattle | undefined, cfg: EventsConfig): EventOutcome {
  if (!battle) return 'unopposed';
  if (battle.outcome === 'lost') return 'lost';
  const deep = portal.corruption >= cfg.portal.deepCorruptionThreshold;
  return deep && !battle.cleanser ? 'contained' : 'won';
}

export function growCorruption(portal: PortalState, outcome: EventOutcome, cap: number, cfg: EventsConfig): PortalState {
  const halted = cfg.portal.wonBattleHaltsCorruption && (outcome === 'won' || outcome === 'contained');
  const grown = halted ? portal.corruption : portal.corruption + cfg.portal.corruptionPerRound;
  // Clamping also pulls portals down to the cap when a temple activates nearby.
  const corruption = Math.min(grown, cap, cfg.portal.maxCorruption);
  const becomesLegendary = !portal.legendary && corruption >= cfg.portal.legendaryAtCorruption;
  return {
    ...portal,
    corruption,
    legendary: portal.legendary || becomesLegendary,
    difficulty: becomesLegendary ? cfg.portal.maxDifficultyLegendary : portal.difficulty,
  };
}

export interface EventPhaseReport {
  closed: string[];
  contained: string[];
  activatedTemples: string[];
  legendarySpawns: string[];
  casualtiesByPortal: Record<string, number>;
  newPortals: string[];
  unplacedPortals: number;
}

/**
 * Event side of the end-of-turn pipeline (docs/events-model.md §5, steps 2–7):
 * outcomes → civilian losses → corruption and temple cap → legendary spawns → new portals → turn advance.
 */
export function runEventPhase(
  state: EventsState,
  battles: Record<string, EventBattle>,
  ctx: MapContext,
  rng: Rng,
  cfg: EventsConfig,
): { state: EventsState; report: EventPhaseReport } {
  const report: EventPhaseReport = {
    closed: [],
    contained: [],
    activatedTemples: [],
    legendarySpawns: [],
    casualtiesByPortal: {},
    newPortals: [],
    unplacedPortals: 0,
  };

  // 2a. Temples: a won activation battle lights the temple.
  const temples = state.temples.map((t): TempleState => {
    const b = battles[t.id];
    if (!b) return t;
    if (b.outcome === 'won' && !t.active && t.discovered) {
      report.activatedTemples.push(t.id);
      return { ...t, active: true, assigned: [], lastOutcome: 'won' };
    }
    return { ...t, lastOutcome: b.outcome };
  });

  // 2b–5. Portals, evaluated against the updated temples so a new aura caps corruption at once.
  let civilianDeaths = state.civilianDeaths;
  const portals = state.portals.map((p): PortalState => {
    if (p.status === 'closed') return p;
    const outcome = portalOutcome(p, battles[p.id], cfg);

    if (outcome === 'won') {
      report.closed.push(p.id);
      return { ...p, status: 'closed', assigned: [], lastOutcome: 'won' };
    }
    // Contained: the win sends the resources home; the players choose whether to go back.
    if (outcome === 'contained') report.contained.push(p.id);
    const assigned = outcome === 'contained' ? [] : p.assigned;

    const lost = casualties(p, outcome, rng, cfg);
    if (lost > 0) report.casualtiesByPortal[p.id] = lost;
    civilianDeaths += lost;

    const grown = growCorruption(p, outcome, corruptionCap(p.position, temples, cfg, ctx.map), cfg);
    if (grown.legendary && !p.legendary) report.legendarySpawns.push(p.id);
    return { ...grown, assigned, lastOutcome: outcome };
  });

  // 7 then 6: three days pass, and the new portals open into the coming turn.
  const seeded = seedPortals(
    { ...state, turn: state.turn + 1, temples, portals, civilianDeaths },
    newPortalsThisRound(rng, cfg),
    ctx,
    rng,
    cfg,
  );
  report.newPortals = seeded.created.map((p) => p.id);
  report.unplacedPortals = seeded.unplaced;

  return { state: seeded.state, report };
}
