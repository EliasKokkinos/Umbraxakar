import { EventState } from './event-state';
import {
  GameState,
  Result,
  Rules,
  attachedTo,
  eventById,
  eventOf,
  fail,
  isOccupied,
  ok,
  resourceById,
} from './game-state';
import { canDeploy } from './morale';
import { effectivePower } from './power';

const MAX_ATTACHED = 3;

export function eventDifficulty(e: EventState): number {
  return e.type === 'chaos-portal' ? e.difficulty : e.activationDifficulty;
}

function withEvent(state: GameState, id: string, change: (e: EventState) => EventState): GameState {
  const events = state.events;
  return {
    ...state,
    events: {
      ...events,
      portals: events.portals.map((p) => (p.id === id ? (change(p) as typeof p) : p)),
      temples: events.temples.map((t) => (t.id === id ? (change(t) as typeof t) : t)),
    },
  };
}

/** The message when a hero is sent alone: heroes take the field only with a group. */
export const heroesGoWithAGroup = (name: string) => `${name} takes the field with a group: attach them to one first`;

/** Sends a group, and the heroes attached to it, to an event. Only groups go into the field. */
export function assign(state: GameState, hostId: string, eventId: string, rules: Rules): Result {
  const host = resourceById(state, hostId);
  const event = eventById(state, eventId);
  if (!host) return fail(`No resource ${hostId}`);
  if (!event) return fail(`No event ${eventId}`);
  if (host.kind !== 'group') return fail(heroesGoWithAGroup(host.name));
  if (event.type === 'chaos-portal' && event.status === 'closed') return fail('That portal is closed');
  if (event.type === 'mother-dark-temple' && (event.active || !event.discovered)) return fail('That temple cannot be activated');
  if (isOccupied(state, hostId)) return fail(`${host.name} is occupied at the castle`);

  const current = eventOf(state, hostId);
  if (current?.id === eventId) return ok(state);
  if (current) return fail(`${host.name} is already at ${current.name}`);

  const attached = attachedTo(state, hostId);
  const power = effectivePower(host, { cfg: rules.resolution, attached }).total;
  const check = canDeploy(host, eventDifficulty(event), power, rules.resolution);
  if (!check.ok) return fail(`${host.name}: ${check.reason}`);
  // Every hero with the group must be willing too: one who refuses holds the group back.
  for (const hero of attached) {
    const heroPower = effectivePower(hero, { cfg: rules.resolution }).total;
    const heroCheck = canDeploy(hero, eventDifficulty(event), heroPower, rules.resolution);
    if (!heroCheck.ok) return fail(`${hero.name}: ${heroCheck.reason}. Detach them to send ${host.name}.`);
  }

  return ok(withEvent(state, eventId, (e) => ({ ...e, assigned: [...e.assigned, hostId] })));
}

/** Brings a card home. Resources that lost last turn stay pinned to the event. */
export function unassign(state: GameState, hostId: string): Result {
  const event = eventOf(state, hostId);
  if (!event) return ok(state);
  const lastBattle = state.log.at(-1)?.battles[event.id];
  const foughtAndLost = event.lastOutcome === 'lost' && lastBattle?.cardPowers.some((c) => c.resourceId === hostId);
  if (foughtAndLost) return fail('Resources that lost a battle remain at the event');
  return ok(withEvent(state, event.id, (e) => ({ ...e, assigned: e.assigned.filter((id) => id !== hostId) })));
}

/** Attaches a hero to a group, up to three per group. Heroes take the field only this way. */
export function attach(state: GameState, heroId: string, hostId: string): Result {
  const hero = resourceById(state, heroId);
  const host = resourceById(state, hostId);
  if (!hero || hero.kind === 'group') return fail('Only heroes can be attached');
  if (!host) return fail(`No resource ${hostId}`);
  if (host.kind !== 'group') return fail(`${hero.name} can only join a group`);
  if (attachedTo(state, hostId).length >= MAX_ATTACHED) return fail(`${host.name} already has ${MAX_ATTACHED} heroes`);
  if (eventOf(state, heroId) || eventOf(state, hostId)) return fail('Attach and detach at the castle');
  if (isOccupied(state, heroId)) return fail(`${hero.name} is occupied at the castle`);
  if (hero.locked) return fail(hero.lockReason ?? 'Locked');

  return ok({ ...state, resources: state.resources.map((r) => (r.id === heroId ? { ...r, attachedTo: hostId } : r)) });
}

export function detach(state: GameState, heroId: string): Result {
  const hero = resourceById(state, heroId);
  if (!hero?.attachedTo) return ok(state);
  if (eventOf(state, heroId)) return fail('Attach and detach at the castle');
  return ok({ ...state, resources: state.resources.map((r) => (r.id === heroId ? { ...r, attachedTo: null } : r)) });
}
