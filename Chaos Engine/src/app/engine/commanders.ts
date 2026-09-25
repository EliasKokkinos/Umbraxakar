// The commander of the turn: whoever takes command sways the morale of those whose story they share.
import { GameState, Result, Rules, fail, ok, resourceById } from './game-state';
import { clampMorale } from './morale';

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

/** What taking command would do, before anyone commits to it. */
export function commandImpact(state: GameState, commanderId: string, rules: Rules): Impact[] {
  const commander = rules.commanders.find((c) => c.id === commanderId);
  return (commander?.influence ?? []).flatMap((i) => {
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
    resources: state.resources.map((r) => (impact.has(r.id) ? { ...r, morale: impact.get(r.id)! } : r)),
  });
}
