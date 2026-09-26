// The commander of the turn: whoever takes command sways the morale of those whose story they share.
import { GameState, Result, Rules, fail, ok, resourceById } from './game-state';
import { clampMorale } from './morale';
import { CommanderInfluence } from './seed-types';

export interface Impact {
  resourceId: string;
  name: string;
  delta: number;
  from: number;
  to: number;
  reason: string;
  /** Locked resources are still swayed, for the day they return, but the table never lists them. */
  locked: boolean;
}

/** The DM's sway for a commander if they have written one, otherwise the archive's. */
export function influenceOf(state: GameState, commanderId: string, rules: Rules): CommanderInfluence[] {
  return state.commanderInfluence[commanderId] ?? rules.commanders.find((c) => c.id === commanderId)?.influence ?? [];
}

/** Has the DM rewritten this commander's sway? */
export function isInfluenceEdited(state: GameState, commanderId: string): boolean {
  return commanderId in state.commanderInfluence;
}

/** The sway the current commander brought when they took command. */
export function appliedSway(state: GameState, rules: Rules): CommanderInfluence[] {
  if (!state.commanderId) return [];
  return state.commandSway ?? influenceOf(state, state.commanderId, rules);
}

/** What taking command would do, before anyone commits to it. */
export function commandImpact(state: GameState, commanderId: string, rules: Rules): Impact[] {
  return influenceOf(state, commanderId, rules).flatMap((i) => {
    const r = resourceById(state, i.resourceId);
    if (!r || (r.kind !== 'group' && r.fallen)) return [];
    const to = clampMorale(r.morale + i.morale, rules.resolution);
    return [{ resourceId: r.id, name: r.name, delta: i.morale, from: r.morale, to, reason: i.reason, locked: r.locked }];
  });
}

export function hasCommanderThisTurn(state: GameState): boolean {
  return state.commanderId !== null && state.commanderTurn === state.events.turn;
}

/** Why the turn cannot be resolved yet, or null when it can. */
export function resolveBlocker(state: GameState): string | null {
  return hasCommanderThisTurn(state) ? null : `Choose a commander for turn ${state.events.turn} first.`;
}

/**
 * Takes command for this turn and applies the commander's sway at once. The choice is locked
 * for the turn, so commanders cannot be cycled for morale; undo reverses it.
 */
export function chooseCommander(state: GameState, commanderId: string, rules: Rules): Result {
  const commander = rules.commanders.find((c) => c.id === commanderId);
  if (!commander) return fail(`No commander ${commanderId}`);
  if (hasCommanderThisTurn(state)) {
    const current = rules.commanders.find((c) => c.id === state.commanderId)?.name ?? 'Someone';
    return fail(`${current} already commands turn ${state.events.turn}. Undo to choose again.`);
  }
  const impact = new Map(commandImpact(state, commanderId, rules).map((i) => [i.resourceId, i.to]));
  return ok({
    ...state,
    commanderId,
    commanderTurn: state.events.turn,
    commandSway: influenceOf(state, commanderId, rules),
    resources: state.resources.map((r) => (impact.has(r.id) ? { ...r, morale: impact.get(r.id)! } : r)),
  });
}

// ---------------------------------------------------------------- the DM rewrites the sway

export const SWAY_RANGE = [-2, -1, 1, 2] as const;

function writeInfluence(state: GameState, commanderId: string, influence: CommanderInfluence[]): GameState {
  return { ...state, commanderInfluence: { ...state.commanderInfluence, [commanderId]: influence } };
}

/**
 * Adds a commander's sway over one resource, or changes it if they already have one. It takes
 * effect the next time they take command; the sway already applied this turn stands.
 */
export function setInfluence(state: GameState, commanderId: string, entry: CommanderInfluence, rules: Rules): Result {
  if (!rules.commanders.some((c) => c.id === commanderId)) return fail(`No commander ${commanderId}`);
  if (!resourceById(state, entry.resourceId)) return fail(`No resource ${entry.resourceId}`);
  if (!(SWAY_RANGE as readonly number[]).includes(entry.morale)) return fail('Sway must be -2, -1, +1 or +2');
  const reason = entry.reason.trim();
  if (!reason) return fail('Give a reason: the table shows it');
  const current = influenceOf(state, commanderId, rules);
  const next = { resourceId: entry.resourceId, morale: entry.morale, reason };
  const at = current.findIndex((i) => i.resourceId === entry.resourceId);
  return ok(writeInfluence(state, commanderId, at < 0 ? [...current, next] : current.map((i, n) => (n === at ? next : i))));
}

export function removeInfluence(state: GameState, commanderId: string, resourceId: string, rules: Rules): Result {
  const current = influenceOf(state, commanderId, rules);
  if (!current.some((i) => i.resourceId === resourceId)) return fail('They hold no sway over that resource');
  return ok(writeInfluence(state, commanderId, current.filter((i) => i.resourceId !== resourceId)));
}

/** Back to the archive's sway for this commander. */
export function resetInfluence(state: GameState, commanderId: string): Result {
  if (!isInfluenceEdited(state, commanderId)) return fail('Their sway is already the archive’s');
  const { [commanderId]: _dropped, ...rest } = state.commanderInfluence;
  return ok({ ...state, commanderInfluence: rest });
}
