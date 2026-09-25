// What the table (the TV) may know. This is the only data that ever leaves the DM window,
// so DM-only information cannot leak by construction: it is simply never put in.
import { BattleResult } from './battle';
import { facilityLevel } from './castle';
import { PortalState, TempleState } from './event-state';
import { GameState, Rules, resourceById } from './game-state';
import { Commander, MapDef } from './seed-types';
import { PendingResolution } from './turn';
import { ResourceView, TurnReport, castleWork, dayOfTurn, lastTurnReport, resourceView } from './views';

export const TABLE_VIEW_VERSION = 1;

export type TableMap = Omit<MapDef, 'source'>;

export interface TableBattle {
  eventId: string;
  eventName: string;
  d20: number;
  target: number;
  eventPower: number;
  outcome: BattleResult['outcome'];
  rout: boolean;
  heroicVictory: boolean;
  cards: string[];
}

export interface TableView {
  version: number;
  turn: number;
  day: number;
  commander: { name: string; player: string } | null;
  civilianDeaths: number;
  openPortals: number;
  /** Null when the DM keeps the Company's finances off the table. */
  treasury: number | null;
  map: TableMap;
  auraRadius: number;
  portals: PortalState[];
  temples: TempleState[];
  resources: ResourceView[];
  castle: { name: string; facilities: { id: string; name: string; level: number }[]; work: string[] };
  /** Battles the DM has revealed during the reckoning; null outside it. */
  reckoning: TableBattle[] | null;
  /** The turn report, while the DM is showing it. */
  report: TurnReport | null;
}

/** What the DM has chosen to show at this moment. */
export interface Reveal {
  /** Pending battles, when the reckoning is under way. */
  pending: PendingResolution | null;
  /** Event ids whose battle the DM has revealed. */
  revealed: string[];
  showReport: boolean;
}

export const NO_REVEAL: Reveal = { pending: null, revealed: [], showReport: false };

function tablePortal(p: PortalState): PortalState {
  return { ...p, dmNotes: '', hidden: false };
}

function tableTemple(t: TempleState): TempleState {
  return { ...t, dmNotes: '', hidden: false };
}

function tableMap(map: MapDef): TableMap {
  const { source: _source, ...rest } = map;
  return rest;
}

export function tableView(state: GameState, rules: Rules, commanders: Commander[], reveal: Reveal = NO_REVEAL): TableView {
  const commander = commanders.find((c) => c.id === state.commanderId);
  const portals = state.events.portals.filter((p) => p.status === 'open' && !p.hidden).map(tablePortal);
  const temples = state.events.temples.filter((t) => !t.hidden).map(tableTemple);
  const shownEvents = new Set([...portals, ...temples].map((e) => e.id));

  // Locked resources are future allies the players have not earned; the fallen await the DM's word.
  const shown = (r: GameState['resources'][number]) => !r.locked && !(r.kind !== 'group' && r.fallen);
  const shownIds = new Set(state.resources.filter(shown).map((r) => r.id));
  const resources = state.resources
    .filter(shown)
    .map((r) => {
      const v = resourceView(state, r, rules);
      v.attached = v.attached.filter((h) => shownIds.has(h.id));
      // A card sent to a hidden event is shown as simply away.
      if (v.location.kind === 'event' && !shownEvents.has(v.location.id)) v.location = { kind: 'castle' };
      return v;
    });

  const reckoning = reveal.pending
    ? reveal.revealed.flatMap((id): TableBattle[] => {
        const b = reveal.pending!.battles[id];
        if (!shownEvents.has(id)) return [];
        const name = [...state.events.portals, ...state.events.temples].find((e) => e.id === id)?.name;
        if (!b || !name) return [];
        return [
          {
            eventId: id,
            eventName: name,
            d20: b.d20,
            target: b.target,
            eventPower: b.eventPower,
            outcome: b.outcome,
            rout: b.rout,
            heroicVictory: b.heroicVictory,
            cards: b.cardPowers.map((c) => resourceById(state, c.resourceId)?.name ?? c.resourceId),
          },
        ];
      })
    : null;

  return {
    version: TABLE_VIEW_VERSION,
    turn: state.events.turn,
    day: dayOfTurn(state.events.turn, rules.events.turn.daysPerTurn),
    commander: commander ? { name: commander.name, player: commander.player } : null,
    civilianDeaths: state.events.civilianDeaths,
    openPortals: portals.length,
    treasury: state.castle.showTreasuryOnTable ? state.castle.treasury : null,
    map: tableMap(rules.map.map),
    auraRadius: rules.events.temple.auraRadius,
    portals,
    temples,
    resources,
    castle: {
      name: rules.castle.name,
      facilities: rules.castle.facilities.map((f) => ({ id: f.id, name: f.name, level: facilityLevel(state, f.id) })),
      work: castleWork(state, rules),
    },
    reckoning,
    report: reveal.showReport ? lastTurnReport(state, rules) : null,
  };
}
