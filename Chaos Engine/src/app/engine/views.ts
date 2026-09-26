// Read models for the screens. Pure: computed from state, never stored.
import { eventDifficulty } from './assignment';
import { BattleResult, Harm } from './battle';
import { EventState } from './event-state';
import { inTempleAura } from './events';
import { GameState, Rules, allEvents, attachedTo, eventById, eventOf, isOccupied, resourceById } from './game-state';
import { canDeploy } from './morale';
import { PowerBreakdown, effectivePower } from './power';
import { InjurySeverity, ResourceState } from './resource-state';

export type Location = { kind: 'castle' } | { kind: 'event'; id: string; name: string };

export interface ResourceView {
  id: string;
  name: string;
  kind: ResourceState['kind'];
  faction: string;
  power: PowerBreakdown;
  morale: number;
  /** The most important thing stopping or occupying the resource, if anything. */
  status: string | null;
  location: Location;
  attachedTo: string | null;
  attached: { id: string; name: string }[];
  injuries: InjurySeverity[];
  number?: number;
  maxNumber?: number;
  injured?: number;
  canCleanse: boolean;
  locked: boolean;
  image?: string;
}

function powerInPlace(state: GameState, r: ResourceState, rules: Rules): PowerBreakdown {
  const event = eventOf(state, r.id);
  const inAura = !!event && inTempleAura(event.position, state.events.temples, rules.events, rules.map.map);
  return effectivePower(r, {
    cfg: rules.resolution,
    attached: r.attachedTo ? [] : attachedTo(state, r.id),
    inTempleAura: inAura,
    templeBonus: rules.events.temple.tisteAndiiPowerBonus,
    templeBonusTag: rules.events.temple.bonusTag,
  });
}

function statusOf(state: GameState, r: ResourceState, rules: Rules): string | null {
  if (r.locked) return 'Locked';
  if (r.kind !== 'group' && r.fallen) return 'Fallen?';
  if (state.castle.training.includes(r.id)) return 'Training';
  if (state.castle.treatments.some((t) => t.resourceId === r.id)) return 'Healing';
  if (r.kind !== 'group' && r.injuries.some((i) => i.severity === 'grievous')) return 'Grievously injured';
  if (r.morale <= rules.resolution.morale.refuseAt) return 'Refuses';
  return null;
}

export function resourceView(state: GameState, r: ResourceState, rules: Rules): ResourceView {
  const event = eventOf(state, r.id);
  const view: ResourceView = {
    id: r.id,
    name: r.name,
    kind: r.kind,
    faction: r.faction,
    power: powerInPlace(state, r, rules),
    morale: r.morale,
    status: statusOf(state, r, rules),
    location: event ? { kind: 'event', id: event.id, name: event.name } : { kind: 'castle' },
    attachedTo: r.attachedTo,
    attached: attachedTo(state, r.id).map((h) => ({ id: h.id, name: h.name })),
    injuries: r.kind === 'group' ? [] : r.injuries.map((i) => i.severity),
    canCleanse: r.canCleanse,
    locked: r.locked,
    image: r.image,
  };
  if (r.kind === 'group') Object.assign(view, { number: r.number, maxNumber: r.maxNumber, injured: r.injured });
  return view;
}

export interface Option {
  id: string;
  name: string;
  value: number;
  ok: boolean;
  reason?: string;
}

function isContestable(e: EventState): boolean {
  return e.type === 'chaos-portal' ? e.status === 'open' : !e.active && e.discovered;
}

