import {
  EventBattle,
  casualties,
  corruptionCap,
  growCorruption,
  inTempleAura,
  initialPortalCount,
  portalOutcome,
  runEventPhase,
  seedPortals,
} from './events';
import { inRect, mapDistance } from './geometry';
import { Rng } from './rng';
import { EVENTS_CFG, MAP, REGION_LAND, ScriptedRng, eventsState, face, portal } from './testing';

const CFG = EVENTS_CFG;
const JHAG_ODHAN = { x: 0.469, y: 0.285 };

describe('temple aura', () => {
  const temples = eventsState().temples;

  it('covers points near an active temple', () => {
    expect(inTempleAura({ x: JHAG_ODHAN.x + 0.03, y: JHAG_ODHAN.y }, temples, CFG, MAP)).toBe(true);
    expect(inTempleAura({ x: JHAG_ODHAN.x + 0.1, y: JHAG_ODHAN.y }, temples, CFG, MAP)).toBe(false);
  });

  it('ignores dormant temples', () => {
    const assail = temples.find((t) => t.id === 'temple-15')!;
    expect(assail.active).toBe(false);
    expect(inTempleAura(assail.position, temples, CFG, MAP)).toBe(false);
    expect(inTempleAura(assail.position, [{ ...assail, active: true }], CFG, MAP)).toBe(true);
  });

  it('caps corruption at 2 in the aura and 5 elsewhere', () => {
    expect(corruptionCap(JHAG_ODHAN, temples, CFG, MAP)).toBe(2);
    expect(corruptionCap({ x: 0.45, y: 0.8 }, temples, CFG, MAP)).toBe(5);
  });
});

describe('seedPortals', () => {
  it('opens portals on land, outside no-spawn zones, spaced apart', () => {
    const { state, created, unplaced } = seedPortals(eventsState(), 30, REGION_LAND, new Rng(11), CFG);
    expect(created).toHaveLength(30);
    expect(unplaced).toBe(0);
    expect(state.portals).toHaveLength(30);
    expect(state.nextPortalSerial).toBe(31);

    const aspect = MAP.height / MAP.width;
    const points = [...created.map((p) => p.position), ...state.temples.map((t) => t.position)];
    for (const p of created) {
      expect(REGION_LAND.isLand(p.position)).toBe(true);
      expect(MAP.noSpawnZones.some((z) => inRect(p.position, z))).toBe(false);
      expect(p.difficulty).toBeGreaterThanOrEqual(1);
      expect(p.difficulty).toBeLessThanOrEqual(5);
      expect(p.impact).toBeGreaterThanOrEqual(1);
      expect(p.impact).toBeLessThanOrEqual(10);
      expect(p.corruption).toBe(p.corruption === 2 ? 2 : 1);
      expect(p.name).toMatch(/^The \w+ \w+ of .+$/);
      const nearest = Math.min(...points.filter((o) => o !== p.position).map((o) => mapDistance(p.position, o, aspect)));
      expect(nearest).toBeGreaterThanOrEqual(CFG.portal.minSpacing);
    }
  });

  it('reports portals it could not place', () => {
    const noLand = { map: MAP, isLand: () => false };
    const { created, unplaced } = seedPortals(eventsState(), 3, noLand, new Rng(1), CFG);
    expect(created).toHaveLength(0);
    expect(unplaced).toBe(3);
  });

  it('is deterministic for the same seed', () => {
    const a = seedPortals(eventsState(), 10, REGION_LAND, new Rng(5), CFG).created;
    const b = seedPortals(eventsState(), 10, REGION_LAND, new Rng(5), CFG).created;
    expect(a).toEqual(b);
  });
});

describe('initialPortalCount', () => {
  it('is deployable resources + 1d6', () => {
    expect(initialPortalCount(24, new ScriptedRng([face(4, 6)]), CFG)).toBe(28);
  });
});

describe('portalOutcome', () => {
  const won: EventBattle = { outcome: 'won', cleanser: false };

  it('is unopposed with no battle, lost on a loss', () => {
    expect(portalOutcome(portal(), undefined, CFG)).toBe('unopposed');
    expect(portalOutcome(portal(), { outcome: 'lost', cleanser: true }, CFG)).toBe('lost');
  });

  it('closes shallow portals on a win', () => {
    expect(portalOutcome(portal({ corruption: 2 }), won, CFG)).toBe('won');
  });

  it('only contains deep portals (3+) without a cleanser', () => {
    expect(portalOutcome(portal({ corruption: 3 }), won, CFG)).toBe('contained');
    expect(portalOutcome(portal({ corruption: 3 }), { outcome: 'won', cleanser: true }, CFG)).toBe('won');
  });
});

describe('casualties', () => {
  // variance = 0.5 + next() × 1.0, so next() = 0.5 gives exactly 1.0.
  it('is impact × 100 × variance; half on a loss; none when held', () => {
    expect(casualties(portal({ impact: 5 }), 'unopposed', new ScriptedRng([0.5]), CFG)).toBe(500);
    expect(casualties(portal({ impact: 5 }), 'lost', new ScriptedRng([0.5]), CFG)).toBe(250);
    expect(casualties(portal({ impact: 10 }), 'unopposed', new ScriptedRng([0]), CFG)).toBe(500);
    expect(casualties(portal(), 'won', new Rng(1), CFG)).toBe(0);
    expect(casualties(portal(), 'contained', new Rng(1), CFG)).toBe(0);
  });
});

