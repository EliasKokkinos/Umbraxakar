import { assign } from './assignment';
import {
  addPortal,
  addResource,
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
    expect(assign(s, 'd-dhampir', s.events.portals[0].id, RULES).ok).toBe(true);
  });

  it('locking a deployed resource recalls it', () => {
    let s = unwrap(assign(game(), 'uruk', game().events.portals[0].id, RULES));
    s = unwrap(updateResource(s, 'uruk', { locked: true, lockReason: 'Summoned by the Matriarch’s ghost' }));
    expect(eventOf(s, 'uruk')).toBeUndefined();
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

    s = unwrap(assign(s, 'uruk', s.events.portals[1].id, RULES));
    s = unwrap(updatePortal(s, s.events.portals[1].id, { status: 'closed' }, RULES));
    expect(eventOf(s, 'uruk')).toBeUndefined();
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
    s = unwrap(assign(s, 'uruk', id, RULES));
    s = unwrap(removeEvent(s, id));
    expect(eventById(s, id)).toBeUndefined();
    expect(eventOf(s, 'uruk')).toBeUndefined();
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
