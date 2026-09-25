import { eventDifficulty } from './assignment';
import { BattleInput, BattleResult, Card, resolveBattle } from './battle';
import { runCastlePhase } from './castle';
import { EventState } from './event-state';
import { EventBattle, inTempleAura, runEventPhase } from './events';
import { GameState, Rules, allEvents, attachedTo, resourceById } from './game-state';
import { applyBattleResult } from './morale';
import { ResourceState } from './resource-state';
import { Rng } from './rng';

/** Battles awaiting DM review: rolled but not yet applied. */
export interface PendingResolution {
  battles: Record<string, BattleResult>;
  /** RNG state after the battle rolls; commitTurn continues from here. */
  rngState: number;
}

function cardsAt(state: GameState, event: EventState): Card[] {
  return event.assigned.flatMap((hostId) => {
    const host = resourceById(state, hostId);
    return host ? [{ host, attached: attachedTo(state, hostId) }] : [];
  });
}

function isContested(e: EventState): boolean {
  if (e.assigned.length === 0) return false;
  return e.type === 'chaos-portal' ? e.status === 'open' : !e.active && e.discovered;
}

export function battleInputFor(state: GameState, event: EventState, rules: Rules): BattleInput {
  return {
    difficulty: eventDifficulty(event),
    legendary: event.type === 'chaos-portal' && event.legendary,
    cards: cardsAt(state, event),
    inTempleAura: inTempleAura(event.position, state.events.temples, rules.events, rules.map.map),
    templeBonus: rules.events.temple.tisteAndiiPowerBonus,
    templeBonusTag: rules.events.temple.bonusTag,
  };
}

/** Step 1: roll every contested event. The DM may inspect, edit or reroll before committing. */
export function resolveAll(state: GameState, rules: Rules): PendingResolution {
  const rng = new Rng(state.rngState);
  const battles: Record<string, BattleResult> = {};
  for (const e of allEvents(state).filter(isContested)) {
    battles[e.id] = resolveBattle(battleInputFor(state, e, rules), rng, rules.resolution);
  }
  return { battles, rngState: rng.state };
}

/** Rerolls one event's battle from a fresh RNG draw (a deliberate DM action). */
export function rerollBattle(state: GameState, pending: PendingResolution, eventId: string, rules: Rules): PendingResolution {
  const event = allEvents(state).find((e) => e.id === eventId);
  if (!event) return pending;
  const rng = new Rng(pending.rngState);
  const result = resolveBattle(battleInputFor(state, event, rules), rng, rules.resolution);
  return { battles: { ...pending.battles, [eventId]: result }, rngState: rng.state };
}

/** Steps 2 onwards: apply battles, run the event phase, then the castle phase. */
export function commitTurn(state: GameState, pending: PendingResolution, rules: Rules): GameState {
  const rng = new Rng(pending.rngState);
  const deployed = new Set<string>();
  let resources = state.resources;

  // Apply each battle's morale and harm to everyone on the card.
  const eventBattles: Record<string, EventBattle> = {};
  for (const [eventId, result] of Object.entries(pending.battles)) {
    const event = allEvents(state).find((e) => e.id === eventId)!;
    const fought = cardsAt(state, event).flatMap((c) => [c.host, ...c.attached]);
    fought.forEach((r) => deployed.add(r.id));
    const updated = new Map(applyBattleResult(fought, result, rules.resolution).map((r) => [r.id, r]));
    resources = resources.map((r) => updated.get(r.id) ?? r);
    eventBattles[eventId] = {
      outcome: result.outcome,
      cleanser: result.outcome === 'won' && fought.some((r) => r.canCleanse),
    };
  }

  const { state: events, report } = runEventPhase(state.events, eventBattles, rules.map, rng, rules.events);
  let next: GameState = { ...state, resources, events };

  // Routed: at refusal morale on an event that was lost. They come home, but not in time to rest.
  const routed = new Set(
    allEvents(next)
      .filter((e) => e.lastOutcome === 'lost')
      .flatMap((e) => e.assigned)
      .filter((id) => {
        const r = resourceById(next, id) as ResourceState;
        return rules.resolution.morale.routOnRefuseWhileAttached && r.morale <= rules.resolution.morale.refuseAt;
      }),
  );

  const castle = runCastlePhase(next, { deployed }, rules);
  next = castle.state;

  if (routed.size) {
    const drop = <T extends EventState>(e: T): T => ({ ...e, assigned: e.assigned.filter((id) => !routed.has(id)) });
    next = { ...next, events: { ...next.events, portals: next.events.portals.map(drop), temples: next.events.temples.map(drop) } };
  }

  return {
    ...next,
    rngState: rng.state,
    log: [
      ...state.log,
      {
        turn: state.events.turn,
        commanderId: state.commanderId,
        battles: pending.battles,
        events: report,
        civilianDeaths: events.civilianDeaths - state.events.civilianDeaths,
        routed: [...routed],
        completed: castle.completed,
      },
    ],
  };
}

/** Resolve and commit in one step, with no DM review. */
export function endTurn(state: GameState, rules: Rules): GameState {
  return commitTurn(state, resolveAll(state, rules), rules);
}
