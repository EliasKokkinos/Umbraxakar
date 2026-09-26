import { Point, TempleSeed } from './seed-types';

/** What happened at an event in the most recent resolution. */
export type EventOutcome = 'won' | 'contained' | 'lost' | 'unopposed';

interface EventBase {
  id: string;
  name: string;
  position: Point;
  regionId: string | null;
  /** DM-only when true: never rendered on the table screen. */
  hidden: boolean;
  /** Resource ids of the cards assigned here (attached heroes travel with their host). */
  assigned: string[];
  dmNotes: string;
  createdTurn: number;
  lastOutcome: EventOutcome | null;
}

export interface PortalState extends EventBase {
  type: 'chaos-portal';
  corruption: number;
  difficulty: number;
  impact: number;
  legendary: boolean;
  status: 'open' | 'closed';
}

export interface TempleState extends EventBase {
  type: 'mother-dark-temple';
  origin: TempleSeed['origin'];
  active: boolean;
  discovered: boolean;
  activationDifficulty: number;
  placeholder: boolean;
}

export type EventState = PortalState | TempleState;

export interface EventsState {
  turn: number;
  portals: PortalState[];
  temples: TempleState[];
  civilianDeaths: number;
  nextPortalSerial: number;
  /** The DM's reach for every Mother Dark temple, as a share of the map's width; null keeps the config's. */
  auraRadius: number | null;
}

export function templeFromSeed(t: TempleSeed): TempleState {
  return {
    id: t.id,
    type: 'mother-dark-temple',
    name: t.name,
    position: { ...t.position },
    regionId: null,
    // Undiscovered temples stay off the table until the DM reveals them.
    hidden: !t.discovered,
    assigned: [],
    dmNotes: t.notes,
    createdTurn: 0,
    lastOutcome: null,
    origin: t.origin,
    active: t.active,
    discovered: t.discovered,
    activationDifficulty: t.activationDifficulty,
    placeholder: t.placeholder,
  };
}
