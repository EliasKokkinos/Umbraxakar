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
  it('seeds deployable resources + 1d6 portals on turn 1', () => {
    const s = game();
    const deployable = deployableHosts(s, RULES).length;
    expect(deployable).toBe(23); // 11 heroes + 12 groups
    expect(s.events.portals.length).toBeGreaterThanOrEqual(deployable + 1);
    expect(s.events.portals.length).toBeLessThanOrEqual(deployable + 6);
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

  it('sends a card to an event and brings it home', () => {
    let s = unwrap(assign(game(), 'karsa-orlong', portalId(game()), RULES));
    expect(eventOf(s, 'karsa-orlong')?.id).toBe(portalId(s));
    s = unwrap(unassign(s, 'karsa-orlong'));
    expect(eventOf(s, 'karsa-orlong')).toBeUndefined();
  });

  it('refuses locked, refusing, doubly-assigned and closed-portal assignments', () => {
    const s = game();
    expect(assign(s, 'anomander-rake', portalId(s), RULES)).toEqual({ ok: false, error: 'Anomander Rake: Not yet resurrected.' });
    expect(assign(withResource(s, 'uruk', { morale: 1 }), 'uruk', portalId(s), RULES)).toEqual({ ok: false, error: 'Uruk: Refuses' });

    const placed = unwrap(assign(s, 'uruk', portalId(s), RULES));
    expect(assign(placed, 'uruk', portalId(s, 1), RULES).ok).toBe(false);

    const closed: GameState = {
      ...s,
      events: { ...s.events, portals: s.events.portals.map((p, i) => (i === 0 ? { ...p, status: 'closed' } : p)) },
    };
    expect(assign(closed, 'uruk', portalId(s), RULES)).toEqual({ ok: false, error: 'That portal is closed' });
  });

  it('only activates discovered, dormant temples', () => {
    const s = game();
    expect(assign(s, 'korlat', 'temple-jhag-odhan', RULES).ok).toBe(false); // already active
    expect(assign(s, 'korlat', 'temple-15', RULES).ok).toBe(false); // undiscovered
  });

  it('keeps resources that fought and lost pinned, but not later reinforcements', () => {
    const s0 = unwrap(assign(game(), 'trull-sengar', portalId(game()), RULES));
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
              cardPowers: [{ resourceId: 'trull-sengar', power: { total: 5, parts: [] } }],
              eventPower: 5,
              supportBonus: 0,
              target: 10,
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
    expect(unassign(lost, 'trull-sengar')).toEqual({ ok: false, error: 'Resources that lost a battle remain at the event' });
    const reinforced = unwrap(assign(lost, 'uruk', id, RULES));
    expect(unassign(reinforced, 'uruk').ok).toBe(true);
  });
});

describe('attach / detach', () => {
  it('attaches up to three heroes, who then travel with the card', () => {
    let s = game();
    for (const h of ['blues', 'cowl', 'shimmer']) s = unwrap(attach(s, h, 'avowed-prince'));
    expect(attach(s, 'korlat', 'avowed-prince')).toEqual({ ok: false, error: 'Avowed: The Prince\'s Company already has 3 heroes' });

    s = unwrap(assign(s, 'avowed-prince', s.events.portals[0].id, RULES));
    expect(eventOf(s, 'blues')?.id).toBe(s.events.portals[0].id);
    expect(assign(s, 'blues', s.events.portals[1].id, RULES).ok).toBe(false);
    expect(detach(s, 'blues').ok).toBe(false);
  });

  it('refuses nesting, self-attachment and locked heroes', () => {
    let s = unwrap(attach(game(), 'blues', 'karsa-orlong'));
    expect(attach(s, 'cowl', 'blues').ok).toBe(false); // blues is itself attached
    expect(attach(s, 'karsa-orlong', 'uruk').ok).toBe(false); // karsa leads a card
    expect(attach(s, 'uruk', 'uruk').ok).toBe(false);
    expect(attach(s, 'anomander-rake', 'uruk').ok).toBe(false);
    s = unwrap(detach(s, 'blues'));
    expect(s.resources.find((r) => r.id === 'blues')!.attachedTo).toBeNull();
  });
});
