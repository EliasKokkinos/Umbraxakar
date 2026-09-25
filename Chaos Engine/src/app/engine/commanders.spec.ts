import { chooseCommander, commandImpact, hasCommanderThisTurn, resolveBlocker } from './commanders';
import { GameState, Result, newGame, resourceById } from './game-state';
import { endTurn } from './turn';
import { RULES, SEED } from './testing';

const unwrap = (r: Result): GameState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const game = () => newGame(SEED, RULES, 17);
const morale = (s: GameState, id: string) => resourceById(s, id)!.morale;

describe('commandImpact', () => {
  it('previews the sway without changing anything', () => {
    const s = game();
    const impact = commandImpact(s, 'imogen', RULES);
    expect(impact.map((i) => [i.resourceId, i.delta])).toEqual([
      ['avowed-prince', 1],
      ['avowed-avernus', 1],
      ['cowl', 1],
      ['kazz-davore', -1],
    ]);
    expect(impact.find((i) => i.resourceId === 'cowl')).toMatchObject({ from: 3, to: 4 });
    expect(impact.find((i) => i.resourceId === 'avowed-avernus')!.locked).toBe(true);
    expect(morale(s, 'cowl')).toBe(3);
  });

  it('shows the clamp: morale never passes 5', () => {
    const s = { ...game(), resources: game().resources.map((r) => (r.id === 'cowl' ? { ...r, morale: 5 } : r)) };
    expect(commandImpact(s, 'imogen', RULES).find((i) => i.resourceId === 'cowl')).toMatchObject({ from: 5, to: 5 });
  });
});

describe('chooseCommander', () => {
  it('applies the sway at once and records the turn', () => {
    const s = unwrap(chooseCommander(game(), 'neldor-andarist', RULES));
    expect(s.commanderId).toBe('neldor-andarist');
    expect(s.commanderTurn).toBe(1);
    expect(morale(s, 'korlat')).toBe(5);
    expect(morale(s, 'uruk')).toBe(2);
    expect(hasCommanderThisTurn(s)).toBe(true);
  });

  it('locks the choice for the turn', () => {
    const s = unwrap(chooseCommander(game(), 'col', RULES));
    expect(chooseCommander(s, 'imogen', RULES)).toEqual({
      ok: false,
      error: 'Col (911) already commands turn 1. Undo to choose again.',
    });
    expect(chooseCommander(s, 'col', RULES).ok).toBe(false);
  });

  it('must be chosen again each turn, and may be the same commander', () => {
    let s = unwrap(chooseCommander(game(), 'col', RULES));
    s = endTurn(s, RULES);
    expect(hasCommanderThisTurn(s)).toBe(false);
    expect(resolveBlocker(s)).toBe('Choose a commander for turn 2 first.');
    s = unwrap(chooseCommander(s, 'col', RULES));
    expect(resolveBlocker(s)).toBeNull();
  });

  it('rejects unknown commanders', () => {
    expect(chooseCommander(game(), 'johanna', RULES).ok).toBe(false);
  });
});
