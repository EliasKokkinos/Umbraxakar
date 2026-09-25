import { assign } from './assignment';
import {
  forgeArms,
  heal,
  healSlots,
  hireEntertainers,
  musterMilitia,
  recruit,
  recruitCapacity,
  runCastlePhase,
  serveWine,
  train,
  upgradeFacility,
} from './castle';
import { GameState, Result, newGame, resourceById } from './game-state';
import { GroupState, HeroState } from './resource-state';
import { RULES, SEED } from './testing';

const unwrap = (r: Result): GameState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const patch = (s: GameState, id: string, p: object): GameState => ({
  ...s,
  resources: s.resources.map((r) => (r.id === id ? { ...r, ...p } : r)),
});
const facility = (s: GameState, id: string, level: number): GameState => ({
  ...s,
  castle: { ...s.castle, facilities: { ...s.castle.facilities, [id]: level } },
});
/** Runs the castle phase with nobody deployed. */
const phase = (s: GameState, deployed: string[] = []) => runCastlePhase(s, { deployed: new Set(deployed) }, RULES).state;
const hero = (s: GameState, id: string) => resourceById(s, id) as HeroState;
const group = (s: GameState, id: string) => resourceById(s, id) as GroupState;
const game = () => newGame(SEED, RULES, 77);

describe('entertainers', () => {
  it('cost 2,000, last two turns and do not stack', () => {
    const s = unwrap(hireEntertainers(game(), RULES));
    expect(s.castle.treasury).toBe(198000);
    expect(s.castle.entertainersTurnsLeft).toBe(2);
    expect(hireEntertainers(s, RULES).ok).toBe(false);
  });

  it('cost half with a level 2 Great Hall', () => {
    expect(unwrap(hireEntertainers(facility(game(), 'great-hall', 2), RULES)).castle.treasury).toBe(199000);
  });
});

describe('morale recovery in the castle phase', () => {
  it('+1 at home, +2 with entertainers, nothing for those deployed', () => {
    const s = patch(patch(game(), 'uruk', { morale: 2 }), 'korlat', { morale: 2 });
    expect(hero(phase(s), 'uruk').morale).toBe(3);
    expect(hero(phase(s, ['korlat']), 'korlat').morale).toBe(2);
    const entertained = unwrap(hireEntertainers(s, RULES));
    expect(hero(phase(entertained), 'uruk').morale).toBe(4);
    expect(phase(entertained).castle.entertainersTurnsLeft).toBe(1);
  });

  it('never exceeds 5', () => {
    expect(hero(phase(patch(game(), 'uruk', { morale: 5 })), 'uruk').morale).toBe(5);
  });
});

describe('training', () => {
  it('costs a morale, uses the one slot, and grants +1 Power for 2 turns', () => {
    let s = unwrap(train(game(), 'trull-sengar', RULES));
    expect(hero(s, 'trull-sengar').morale).toBe(3);
    expect(s.castle.treasury).toBe(199500);
    expect(train(s, 'korlat', RULES)).toEqual({ ok: false, error: 'No free training slot' });
    expect(assign(s, 'trull-sengar', s.events.portals[0].id, RULES).ok).toBe(false);

    s = phase(s);
    expect(hero(s, 'trull-sengar')).toMatchObject({ trainingBonus: 1, trainingTurnsLeft: 2, morale: 3 });
    s = phase(s);
    expect(hero(s, 'trull-sengar').trainingTurnsLeft).toBe(1);
    s = phase(s);
    expect(hero(s, 'trull-sengar').trainingTurnsLeft).toBe(0);
  });

  it('refuses the dispirited and those away from the castle', () => {
    expect(train(patch(game(), 'uruk', { morale: 2 }), 'uruk', RULES).ok).toBe(false);
    const away = unwrap(assign(game(), 'uruk', game().events.portals[0].id, RULES));
    expect(train(away, 'uruk', RULES).ok).toBe(false);
  });
});

describe('healing', () => {
  const injured = (s: GameState, id: string, severity: 'minor' | 'serious' | 'grievous') =>
    patch(s, id, { injuries: [{ severity, turnsTreated: 0 }] });

  it('has 1 hall slot plus one per healer hero at home (Cowl, Kazz)', () => {
    const s = game();
    expect(healSlots(s, RULES)).toBe(3);
    const cowlAway = unwrap(assign(s, 'cowl', s.events.portals[0].id, RULES));
    expect(healSlots(cowlAway, RULES)).toBe(2);
  });

  it('heals a serious injury by the end of the turn for 1,000', () => {
    let s = unwrap(heal(injured(game(), 'karsa-orlong', 'serious'), 'karsa-orlong', RULES));
    expect(s.castle.treasury).toBe(199000);
    s = phase(s);
    expect(hero(s, 'karsa-orlong').injuries).toEqual([]);
    expect(s.castle.treatments).toEqual([]);
  });

  it('takes a grievous injury down to serious after 2 turns in a slot', () => {
    let s = unwrap(heal(injured(game(), 'karsa-orlong', 'grievous'), 'karsa-orlong', RULES));
    s = phase(s);
    expect(hero(s, 'karsa-orlong').injuries.map((i) => i.severity)).toEqual(['grievous']);
    s = phase(s);
    expect(hero(s, 'karsa-orlong').injuries).toEqual([{ severity: 'serious', turnsTreated: 0 }]);
  });

  it('needs a free slot and an injury worth a healer', () => {
    expect(heal(injured(game(), 'karsa-orlong', 'minor'), 'karsa-orlong', RULES).ok).toBe(false);
    let s = game();
    for (const id of ['karsa-orlong', 'uruk', 'korlat', 'trull-sengar']) s = injured(s, id, 'serious');
    for (const id of ['karsa-orlong', 'uruk', 'korlat']) s = unwrap(heal(s, id, RULES));
    expect(heal(s, 'trull-sengar', RULES)).toEqual({ ok: false, error: 'No free healing slot' });
  });

  it('rest heals minor after 1 turn and serious after 3; grievous never', () => {
    let s = patch(game(), 'uruk', {
      injuries: [
        { severity: 'minor', turnsTreated: 0 },
        { severity: 'serious', turnsTreated: 0 },
        { severity: 'grievous', turnsTreated: 0 },
      ],
    });
    s = phase(s);
    expect(hero(s, 'uruk').injuries.map((i) => i.severity)).toEqual(['serious', 'grievous']);
    s = phase(phase(s));
    expect(hero(s, 'uruk').injuries.map((i) => i.severity)).toEqual(['grievous']);
    s = phase(phase(phase(s)));
    expect(hero(s, 'uruk').injuries.map((i) => i.severity)).toEqual(['grievous']);
  });
});

