import { GAME_STATE_VERSION as V, newGame } from './game-state';
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
    const current = serialize(state, 'old');
    const migrations = { [V]: (s: Record<string, unknown>) => ({ ...s, addedNext: true }) };
    const loaded = deserialize(current, migrations, V + 1);
    expect(loaded.ok && loaded.state.state).toMatchObject({ version: V + 1, addedNext: true });
    expect(deserialize(current, {}, V + 1)).toEqual({ ok: false, error: `No migration from save version ${V}` });
  });

  it('upgrades a real version 1 save (before commanders took command per turn)', () => {
    const file = JSON.parse(serialize(state, 'from September'));
    delete file.state.commanderTurn;
    file.version = 1;
    file.state.version = 1;
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.ok && loaded.state.state).toMatchObject({ version: V, commanderTurn: null, commandSway: null, commanderInfluence: {}, mapStyle: null, events: { auraRadius: null } });
  });

  it('upgrades a version 2 save: heroes alone in the field come home, hero-on-hero attachments end', () => {
    const file = JSON.parse(serialize(state, 'before groups-only'));
    file.version = 2;
    file.state.version = 2;
    const [p0] = file.state.events.portals;
    p0.assigned = ['karsa-orlong', 'bridgeburners'];
    const blues = file.state.resources.find((r: { id: string }) => r.id === 'blues');
    blues.attachedTo = 'karsa-orlong';
    const cowl = file.state.resources.find((r: { id: string }) => r.id === 'cowl');
    cowl.attachedTo = 'avowed-prince';

    const loaded = deserialize(JSON.stringify(file));
    if (!loaded.ok) throw new Error(loaded.error);
    const s = loaded.state.state;
    expect(s.version).toBe(V);
    expect(s.events.portals[0].assigned).toEqual(['bridgeburners']);
    expect(s.resources.find((r) => r.id === 'blues')!.attachedTo).toBeNull();
    expect(s.resources.find((r) => r.id === 'cowl')!.attachedTo).toBe('avowed-prince');
  });
});
