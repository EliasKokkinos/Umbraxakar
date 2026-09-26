import { GroupSeed, HeroSeed, ResourcesSeed, Trait } from './seed-types';

export type InjurySeverity = 'minor' | 'serious' | 'grievous';

export interface Injury {
  severity: InjurySeverity;
  /** Turns spent resting or in a healing slot; used by the Castle phase. */
  turnsTreated: number;
}

interface ResourceStateBase {
  id: string;
  name: string;
  faction: string;
  power: number;
  morale: number;
  tags: string[];
  canCleanse: boolean;
  locked: boolean;
  lockReason?: string;
  traits: Trait[];
  notes: string;
  /** Optional shipped portrait path; uploaded portraits live apart, in the portrait store. */
  image?: string;
  /** Id of the card this resource is attached to, or null when it is its own card. */
  attachedTo: string | null;
  trainingBonus: number;
  trainingTurnsLeft: number;
}

export interface HeroState extends ResourceStateBase {
  kind: 'hero' | 'avatar';
  injuryResistance: number;
  injuries: Injury[];
  /** "Fallen?": out of play until the DM decides. The system never kills a hero. */
  fallen: boolean;
}

export interface GroupState extends ResourceStateBase {
  kind: 'group';
  number: number;
  maxNumber: number;
  injured: number;
  replenishable: boolean;
  recruitRate?: number;
  decimationResistance: number;
  forged: boolean;
}

export type ResourceState = HeroState | GroupState;

const base = (s: HeroSeed | GroupSeed) => ({
  id: s.id,
  name: s.name,
  faction: s.faction,
  power: s.power,
  morale: s.morale,
  tags: [...s.tags],
  canCleanse: s.canCleanse,
  locked: s.locked,
  lockReason: s.lockReason,
  traits: s.traits ? [...s.traits] : [],
  notes: s.notes,
  image: s.image,
  attachedTo: null,
  trainingBonus: 0,
  trainingTurnsLeft: 0,
});

export function heroFromSeed(s: HeroSeed, kind: 'hero' | 'avatar' = 'hero'): HeroState {
  return { ...base(s), kind, injuryResistance: s.injuryResistance, injuries: [], fallen: false };
}

export function groupFromSeed(s: GroupSeed): GroupState {
  return {
    ...base(s),
    kind: 'group',
    number: s.number,
    maxNumber: s.maxNumber,
    injured: s.injured,
    replenishable: s.replenishable,
    recruitRate: s.recruitRate,
    decimationResistance: s.decimationResistance,
    forged: false,
  };
}

export function resourcesFromSeed(seed: ResourcesSeed): ResourceState[] {
  return [
    ...seed.heroes.map((h) => heroFromSeed(h, 'hero')),
    ...seed.avatars.map((a) => heroFromSeed(a, 'avatar')),
    ...seed.groups.map(groupFromSeed),
  ];
}

export function resistanceOf(r: ResourceState): number {
  return r.kind === 'group' ? r.decimationResistance : r.injuryResistance;
}
