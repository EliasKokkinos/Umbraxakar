// The chance to win a battle, before any dice are thrown. The formula is public, so the table may see it.
import { eventDifficulty } from './assignment';
import { eventPower, targetNumber } from './battle';
import { EventState } from './event-state';
import { GameState, Rules, attachedTo, eventById, eventOf, resourceById } from './game-state';
import { canDeploy } from './morale';
import { effectivePower } from './power';
import { battleInputFor } from './turn';

export interface Odds {
  eventPower: number;
  target: number;
  /** 0..1. A natural 20 always wins and a natural 1 always loses, so it stays within 5%..95%. */
  chance: number;
}

/** Chance that a d20 meets the target, counting natural 1s and 20s. */
export function winChance(target: number): number {
  return Math.min(19, Math.max(1, 21 - target)) / 20;
}

function oddsOf(state: GameState, event: EventState, rules: Rules): Odds | null {
  const input = battleInputFor(state, event, rules);
  if (!input.cards.length) return null;
  const powers = input.cards.map(
    (c) =>
      effectivePower(c.host, {
        cfg: rules.resolution,
        attached: c.attached,
        inTempleAura: input.inTempleAura,
        templeBonus: input.templeBonus,
        templeBonusTag: input.templeBonusTag,
      }).total,
  );
  const power = eventPower(powers, rules.resolution).total;
  const target = targetNumber(input.difficulty, power, rules.resolution);
  return { eventPower: power, target, chance: winChance(target) };
}

/** Odds with the cards already sent, or null when no one is there. */
export function currentOdds(state: GameState, eventId: string, rules: Rules): Odds | null {
  const event = eventById(state, eventId);
  return event ? oddsOf(state, event, rules) : null;
}

export type SendOdds = ({ ok: true } & Odds) | { ok: false; reason: string };

/** Odds if this card were sent here too (moved from wherever it is now). */
export function oddsIfSent(state: GameState, hostId: string, eventId: string, rules: Rules): SendOdds {
  const host = resourceById(state, hostId);
  const event = eventById(state, eventId);
  if (!host || !event) return { ok: false, reason: 'Unknown' };
  const power = effectivePower(host, { cfg: rules.resolution, attached: attachedTo(state, hostId) }).total;
  const check = canDeploy(host, eventDifficulty(event), power, rules.resolution);
  if (!check.ok) return check;

  const from = eventOf(state, hostId);
  const move = (e: EventState): EventState => {
    const assigned = e.assigned.filter((id) => id !== hostId);
    return { ...e, assigned: e.id === eventId ? [...assigned, hostId] : assigned };
  };
  const moved: GameState = {
    ...state,
    events: {
      ...state.events,
      portals: state.events.portals.map((p) => (p.id === eventId || p.id === from?.id ? (move(p) as typeof p) : p)),
      temples: state.events.temples.map((t) => (t.id === eventId || t.id === from?.id ? (move(t) as typeof t) : t)),
    },
  };
  const odds = oddsOf(moved, eventById(moved, eventId)!, rules)!;
  return { ok: true, ...odds };
}
