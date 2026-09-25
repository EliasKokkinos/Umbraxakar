import { assign } from './assignment';
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
  it('worked example: Karsa, then a Legion and the Bridgeburners, against difficulty 7', () => {
    let s = withPortal(7);
    expect(oddsIfSent(s, 'karsa-orlong', 'p', RULES)).toEqual({ ok: true, eventPower: 8, target: 9, chance: 0.6 });
    s = unwrap(assign(s, 'karsa-orlong', 'p', RULES));
    s = unwrap(assign(s, 'malazan-legion-1', 'p', RULES));
    expect(currentOdds(s, 'p', RULES)).toEqual({ eventPower: 9, target: 8, chance: 0.65 });
    expect(oddsIfSent(s, 'bridgeburners', 'p', RULES)).toMatchObject({ ok: true, eventPower: 10, target: 7, chance: 0.7 });
  });

  it('matches what the battle roll actually uses', () => {
    let s = withPortal(6);
    s = unwrap(assign(s, 'uruk', 'p', RULES));
    s = unwrap(assign(s, 'bluerose-1', 'p', RULES));
    const battle = resolveAll(s, RULES).battles['p'];
    expect(currentOdds(s, 'p', RULES)).toMatchObject({ eventPower: battle.eventPower, target: battle.target });
  });

  it('gives the reason when a card cannot go', () => {
    const s = withPortal(5);
    expect(oddsIfSent(s, 'anomander-rake', 'p', RULES)).toEqual({ ok: false, reason: 'Not yet resurrected.' });
  });

  it('treats a card already elsewhere as moving here', () => {
    let s = withPortal(5);
    s = { ...s, events: { ...s.events, portals: [...s.events.portals, portal({ id: 'q', difficulty: 3, position: { x: 0.5, y: 0.9 } })] } };
    s = unwrap(assign(s, 'uruk', 'q', RULES));
    expect(oddsIfSent(s, 'uruk', 'p', RULES)).toMatchObject({ ok: true, eventPower: 8 });
    expect(currentOdds(s, 'p', RULES)).toBeNull();
  });
});
