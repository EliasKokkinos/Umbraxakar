import { assign } from './assignment';
import {
  addPortal,
  addResource,
  createResource,
  newResourceId,
  removeResource,
  moveEvent,
  removeEvent,
  seedMorePortals,
  setFacilityLevel,
  setTreasury,
  updatePortal,
  updateResource,
  updateTemple,
} from './dm-edits';
import { GameState, Result, eventById, eventOf, newGame, resourceById } from './game-state';
import { PortalState, TempleState } from './event-state';
import { RULES, SEED, group } from './testing';
import { attach } from './assignment';
import { train } from './castle';
import { NewResourceSpec, setAuraRadius } from './dm-edits';
import { auraRadiusOf } from './events';
import { resourceView } from './views';

const unwrap = (r: Result): GameState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const game = () => newGame(SEED, RULES, 8);

describe('DM edits: resources', () => {
  it('edits any field, clamped to the rule ranges', () => {
    const s = unwrap(updateResource(game(), 'malazan-legion-1', { power: 14, morale: 0, number: 400, injured: 999 }));
    const g = resourceById(s, 'malazan-legion-1');
    expect(g).toMatchObject({ power: 10, morale: 1, number: 300, injured: 300 });
  });

  it('unlocks a resource (for example when D returns from Avernus)', () => {
    const s = unwrap(updateResource(game(), 'd-dhampir', { locked: false }));
    const withD = unwrap(attach(s, 'd-dhampir', 'avowed-prince'));
    expect(assign(withD, 'avowed-prince', s.events.portals[0].id, RULES).ok).toBe(true);
  });

  it('locking a deployed resource recalls it', () => {
    let s = unwrap(assign(game(), 'bridgeburners', game().events.portals[0].id, RULES));
    s = unwrap(updateResource(s, 'bridgeburners', { locked: true, lockReason: 'Recalled to Malaz' }));
    expect(eventOf(s, 'bridgeburners')).toBeUndefined();
  });

  it('adds new resources with unique ids', () => {
    const extra = { ...group('bridgeburners'), id: 'bridgeburners-2', name: 'Bridgeburners, Second Squad' };
    const s = unwrap(addResource(game(), extra));
    expect(resourceById(s, 'bridgeburners-2')).toBeDefined();
    expect(addResource(s, extra).ok).toBe(false);
  });
});

describe('DM edits: events', () => {
  it('edits portals within range; closing one sends its cards home', () => {
    let s = game();
    const id = s.events.portals[0].id;
    s = unwrap(updatePortal(s, id, { corruption: 9, difficulty: 12, impact: -3 }, RULES));
    expect(eventById(s, id)).toMatchObject({ corruption: 5, difficulty: 9, impact: 0 });
    s = unwrap(updatePortal(s, id, { legendary: true, difficulty: 12 }, RULES));
    expect((eventById(s, id) as PortalState).difficulty).toBe(10);

    s = unwrap(assign(s, 'bridgeburners', s.events.portals[1].id, RULES));
    s = unwrap(updatePortal(s, s.events.portals[1].id, { status: 'closed' }, RULES));
    expect(eventOf(s, 'bridgeburners')).toBeUndefined();
  });

  it('reveals and activates temples', () => {
    let s = unwrap(updateTemple(game(), 'temple-15', { discovered: true }, RULES));
    expect(eventById(s, 'temple-15')).toMatchObject({ discovered: true, hidden: false, active: false });
    s = unwrap(updateTemple(s, 'temple-16', { active: true }, RULES));
    expect(eventById(s, 'temple-16')).toMatchObject({ active: true, discovered: true });
  });

  it('moves events and recomputes their region', () => {
    const s = unwrap(moveEvent(game(), 'temple-einhart-shrine', { x: 0.469, y: 0.3 }, RULES));
    expect(eventById(s, 'temple-einhart-shrine')).toMatchObject({ position: { x: 0.469, y: 0.3 }, regionId: 'seven-cities' });
    expect((eventById(unwrap(moveEvent(game(), 'temple-15', { x: 2, y: -1 }, RULES)), 'temple-15') as TempleState).position).toEqual({ x: 1, y: 0 });
  });

  it('adds portals at a chosen spot or at random, and seeds more', () => {
    const start = game();
    const n = start.events.portals.length;
    let s = unwrap(addPortal(start, RULES, { x: 0.5, y: 0.45 }));
    const placed = s.events.portals[n];
    expect(placed).toMatchObject({ id: `portal-${n + 1}`, position: { x: 0.5, y: 0.45 }, regionId: 'quon-tali' });
    s = unwrap(addPortal(s, RULES));
    s = unwrap(seedMorePortals(s, 3, RULES));
    expect(s.events.portals).toHaveLength(n + 5);
    expect(new Set(s.events.portals.map((p) => p.id)).size).toBe(n + 5);
  });

  it('removes events, returning their cards to the castle', () => {
    let s = game();
    const id = s.events.portals[0].id;
    s = unwrap(assign(s, 'bridgeburners', id, RULES));
    s = unwrap(removeEvent(s, id));
    expect(eventById(s, id)).toBeUndefined();
    expect(eventOf(s, 'bridgeburners')).toBeUndefined();
  });
});

describe('DM edits: castle', () => {
  it('sets the treasury and facility levels', () => {
    let s = unwrap(setTreasury(game(), 350000.4, 1500));
    expect(s.castle).toMatchObject({ treasury: 350000, incomePerTurn: 1500 });
    s = unwrap(setFacilityLevel(s, 'barracks', 7));
    expect(s.castle.facilities['barracks']).toBe(3);
    expect(setFacilityLevel(s, 'moat', 2).ok).toBe(false);
  });
});

