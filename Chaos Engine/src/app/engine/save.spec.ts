import { newGame } from './game-state';
import { SAVE_FORMAT, deserialize, serialize } from './save';
import { endTurn } from './turn';
import { RULES, SEED } from './testing';

describe('save files', () => {
  const state = endTurn(newGame(SEED, RULES, 404), RULES);

  it('round-trips a game exactly', () => {
    const json = serialize(state, 'After turn 1', new Date('2026-09-25T12:00:00Z'));
    const loaded = deserialize(json);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.state.state).toEqual(state);
    expect(loaded.state).toMatchObject({ format: SAVE_FORMAT, label: 'After turn 1', savedAt: '2026-09-25T12:00:00.000Z' });
  });

  it('a loaded game plays on identically, dice included', () => {
    const loaded = deserialize(serialize(state, 'x'));
    if (!loaded.ok) throw new Error(loaded.error);
    expect(endTurn(loaded.state.state, RULES)).toEqual(endTurn(state, RULES));
  });

  it('rejects files that are not saves, damaged, or from the future', () => {
    expect(deserialize('not json')).toEqual({ ok: false, error: 'Not a valid JSON file' });
    expect(deserialize('{"format":"something-else"}')).toEqual({ ok: false, error: 'Not a Chaos Engine save file' });

    const damaged = JSON.parse(serialize(state, 'x'));
    delete damaged.state.castle;
    expect(deserialize(JSON.stringify(damaged))).toEqual({ ok: false, error: 'Save file is damaged (castle)' });

    const future = JSON.parse(serialize(state, 'x'));
    future.version = 99;
    expect(deserialize(JSON.stringify(future)).ok).toBe(false);
  });

  it('migrates older saves forward, step by step', () => {
    const v1 = serialize(state, 'old');
    const migrations = { 1: (s: Record<string, unknown>) => ({ ...s, addedInV2: true }) };
    const loaded = deserialize(v1, migrations, 2);
    expect(loaded.ok && loaded.state.state).toMatchObject({ version: 2, addedInV2: true });
    expect(deserialize(v1, {}, 2)).toEqual({ ok: false, error: 'No migration from save version 1' });
  });
});