/** Events a card could be sent to, most dangerous first, with why not when blocked. */
export function eventOptionsFor(state: GameState, hostId: string, rules: Rules): Option[] {
  const host = state.resources.find((r) => r.id === hostId);
  if (!host) return [];
  const power = effectivePower(host, { cfg: rules.resolution, attached: attachedTo(state, hostId) }).total;
  return allEvents(state)
    .filter(isContestable)
    .map((e) => {
      const d = eventDifficulty(e);
      const check = canDeploy(host, d, power, rules.resolution);
      return { id: e.id, name: e.name, value: d, ok: check.ok, reason: check.ok ? undefined : check.reason };
    })
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

/** Cards that could join an event, strongest first, with why not when blocked. */
export function hostOptionsFor(state: GameState, eventId: string, rules: Rules): Option[] {
  const event = allEvents(state).find((e) => e.id === eventId);
  if (!event) return [];
  const d = eventDifficulty(event);
  return state.resources
    .filter((r) => !r.attachedTo && !event.assigned.includes(r.id))
    .map((r) => {
      const power = effectivePower(r, { cfg: rules.resolution, attached: attachedTo(state, r.id) }).total;
      const elsewhere = eventOf(state, r.id);
      const check = canDeploy(r, d, power, rules.resolution);
      const reason = elsewhere
        ? `At ${elsewhere.name}`
        : isOccupied(state, r.id)
          ? 'Occupied at the castle'
          : check.ok
            ? undefined
            : check.reason;
      return { id: r.id, name: r.name, value: power, ok: !reason, reason };
    })
    .sort((a, b) => Number(b.ok) - Number(a.ok) || b.value - a.value);
}

/** The in-game day on which a turn begins (a turn is three days). */
export function dayOfTurn(turn: number, daysPerTurn: number): number {
  return (turn - 1) * daysPerTurn + 1;
}

const numberFormat = new Intl.NumberFormat('en-GB');
const fmt = (n: number) => numberFormat.format(n);
const turns = (n: number) => `${n} turn${n === 1 ? '' : 's'}`;

function nameOf(state: GameState, id: string): string {
  return resourceById(state, id)?.name ?? eventById(state, id)?.name ?? id;
}

/** One harm result as a line of the turn report, or null when unharmed. */
export function harmText(h: Harm, name: string): string | null {
  if (!h.harmed) return null;
  if (h.kind === 'group') return `${name}: ${fmt(h.killed)} killed, ${fmt(h.injured)} injured`;
  if (h.fallen) return `${name}: fallen? The DM decides`;
  return `${name}: ${h.severity} injury`;
}

export function harmLines(state: GameState, b: BattleResult): string[] {
  return b.harm.flatMap((h) => harmText(h, nameOf(state, h.resourceId)) ?? []);
}

/** Castle work in progress, in words. */
export function castleWork(state: GameState, rules: Rules): string[] {
  const c = state.castle;
  const facility = (id: string) => rules.castle.facilities.find((f) => f.id === id)?.name ?? id;
  const lines = c.projects.map((p) =>
    p.kind === 'militia'
      ? `Militia mustering: ${turns(p.turnsLeft)}`
      : p.kind === 'forge'
        ? `Forging arms for ${nameOf(state, p.groupId)}: ${turns(p.turnsLeft)}`
        : `Rebuilding the ${facility(p.facilityId)}: ${turns(p.turnsLeft)}`,
  );
  for (const t of c.treatments) lines.push(`Healing ${nameOf(state, t.resourceId)}: ${turns(t.turnsLeft)}`);
  for (const id of c.training) lines.push(`Training ${nameOf(state, id)} this turn`);
  if (c.entertainersTurnsLeft) lines.push(`Entertainers: ${turns(c.entertainersTurnsLeft)}`);
  return lines;
}

export interface TurnReport {
  turn: number;
  deaths: number;
  closed: string[];
  contained: string[];
  legendary: string[];
  temples: string[];
  newPortals: number;
  unplaced: number;
  routed: string[];
  harm: string[];
  completed: string[];
}

/** The most recent turn, in names rather than ids. */
export function lastTurnReport(state: GameState, rules: Rules): TurnReport | null {
  const last = state.log.at(-1);
  if (!last) return null;
  const names = (ids: string[]) => ids.map((id) => nameOf(state, id));
  const completed = last.completed.map((key) => {
    const [kind, id, level] = key.split(':');
    if (kind === 'heal') return `${nameOf(state, id)} leaves the Healers' Hall`;
    if (kind === 'forge') return `${nameOf(state, id)} are armed from Draconus's forge`;
    if (kind === 'militia') return `${nameOf(state, id)} stand ready`;
    return `The ${rules.castle.facilities.find((f) => f.id === id)?.name ?? id} reaches level ${level}`;
  });
  return {
    turn: last.turn,
    deaths: last.civilianDeaths,
    closed: names(last.events.closed),
    contained: names(last.events.contained),
    legendary: names(last.events.legendarySpawns),
    temples: names(last.events.activatedTemples),
    newPortals: last.events.newPortals.length,
    unplaced: last.events.unplacedPortals,
    routed: names(last.routed),
    harm: Object.values(last.battles).flatMap((b) => harmLines(state, b)),
    completed,
  };
}
