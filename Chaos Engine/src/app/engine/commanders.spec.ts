import {
  appliedSway,
  chooseCommander,
  commandImpact,
  hasCommanderThisTurn,
  influenceOf,
  isInfluenceEdited,
  removeInfluence,
  resetInfluence,
  resolveBlocker,
  setInfluence,
} from './commanders';
import { removeResource } from './dm-edits';
import { tableView } from './table-view';
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
      ['cowl', 1],
      ['kazz-davore', -1],
    ]);
    expect(impact.find((i) => i.resourceId === 'cowl')).toMatchObject({ from: 3, to: 4, locked: false });
    // Locked resources are still swayed, ready for when they return.
    expect(commandImpact(s, 'neldor-andarist', RULES).find((i) => i.resourceId === 'anomander-rake')!.locked).toBe(true);
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

describe('the DM rewrites the sway', () => {
  const reason = 'She carried his standard out of the Deadhouse.';

  it('starts from the archive, and adds a new sway', () => {
    const s = game();
    expect(influenceOf(s, 'imogen', RULES)).toEqual(RULES.commanders.find((c) => c.id === 'imogen')!.influence);
    expect(isInfluenceEdited(s, 'imogen')).toBe(false);

    const next = unwrap(setInfluence(s, 'imogen', { resourceId: 'bridgeburners', morale: 2, reason: `  ${reason} ` }, RULES));
    expect(isInfluenceEdited(next, 'imogen')).toBe(true);
    expect(influenceOf(next, 'imogen', RULES).map((i) => [i.resourceId, i.morale])).toEqual([
      ['cowl', 1],
      ['kazz-davore', -1],
      ['bridgeburners', 2],
    ]);
    expect(influenceOf(next, 'imogen', RULES).at(-1)!.reason).toBe(reason);
    // Other commanders keep the archive's sway.
    expect(isInfluenceEdited(next, 'morgran')).toBe(false);
  });

  it('changes a sway in place, and removes one', () => {
    let s = unwrap(setInfluence(game(), 'imogen', { resourceId: 'kazz-davore', morale: -2, reason: 'He will not forgive it.' }, RULES));
    expect(influenceOf(s, 'imogen', RULES).map((i) => [i.resourceId, i.morale])).toEqual([
      ['cowl', 1],
      ['kazz-davore', -2],
    ]);
    s = unwrap(removeInfluence(s, 'imogen', 'cowl', RULES));
    expect(influenceOf(s, 'imogen', RULES).map((i) => i.resourceId)).toEqual(['kazz-davore']);
    expect(commandImpact(s, 'imogen', RULES).map((i) => i.delta)).toEqual([-2]);
    expect(removeInfluence(s, 'imogen', 'cowl', RULES).ok).toBe(false);
  });

  it('can be restored from the archive', () => {
    const s = unwrap(removeInfluence(game(), 'imogen', 'cowl', RULES));
    const back = unwrap(resetInfluence(s, 'imogen'));
    expect(influenceOf(back, 'imogen', RULES)).toEqual(influenceOf(game(), 'imogen', RULES));
    expect(resetInfluence(back, 'imogen').ok).toBe(false);
  });

  it('keeps to the rule ranges', () => {
    const s = game();
    const bad = (morale: number, r = reason, resourceId = 'bridgeburners', who = 'imogen') =>
      setInfluence(s, who, { resourceId, morale, reason: r }, RULES);
    expect(bad(0)).toEqual({ ok: false, error: 'Sway must be -2, -1, +1 or +2' });
    expect(bad(3).ok).toBe(false);
    expect(bad(1, '   ')).toEqual({ ok: false, error: 'Give a reason: the table shows it' });
    expect(bad(1, reason, 'nobody').ok).toBe(false);
    expect(bad(1, reason, 'bridgeburners', 'nobody').ok).toBe(false);
  });

  it('counts from the next command: the sway applied this turn stands, on the table too', () => {
    let s = unwrap(chooseCommander(game(), 'imogen', RULES));
    expect(morale(s, 'cowl')).toBe(4);
    s = unwrap(removeInfluence(s, 'imogen', 'cowl', RULES));
    expect(morale(s, 'cowl')).toBe(4);
    expect(appliedSway(s, RULES).map((i) => i.resourceId)).toEqual(['cowl', 'kazz-davore']);
    expect(tableView(s, RULES, RULES.commanders).commander!.impact.map((i) => i.name)).toEqual(['Cowl', "Kazz D'avore"]);

    // Next turn, the new sway is what they bring.
    s = endTurn(s, RULES);
    const before = morale(s, 'cowl');
    s = unwrap(chooseCommander(s, 'imogen', RULES));
    expect(morale(s, 'cowl')).toBe(before);
    expect(appliedSway(s, RULES).map((i) => i.resourceId)).toEqual(['kazz-davore']);
  });

  it('forgets the sway over a resource the DM removes from the game', () => {
    let s = unwrap(setInfluence(game(), 'imogen', { resourceId: 'bridgeburners', morale: 1, reason }, RULES));
    s = unwrap(removeResource(s, 'bridgeburners'));
    expect(influenceOf(s, 'imogen', RULES).map((i) => i.resourceId)).toEqual(['cowl', 'kazz-davore']);
  });
});