describe('DM edits: new and removed resources', () => {
  const spec = (over: Partial<NewResourceSpec> = {}): NewResourceSpec => ({
    kind: 'hero',
    name: 'Captain Luke',
    faction: 'Letheri Empire',
    power: 6,
    morale: 4,
    injuryResistance: 3,
    canCleanse: false,
    tisteAndii: false,
    healer: false,
    hidden: false,
    notes: '',
    ...over,
  });

  it('makes readable ids that never clash', () => {
    const s = game();
    expect(newResourceId(s, 'Captain Luke', RULES)).toBe('captain-luke');
    expect(newResourceId(s, 'Karsa Orlong', RULES)).toBe('karsa-orlong-2');
    expect(newResourceId(s, 'Col', RULES)).toBe('col-2'); // a commander's id
    expect(newResourceId(s, "D'rek's Chosen!", RULES)).toBe('d-rek-s-chosen');
    expect(newResourceId(s, '???', RULES)).toBe('resource');
  });

  it('brings a new hero into play at the castle, ready to be sent', () => {
    const s = unwrap(createResource(game(), spec({ tisteAndii: true, healer: true, canCleanse: true }), RULES));
    const luke = resourceById(s, 'captain-luke')!;
    expect(luke).toMatchObject({ kind: 'hero', name: 'Captain Luke', power: 6, morale: 4, canCleanse: true, locked: false, attachedTo: null });
    expect(luke.tags).toEqual(['tiste-andii', 'healer']);
    const withLuke = unwrap(attach(s, 'captain-luke', 'letheri-fleet'));
    expect(assign(withLuke, 'letheri-fleet', s.events.portals[0].id, RULES).ok).toBe(true);
  });

  it('brings a new group in at full strength, within the rule ranges', () => {
    const s = unwrap(
      createResource(game(), spec({ kind: 'group', name: 'Moranth Blacks', power: 14, morale: 0, number: 120, decimationResistance: 9, replenishable: false }), RULES),
    );
    expect(resourceById(s, 'moranth-blacks')).toMatchObject({
      kind: 'group', power: 10, morale: 1, number: 120, maxNumber: 120, injured: 0, decimationResistance: 5, replenishable: false,
    });
  });

  it('can keep a new resource off the table until it is revealed', () => {
    const s = unwrap(createResource(game(), spec({ hidden: true }), RULES));
    expect(resourceById(s, 'captain-luke')).toMatchObject({ locked: true, lockReason: 'Not yet revealed to the table' });
  });

  it('needs a name', () => {
    expect(createResource(game(), spec({ name: '   ' }), RULES)).toEqual({ ok: false, error: 'A new resource needs a name' });
  });

  it('removes a resource cleanly: out of the field, attached heroes freed, castle work dropped', () => {
    let s = unwrap(attach(game(), 'blues', 'avowed-prince'));
    s = unwrap(assign(s, 'avowed-prince', s.events.portals[0].id, RULES));
    s = unwrap(removeResource(s, 'avowed-prince'));
    expect(resourceById(s, 'avowed-prince')).toBeUndefined();
    expect(s.events.portals[0].assigned).not.toContain('avowed-prince');
    expect(resourceById(s, 'blues')!.attachedTo).toBeNull();

    let t = unwrap(train(game(), 'uruk', RULES));
    t = unwrap(removeResource(t, 'uruk'));
    expect(t.castle.training).toEqual([]);
    expect(removeResource(t, 'uruk').ok).toBe(false);
  });
});

describe('setAuraRadius', () => {
  it('sets one reach for every temple, within bounds, and restores the config one', () => {
    const s = newGame(SEED, RULES, 3);
    expect(auraRadiusOf(s.events, RULES.events)).toBe(RULES.events.temple.auraRadius);
    const wide = unwrap(setAuraRadius(s, 0.12));
    expect(auraRadiusOf(wide.events, RULES.events)).toBe(0.12);
    expect(unwrap(setAuraRadius(s, 5)).events.auraRadius).toBe(0.25);
    expect(unwrap(setAuraRadius(s, 0)).events.auraRadius).toBe(0.01);
    expect(setAuraRadius(s, Number.NaN).ok).toBe(false);
    expect(unwrap(setAuraRadius(wide, null)).events.auraRadius).toBeNull();
  });

  it('changes who fights inside the aura', () => {
    // A portal just beyond Jhag Odhan's usual reach.
    let s = newGame(SEED, RULES, 3);
    const jhag = s.events.temples.find((t) => t.active && t.name.includes('Jhag'))!;
    const near = { ...s.events.portals[0], id: 'near', position: { x: jhag.position.x + 0.09, y: jhag.position.y }, assigned: [] };
    s = { ...s, events: { ...s.events, portals: [...s.events.portals, near] } };
    s = unwrap(attach(s, 'korlat', 'bluerose-1'));
    s = unwrap(assign(s, 'bluerose-1', 'near', RULES));
    const motherDark = (st: GameState) => resourceView(st, resourceById(st, 'bluerose-1')!, RULES).power.parts.some((p) => p.label === 'Mother Dark');
    expect(motherDark(s)).toBe(false);
    expect(motherDark(unwrap(setAuraRadius(s, 0.12)))).toBe(true);
  });
});
