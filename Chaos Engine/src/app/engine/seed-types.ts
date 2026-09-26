// Shapes of the JSON files in /data. Framework-free: nothing in engine/ may import Angular.

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How a commander's story sways one resource's morale when they take command. */
export interface CommanderInfluence {
  resourceId: string;
  morale: number;
  /** Player-facing: the table shows it. */
  reason: string;
}

export interface Commander {
  id: string;
  name: string;
  player: string;
  raceClass: string;
  level: number;
  divineRole: string;
  influence?: CommanderInfluence[];
}

export interface Trait {
  id: string;
  refuseIfDifficultyAtLeastPowerPlus?: number;
}

interface ResourceBase {
  id: string;
  name: string;
  faction: string;
  power: number;
  morale: number;
  tags: string[];
  canCleanse: boolean;
  locked: boolean;
  lockReason?: string;
  traits?: Trait[];
  notes: string;
  /** Optional portrait shipped with the campaign, relative to public/ (e.g. "portraits/karsa.jpg"). */
  image?: string;
}

export interface HeroSeed extends ResourceBase {
  injuryResistance: number;
}

export type AvatarSeed = HeroSeed;

export interface GroupSeed extends ResourceBase {
  number: number;
  maxNumber: number;
  replenishable: boolean;
  recruitRate?: number;
  decimationResistance: number;
  injured: number;
  numberEstimated?: boolean;
}

export interface ResourcesSeed {
  heroes: HeroSeed[];
  avatars: AvatarSeed[];
  groups: GroupSeed[];
}

export interface TempleSeed {
  id: string;
  name: string;
  origin: 'story' | 'ally' | 'undiscovered';
  active: boolean;
  discovered: boolean;
  activationDifficulty: number;
  position: Point;
  placeholder: boolean;
  notes: string;
}

export interface LandDetection {
  mode: 'color' | 'mask';
  seaColor?: string;
  tolerance?: number;
  sampleRadiusPx?: number;
  minLandRatio?: number;
  maskAsset?: string;
}

export interface Region extends Rect {
  name: string;
}

export interface MapDef {
  id: string;
  name: string;
  source: string;
  asset: string;
  width: number;
  height: number;
  landDetection: LandDetection;
  noSpawnZones: Rect[];
  regions: Region[];
}

export interface MapSeed {
  activeMapId: string;
  maps: MapDef[];
}

export interface EventsConfig {
  portal: {
    startingCorruption: number;
    maxCorruption: number;
    corruptionPerRound: number;
    wonBattleHaltsCorruption: boolean;
    deepCorruptionThreshold: number;
    legendaryAtCorruption: number;
    difficultySeedRange: [number, number];
    maxDifficulty: number;
    maxDifficultyLegendary: number;
    impactSeedRange: [number, number];
    maxImpact: number;
    civiliansPerImpact: number;
    casualtyVariance: [number, number];
    lostBattleCasualtyFactor: number;
    initialSeed: string;
    newPortalsPerRound: string;
    minSpacing: number;
  };
  temple: {
    total: number;
    auraRadius: number;
    corruptionCapInAura: number;
    tisteAndiiPowerBonus: number;
    bonusTag: string;
  };
  turn: { daysPerTurn: number };
  portalNames: { descriptors: string[]; nouns: string[] };
}

export interface SeverityBand {
  max: number;
  result: string;
  killed?: number;
  injured?: number;
}

export interface HarmCurve {
  base: number;
  perThreat: number;
  clamp: [number, number];
}

export interface ResolutionConfig {
  roll: { die: number; baseTarget: number; targetClamp: [number, number]; natural1: string; natural20: string };
  power: {
    minimum: number;
    supportBonusPerExtraCard: number;
    supportBonusMax: number;
    /** Each attached hero adds their effective Power divided by this, rounded up. */
    attachedHeroShare: number;
    attachedHeroBonusMax: number;
    moraleModifier: Record<string, number | null>;
    injuryPenalty: Record<'minor' | 'serious' | 'grievous', number>;
    injuryPenaltyMax: number;
    groupStrengthPenalty: { below: number; modifier: number }[];
  };
  harm: {
    won: HarmCurve;
    lost: HarmCurve;
    legendaryBonus: number;
    routBonus: number;
    heroicVictoryNoHarm: boolean;
    severityDie: number;
    heroSeverity: SeverityBand[];
    groupSeverity: SeverityBand[];
    groupMinimumLoss: number;
    heroDeath: 'dm-decides';
  };
  morale: {
    min: number;
    max: number;
    perTurnAtEvent: number;
    extraOnLoss: number;
    heroicVictoryNoLoss: boolean;
    refuseAt: number;
    routOnRefuseWhileAttached: boolean;
  };
}

export interface FacilitySeed {
  id: string;
  name: string;
  level: number;
  keeper?: string;
  levels: Record<string, Record<string, number | boolean>>;
}

export interface MilitiaTemplate {
  name: string;
  faction: string;
  power: number;
  morale: number;
  number: number;
  maxNumber: number;
  replenishable: boolean;
  decimationResistance: number;
  tags: string[];
}

export interface CastleActionsConfig {
  entertainers: { cost: number; durationTurns: number; moraleBonus: number };
  train: { cost: number; durationTurns: number; moraleCost: number; minMorale: number };
  heal: { costs: { serious: number; grievous: number }; grievousTurnsInSlot: number; grievousHealsTo: 'serious' };
  recruit: { costPerSoldier: number; defaultRecruitRate: number };
  militia: { cost: number; turns: number; template: MilitiaTemplate };
  forgeArms: { cost: number; powerBonus: number; oncePerGroup: boolean };
  wine: { cost: number; moraleBonus: number; liftsRefusal: boolean };
}

export interface CastleSeed {
  name: string;
  position: Point & { placeholder?: boolean };
  treasury: number;
  treasuryEstimated: boolean;
  incomePerTurn: number;
  showTreasuryOnTable: boolean;
  upgrade: { turnsToBuild: number; costs: Record<string, number>; operatesAtOldLevelWhileBuilding: boolean };
  facilities: FacilitySeed[];
  actions: CastleActionsConfig;
  rest: { minorTurns: number; seriousTurns: number; grievousHealsByRest: boolean };
  healerHeroSlotBonus: number;
}

/** Everything loaded from /data, bundled. */
export interface Seed {
  commanders: Commander[];
  resources: ResourcesSeed;
  temples: TempleSeed[];
  map: MapSeed;
  eventsConfig: EventsConfig;
  resolutionConfig: ResolutionConfig;
  castle: CastleSeed;
}

/** File name in /data for each Seed key. */
export const SEED_FILES: Record<keyof Seed, string> = {
  commanders: 'commanders.json',
  resources: 'resources.json',
  temples: 'temples.json',
  map: 'map.json',
  eventsConfig: 'events-config.json',
  resolutionConfig: 'resolution-config.json',
  castle: 'castle.json',
};
