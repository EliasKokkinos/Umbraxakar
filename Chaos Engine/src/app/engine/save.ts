import { GAME_STATE_VERSION, GameState, Result, fail, ok } from './game-state';

export const SAVE_FORMAT = 'chaos-engine-save';

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  version: number;
  savedAt: string;
  label: string;
  state: GameState;
  /** Uploaded portraits by resource id, in exported files only (never autosaves or snapshots). */
  portraits?: Record<string, string>;
}

/**
 * Upgrades a raw saved state from version n to n + 1. Add an entry here whenever
 * GameState changes shape, and bump GAME_STATE_VERSION.
 */
export const MIGRATIONS: Record<number, (state: Record<string, unknown>) => Record<string, unknown>> = {
  // v2: commanders take command once per turn.
  1: (s) => ({ ...s, commanderTurn: null }),
  // v3: only groups take the field; heroes go with a group.
  2: (s) => {
    type R = { id: string; kind: string; attachedTo: string | null };
    type E = { assigned: string[] };
    const resources = s['resources'] as R[];
    const events = s['events'] as { portals: E[]; temples: E[] } & Record<string, unknown>;
    const groups = new Set(resources.filter((r) => r.kind === 'group').map((r) => r.id));
    const onlyGroups = (e: E) => ({ ...e, assigned: e.assigned.filter((id) => groups.has(id)) });
    return {
      ...s,
      resources: resources.map((r) => (r.attachedTo && !groups.has(r.attachedTo) ? { ...r, attachedTo: null } : r)),
      events: { ...events, portals: events.portals.map(onlyGroups), temples: events.temples.map(onlyGroups) },
    };
  },
  // v4: the DM can rewrite a commander's sway; the sway applied at command is recorded.
  3: (s) => ({ ...s, commandSway: null, commanderInfluence: {} }),
};

export function toSaveFile(state: GameState, label: string, now = new Date(), portraits?: Record<string, string>): SaveFile {
  const file: SaveFile = { format: SAVE_FORMAT, version: state.version, savedAt: now.toISOString(), label, state };
  if (portraits && Object.keys(portraits).length) file.portraits = portraits;
  return file;
}

export function serialize(state: GameState, label: string, now = new Date(), portraits?: Record<string, string>): string {
  return JSON.stringify(toSaveFile(state, label, now, portraits), null, 2);
}

export function migrate(
  raw: Record<string, unknown>,
  from: number,
  migrations = MIGRATIONS,
  target = GAME_STATE_VERSION,
): Result<Record<string, unknown>> {
  let state = raw;
  for (let v = from; v < target; v++) {
    const step = migrations[v];
    if (!step) return fail(`No migration from save version ${v}`);
    state = { ...step(state), version: v + 1 };
  }
  return ok(state);
}

/** Parses and validates a save file, migrating older versions forward. */
export function deserialize(json: string, migrations = MIGRATIONS, target = GAME_STATE_VERSION): Result<SaveFile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return fail('Not a valid JSON file');
  }
  const file = parsed as Partial<SaveFile>;
  if (!file || file.format !== SAVE_FORMAT) return fail('Not a Chaos Engine save file');
  if (typeof file.version !== 'number') return fail('Save file has no version');
  if (file.version > target) return fail(`Save is from a newer version (${file.version}) of the Chaos Engine`);

  const migrated = migrate(file.state as unknown as Record<string, unknown>, file.version, migrations, target);
  if (!migrated.ok) return migrated;
  const state = migrated.state as unknown as GameState;

  const problems = [
    !Array.isArray(state.resources) && 'resources',
    !(state.events && Array.isArray(state.events.portals) && Array.isArray(state.events.temples)) && 'events',
    !(state.castle && typeof state.castle.treasury === 'number') && 'castle',
    typeof state.rngState !== 'number' && 'rngState',
  ].filter(Boolean);
  if (problems.length) return fail(`Save file is damaged (${problems.join(', ')})`);

  return ok({ ...(file as SaveFile), version: target, state });
}