describe('groups: injured recovery and recruitment', () => {
  it('returns 50% of the injured each turn at a level 1 hall', () => {
    const s = phase(patch(game(), 'malazan-legion-1', { injured: 40 }));
    expect(group(s, 'malazan-legion-1').injured).toBe(20);
    expect(group(phase(patch(game(), 'bridgeburners', { injured: 1 })), 'bridgeburners').injured).toBe(0);
  });

  it('recruits up to 10% of max per turn at 20 gp a head; recruits arrive at turn end', () => {
    let s = patch(game(), 'malazan-legion-1', { number: 200 });
    expect(recruitCapacity(s, group(s, 'malazan-legion-1'), RULES)).toBe(30);
    s = unwrap(recruit(s, 'malazan-legion-1', 100, RULES));
    expect(s.castle.treasury).toBe(199400);
    expect(recruit(s, 'malazan-legion-1', 10, RULES).ok).toBe(false);
    expect(group(phase(s), 'malazan-legion-1').number).toBe(230);
  });

  it('the Bluerose recruit at half rate; the Avowed never', () => {
    const s = patch(game(), 'bluerose-1', { number: 10 });
    expect(recruitCapacity(s, group(s, 'bluerose-1'), RULES)).toBe(3);
    expect(recruit(patch(game(), 'avowed-prince', { number: 60 }), 'avowed-prince', 5, RULES)).toEqual({
      ok: false,
      error: 'Avowed: The Prince\'s Company can never be replenished',
    });
  });
});

describe('projects', () => {
  it('musters militia after 2 turns with a level 2 Barracks', () => {
    expect(musterMilitia(game(), RULES).ok).toBe(false);
    let s = unwrap(musterMilitia(facility(game(), 'barracks', 2), RULES));
    s = phase(s);
    expect(resourceById(s, 'militia-1')).toBeUndefined();
    s = phase(s);
    expect(group(s, 'militia-1')).toMatchObject({ name: 'Militia of Lether', power: 2, number: 100, replenishable: true });
  });

  it('forges +1 Power permanently, once per group', () => {
    let s = unwrap(forgeArms(game(), 'bridgeburners', RULES));
    expect(forgeArms(s, 'bluerose-1', RULES)).toEqual({ ok: false, error: 'No free forging slot' });
    s = phase(phase(s));
    expect(group(s, 'bridgeburners')).toMatchObject({ power: 6, forged: true });
    expect(forgeArms(s, 'bridgeburners', RULES).ok).toBe(false);
  });

  it('upgrades a facility after 2 turns for 20,000', () => {
    let s = unwrap(upgradeFacility(game(), 'healers-hall', RULES));
    expect(s.castle.treasury).toBe(180000);
    expect(upgradeFacility(s, 'healers-hall', RULES).ok).toBe(false);
    s = phase(s);
    expect(s.castle.facilities['healers-hall']).toBe(1);
    s = phase(s);
    expect(s.castle.facilities['healers-hall']).toBe(2);
  });
});

describe('Tom’s wine', () => {
  it('gives +1 morale at once, one cask per turn, and lifts a refusal', () => {
    let s = unwrap(serveWine(patch(game(), 'uruk', { morale: 1 }), 'uruk', RULES));
    expect(hero(s, 'uruk').morale).toBe(2);
    expect(assign(s, 'uruk', s.events.portals[0].id, RULES).ok).toBe(true);
    expect(serveWine(s, 'korlat', RULES)).toEqual({ ok: false, error: 'No casks left this turn' });
    expect(serveWine(phase(s), 'uruk', RULES).ok).toBe(true); // casks reset each turn
  });
});

describe('treasury', () => {
  it('refuses actions the Company cannot afford', () => {
    const broke: GameState = { ...game(), castle: { ...game().castle, treasury: 100 } };
    expect(hireEntertainers(broke, RULES)).toEqual({ ok: false, error: 'Not enough gold (2000 needed)' });
  });
});