describe('growCorruption', () => {
  it('grows by 1, but not where the battle was won or contained', () => {
    expect(growCorruption(portal({ corruption: 2 }), 'unopposed', 5, CFG).corruption).toBe(3);
    expect(growCorruption(portal({ corruption: 2 }), 'lost', 5, CFG).corruption).toBe(3);
    expect(growCorruption(portal({ corruption: 3 }), 'contained', 5, CFG).corruption).toBe(3);
  });

  it('is capped by a temple aura, pulling higher portals down', () => {
    expect(growCorruption(portal({ corruption: 2 }), 'unopposed', 2, CFG).corruption).toBe(2);
    expect(growCorruption(portal({ corruption: 4 }), 'contained', 2, CFG).corruption).toBe(2);
  });

  it('spawns a legendary at 5: difficulty becomes 10', () => {
    const p = growCorruption(portal({ corruption: 4, difficulty: 6 }), 'unopposed', 5, CFG);
    expect([p.corruption, p.legendary, p.difficulty]).toEqual([5, true, 10]);
    const again = growCorruption({ ...p, difficulty: 8 }, 'unopposed', 5, CFG);
    expect([again.corruption, again.difficulty]).toEqual([5, 8]);
  });
});

describe('runEventPhase', () => {
  const setup = () => {
    const base = eventsState({ turn: 3, civilianDeaths: 1000 });
    const dormant = base.temples.find((t) => t.id === 'temple-08')!;
    return eventsState({
      turn: 3,
      civilianDeaths: 1000,
      temples: base.temples.map((t) => (t.id === dormant.id ? { ...t, discovered: true, hidden: false, assigned: ['korlat'] } : t)),
      portals: [
        portal({ id: 'p-unopposed', impact: 4 }),
        portal({ id: 'p-shallow-win', corruption: 2, assigned: ['karsa-orlong'], position: { x: 0.45, y: 0.7 } }),
        portal({ id: 'p-deep-held', corruption: 3, assigned: ['uruk'], position: { x: 0.2, y: 0.9 } }),
        portal({ id: 'p-lost', corruption: 4, impact: 2, assigned: ['trull-sengar'], position: { x: 0.9, y: 0.9 } }),
        // Near temple-08, which activates this turn.
        portal({ id: 'p-near-temple', corruption: 4, position: { x: 0.41, y: 0.33 } }),
      ],
    });
  };
  const battles: Record<string, EventBattle> = {
    'p-shallow-win': { outcome: 'won', cleanser: false },
    'p-deep-held': { outcome: 'won', cleanser: false },
    'p-lost': { outcome: 'lost', cleanser: false },
    'temple-08': { outcome: 'won', cleanser: false },
  };

  it('applies outcomes, losses, corruption, temples and new portals', () => {
    const { state, report } = runEventPhase(setup(), battles, REGION_LAND, new Rng(21), CFG);
    const byId = Object.fromEntries(state.portals.map((p) => [p.id, p]));

    expect(report.closed).toEqual(['p-shallow-win']);
    expect(byId['p-shallow-win'].status).toBe('closed');
    expect(byId['p-shallow-win'].assigned).toEqual([]);

    expect(report.contained).toEqual(['p-deep-held']);
    expect(byId['p-deep-held']).toMatchObject({ status: 'open', corruption: 3, assigned: [], lastOutcome: 'contained' });

    expect(byId['p-lost']).toMatchObject({ corruption: 5, legendary: true, difficulty: 10, assigned: ['trull-sengar'] });
    expect(report.legendarySpawns).toEqual(['p-lost']);

    expect(byId['p-unopposed']).toMatchObject({ corruption: 2, lastOutcome: 'unopposed' });

    expect(report.activatedTemples).toEqual(['temple-08']);
    expect(state.temples.find((t) => t.id === 'temple-08')!.active).toBe(true);
    expect(byId['p-near-temple'].corruption).toBe(2);

    const lost = Object.values(report.casualtiesByPortal).reduce((a, b) => a + b, 0);
    expect(Object.keys(report.casualtiesByPortal).sort()).toEqual(['p-lost', 'p-near-temple', 'p-unopposed']);
    expect(state.civilianDeaths).toBe(1000 + lost);

    expect(state.turn).toBe(4);
    expect(report.newPortals.length).toBeGreaterThanOrEqual(1);
    expect(report.newPortals.length).toBeLessThanOrEqual(3);
    const fresh = state.portals.filter((p) => report.newPortals.includes(p.id));
    expect(fresh.every((p) => p.createdTurn === 4)).toBe(true);
  });

  it('does not mutate its input and is deterministic', () => {
    const input = setup();
    const snapshot = structuredClone(input);
    const a = runEventPhase(input, battles, REGION_LAND, new Rng(21), CFG);
    const b = runEventPhase(input, battles, REGION_LAND, new Rng(21), CFG);
    expect(input).toEqual(snapshot);
    expect(a).toEqual(b);
  });
});
