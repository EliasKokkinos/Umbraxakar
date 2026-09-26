import { assign, attach } from './assignment';
import { GameState, Result, newGame } from './game-state';
import { currentOdds, oddsIfSent, winChance } from './odds';
import { resolveAll } from './turn';
import { RULES, SEED, portal } from './testing';

const unwrap = (r: Result): GameState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

/** A session with one portal of a known difficulty, far from any temple. */
function withPortal(difficulty: number): GameState {
  const s = newGame(SEED, RULES, 3);
  return { ...s, events: { ...s.events, portals: [portal({ id: 'p', difficulty })] } };
}

describe('winChance', () => {
  it('matches the chance table, never below 5% or above 95%', () => {
    expect([20, 14, 10, 7, 2].map(winChance)).toEqual([0.05, 0.35, 0.55, 0.7, 0.95]);
    expect(winChance(25)).toBe(0.05);
    expect(winChance(-3)).toBe(0.95);
  });
});

describe('oddsIfSent', () => {
  it('worked example: a Legion led by Karsa, then the Bridgeburners, against difficulty 7', () => {
    let s = withPortal(7);
    expect(oddsIfSent(s, 'malazan-legion-1', 'p', RULES)).toEqual({ ok: true, eventPower: 4, target: 13, chance: 0.4 });
    s = unwrap(attach(s, 'karsa-orlong', 'malazan-legion-1'));
    expect(oddsIfSent(s, 'malazan-legion-1', 'p', RULES)).toEqual({ ok: true, eventPower: 7, target: 10, chance: 0.55 });
    s = unwrap(assign(s, 'malazan-legion-1', 'p', RULES));
    expect(oddsIfSent(s, 'bridgeburners', 'p', RULES)).toMatchObject({ ok: true, eventPower: 8, target: 9, chance: 0.6 });
  });

  it('matches what the battle roll actually uses', () => {
    let s = withPortal(6);
    s = unwrap(attach(s, 'uruk', 'bluerose-1'));
    s = unwrap(assign(s, 'bluerose-1', 'p', RULES));
    s = unwrap(assign(s, 'bridgeburners', 'p', RULES));
    const battle = resolveAll(s, RULES).battles['p'];
    expect(currentOdds(s, 'p', RULES)).toMatchObject({ eventPower: battle.eventPower, target: battle.target });
  });

  it('gives the reason when a card cannot go', () => {
    const s = withPortal(5);
    expect(oddsIfSent(s, 'karsa-orlong', 'p', RULES)).toEqual({ ok: false, reason: 'Heroes take the field with a group' });
    expect(oddsIfSent(s, 'avowed-avernus', 'p', RULES).ok).toBe(false);
  });

  it('treats a card already elsewhere as moving here', () => {
    let s = withPortal(5);
    s = { ...s, events: { ...s.events, portals: [...s.events.portals, portal({ id: 'q', difficulty: 3, position: { x: 0.5, y: 0.9 } })] } };
    s = unwrap(assign(s, 'bridgeburners', 'q', RULES));
    expect(oddsIfSent(s, 'bridgeburners', 'p', RULES)).toMatchObject({ ok: true, eventPower: 5 });
    expect(currentOdds(s, 'p', RULES)).toBeNull();
  });
});
