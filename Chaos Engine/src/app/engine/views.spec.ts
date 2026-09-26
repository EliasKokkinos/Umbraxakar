import { assign, attach } from './assignment';
import { GameState, Result, newGame } from './game-state';
import { dayOfTurn, eventOptionsFor, hostOptionsFor, resourceView } from './views';
import { RULES, SEED } from './testing';

const unwrap = (r: Result): GameState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const game = () => newGame(SEED, RULES, 55);
const view = (s: GameState, id: string) => resourceView(s, s.resources.find((r) => r.id === id)!, RULES);

describe('resourceView', () => {
  it('summarises a hero at the castle', () => {
    expect(view(game(), 'karsa-orlong')).toMatchObject({
      name: 'Karsa Orlong',
      kind: 'hero',
      morale: 4,
      status: null,
      location: { kind: 'castle' },
      power: { total: 8 },
    });
  });

  it('shows location, attached heroes and the Mother Dark bonus in the field', () => {
    let s = unwrap(attach(game(), 'korlat', 'bluerose-1'));
    // A portal inside Jhag Odhan's aura.
    const near = { ...s.events.portals[0], id: 'near', position: { x: 0.47, y: 0.29 }, assigned: [] };
    s = { ...s, events: { ...s.events, portals: [...s.events.portals, near] } };
    s = unwrap(assign(s, 'bluerose-1', 'near', RULES));
    const v = view(s, 'bluerose-1');
    expect(v.location).toEqual({ kind: 'event', id: 'near', name: near.name });
    expect(v.attached).toEqual([{ id: 'korlat', name: 'Korlat' }]);
    expect(v.power.parts.map((p) => p.label)).toEqual(['Base', 'Attached heroes', 'Mother Dark']);
    // Bluerose 6, Korlat (7 + 3 near the temple = 10) lends +4, Mother Dark +3.
    expect(v.power.total).toBe(13);
  });

  it('reports the status that matters most', () => {
    expect(view(game(), 'anomander-rake').status).toBe('Locked');
    const s = game();
    const low = { ...s, resources: s.resources.map((r) => (r.id === 'uruk' ? { ...r, morale: 1 } : r)) };
    expect(view(low, 'uruk').status).toBe('Refuses');
  });
});

describe('options', () => {
  it('lists open events for a card, hardest first, with reasons when blocked', () => {
    const s = game();
    const opts = eventOptionsFor(s, 'bridgeburners', RULES);
    expect(opts.length).toBe(s.events.portals.length);
    expect(eventOptionsFor(s, 'uruk', RULES)).toEqual([]); // heroes go with a group
    expect(opts[0].value).toBeGreaterThanOrEqual(opts[opts.length - 1].value);
    expect(eventOptionsFor(s, 'avowed-avernus', RULES).every((o) => !o.ok)).toBe(true);
  });

  it('lists cards for an event, available first, with where the others are', () => {
    let s = game();
    const [a, b] = s.events.portals;
    s = unwrap(assign(s, 'bridgeburners', a.id, RULES));
    const opts = hostOptionsFor(s, b.id, RULES);
    expect(opts[0].ok).toBe(true);
    expect(opts.every((o) => s.resources.find((r) => r.id === o.id)!.kind === 'group')).toBe(true);
    expect(opts.find((o) => o.id === 'bridgeburners')).toMatchObject({ ok: false, reason: `At ${a.name}` });
    expect(hostOptionsFor(s, a.id, RULES).some((o) => o.id === 'bridgeburners')).toBe(false);
  });
});

describe('dayOfTurn', () => {
  it('turns are three days', () => {
    expect([1, 2, 5].map((t) => dayOfTurn(t, 3))).toEqual([1, 4, 13]);
  });
});
