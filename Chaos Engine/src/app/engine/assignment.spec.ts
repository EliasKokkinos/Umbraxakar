import { assign, attach, detach, unassign } from './assignment';
import { GameState, Result, deployableHosts, eventOf, newGame } from './game-state';
import { RULES, SEED } from './testing';

const game = () => newGame(SEED, RULES, 1234);
const unwrap = (r: Result): GameState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const withResource = (s: GameState, id: string, patch: object): GameState => ({
  ...s,
  resources: s.resources.map((r) => (r.id === id ? { ...r, ...patch } : r)),
});

describe('newGame', () => {
  it('seeds deployable groups + 1d6 portals on turn 1', () => {
    const s = game();
    const deployable = deployableHosts(s, RULES);
    expect(deployable).toHaveLength(12); // the twelve groups not locked away
    expect(deployable.every((r) => r.kind === 'group')).toBe(true);
    expect(s.events.portals.length).toBeGreaterThanOrEqual(13);
    expect(s.events.portals.length).toBeLessThanOrEqual(18);
    expect(s.events.portals.every((p) => p.createdTurn === 1 && p.status === 'open')).toBe(true);
    expect(s.castle.treasury).toBe(200000);
    expect(s.events.temples.filter((t) => t.active)).toHaveLength(5);
  });

  it('is deterministic for a seed', () => {
    expect(newGame(SEED, RULES, 9)).toEqual(newGame(SEED, RULES, 9));
    expect(newGame(SEED, RULES, 9)).not.toEqual(newGame(SEED, RULES, 10));
  });
});

describe('assign / unassign', () => {
  const portalId = (s: GameState, i = 0) => s.events.portals[i].id;

  it('sends a group to an event and brings it home', () => {
    let s = unwrap(assign(game(), 'bridgeburners', portalId(game()), RULES));
    expect(eventOf(s, 'bridgeburners')?.id).toBe(portalId(s));
    s = unwrap(unassign(s, 'bridgeburners'));
    expect(eventOf(s, 'bridgeburners')).toBeUndefined();
  });

  it('never sends a hero alone: heroes take the field with a group', () => {
    const s = game();
    expect(assign(s, 'karsa-orlong', portalId(s), RULES)).toEqual({
      ok: false,
      error: 'Karsa Orlong takes the field with a group: attach them to one first',
    });
  });

  it('refuses locked, refusing, doubly-assigned and closed-portal assignments', () => {
    const s = game();
    expect(assign(s, 'avowed-avernus', portalId(s), RULES).ok).toBe(false); // locked in Avernus
    expect(assign(withResource(s, 'bridgeburners', { morale: 1 }), 'bridgeburners', portalId(s), RULES)).toEqual({
      ok: false,
      error: 'Bridgeburners: Refuses',
    });

    const placed = unwrap(assign(s, 'bridgeburners', portalId(s), RULES));
    expect(assign(placed, 'bridgeburners', portalId(s, 1), RULES).ok).toBe(false);

    const closed: GameState = {
      ...s,
      events: { ...s.events, portals: s.events.portals.map((p, i) => (i === 0 ? { ...p, status: 'closed' } : p)) },
    };
    expect(assign(closed, 'bridgeburners', portalId(s), RULES)).toEqual({ ok: false, error: 'That portal is closed' });
  });

  it('a hero who refuses holds their group back until detached', () => {
    let s = unwrap(attach(game(), 'uruk', 'bridgeburners'));
    s = withResource(s, 'uruk', { morale: 1 });
    expect(assign(s, 'bridgeburners', portalId(s), RULES)).toEqual({
      ok: false,
      error: 'Uruk: Refuses. Detach them to send Bridgeburners.',
    });
    s = unwrap(detach(s, 'uruk'));
    expect(assign(s, 'bridgeburners', portalId(s), RULES).ok).toBe(true);
  });

  it('only activates discovered, dormant temples', () => {
    const s = game();
    expect(assign(s, 'bluerose-1', 'temple-jhag-odhan', RULES).ok).toBe(false); // already active
    expect(assign(s, 'bluerose-1', 'temple-15', RULES).ok).toBe(false); // undiscovered
  });

  it('keeps groups that fought and lost pinned, but not later reinforcements', () => {
    const s0 = unwrap(assign(game(), 'letheri-army-1', portalId(game()), RULES));
    const id = portalId(s0);
    const lost: GameState = {
      ...s0,
      events: { ...s0.events, portals: s0.events.portals.map((p) => (p.id === id ? { ...p, lastOutcome: 'lost' } : p)) },
      log: [
        {
          turn: 1,
          commanderId: null,
          battles: {
            [id]: {
              cardPowers: [{ resourceId: 'letheri-army-1', power: { total: 3, parts: [] } }],
              eventPower: 3,
              supportBonus: 0,
              target: 12,
              d20: 3,
              outcome: 'lost',
              rout: false,
              heroicVictory: false,
              harm: [],
            },
          },
          events: { closed: [], contained: [], activatedTemples: [], legendarySpawns: [], casualtiesByPortal: {}, newPortals: [], unplacedPortals: 0 },
          civilianDeaths: 0,
          routed: [],
          completed: [],
        },
      ],
    };
    expect(unassign(lost, 'letheri-army-1')).toEqual({ ok: false, error: 'Resources that lost a battle remain at the event' });
    const reinforced = unwrap(assign(lost, 'bridgeburners', id, RULES));
    expect(unassign(reinforced, 'bridgeburners').ok).toBe(true);
  });
});

describe('attach / detach', () => {
  it('attaches up to three heroes, who then travel with the group', () => {
    let s = game();
    for (const h of ['blues', 'cowl', 'shimmer']) s = unwrap(attach(s, h, 'avowed-prince'));
    expect(attach(s, 'korlat', 'avowed-prince')).toEqual({ ok: false, error: "Avowed: The Prince's Company already has 3 heroes" });

    s = unwrap(assign(s, 'avowed-prince', s.events.portals[0].id, RULES));
    expect(eventOf(s, 'blues')?.id).toBe(s.events.portals[0].id);
    expect(assign(s, 'blues', s.events.portals[1].id, RULES).ok).toBe(false);
    expect(detach(s, 'blues').ok).toBe(false);
  });

  it('heroes join groups only: never another hero, never themselves', () => {
    const s = game();
    expect(attach(s, 'blues', 'karsa-orlong')).toEqual({ ok: false, error: 'Blues can only join a group' });
    expect(attach(s, 'uruk', 'uruk').ok).toBe(false);
    expect(attach(s, 'bridgeburners', 'avowed-prince')).toEqual({ ok: false, error: 'Only heroes can be attached' });
  });

  it('refuses locked heroes, and detaches cleanly at the castle', () => {
    let s = game();
    expect(attach(s, 'anomander-rake', 'bluerose-1').ok).toBe(false);
    s = unwrap(attach(s, 'korlat', 'bluerose-1'));
    s = unwrap(detach(s, 'korlat'));
    expect(s.resources.find((r) => r.id === 'korlat')!.attachedTo).toBeNull();
  });
});
