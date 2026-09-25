import { PowerBreakdown, effectivePower } from './power';
import { GroupState, HeroState, InjurySeverity, ResourceState, resistanceOf } from './resource-state';
import { Rng } from './rng';
import { HarmCurve, ResolutionConfig, SeverityBand } from './seed-types';

/** One card on an event: a host resource plus any heroes attached to it. */
export interface Card {
  host: ResourceState;
  attached: HeroState[];
}

export interface BattleInput {
  difficulty: number;
  legendary: boolean;
  cards: Card[];
  inTempleAura: boolean;
  templeBonus: number;
  templeBonusTag: string;
}

export type Outcome = 'won' | 'lost';

export interface HeroHarm {
  kind: 'hero';
  resourceId: string;
  threat: number;
  chance: number;
  harmed: boolean;
  severityRoll?: number;
  severity?: InjurySeverity;
  /** Grievous on an already grievous hero: flagged for the DM, never auto-killed. */
  fallen?: boolean;
}

export interface GroupHarm {
  kind: 'group';
  resourceId: string;
  threat: number;
  chance: number;
  harmed: boolean;
  severityRoll?: number;
  band?: string;
  killed: number;
  injured: number;
}

export type Harm = HeroHarm | GroupHarm;

export interface BattleResult {
  cardPowers: { resourceId: string; power: PowerBreakdown }[];
  eventPower: number;
  supportBonus: number;
  target: number;
  d20: number;
  outcome: Outcome;
  rout: boolean;
  heroicVictory: boolean;
  harm: Harm[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

export function eventPower(cardPowers: number[], cfg: ResolutionConfig): { total: number; support: number } {
  if (cardPowers.length === 0) return { total: 0, support: 0 };
  const support = Math.min((cardPowers.length - 1) * cfg.power.supportBonusPerExtraCard, cfg.power.supportBonusMax);
  return { total: Math.max(...cardPowers) + support, support };
}

export function targetNumber(difficulty: number, power: number, cfg: ResolutionConfig): number {
  const [lo, hi] = cfg.roll.targetClamp;
  return clamp(cfg.roll.baseTarget + (difficulty - power), lo, hi);
}

/** Natural 1 always fails, natural 20 always succeeds. */
export function judgeRoll(d20: number, target: number): { outcome: Outcome; rout: boolean; heroicVictory: boolean } {
  if (d20 === 1) return { outcome: 'lost', rout: true, heroicVictory: false };
  if (d20 === 20) return { outcome: 'won', rout: false, heroicVictory: true };
  return { outcome: d20 >= target ? 'won' : 'lost', rout: false, heroicVictory: false };
}

export function harmChance(
  threat: number,
  outcome: Outcome,
  flags: { legendary: boolean; rout: boolean; heroicVictory: boolean },
  cfg: ResolutionConfig,
): number {
  if (flags.heroicVictory && cfg.harm.heroicVictoryNoHarm) return 0;
  const curve: HarmCurve = outcome === 'won' ? cfg.harm.won : cfg.harm.lost;
  let p = clamp(curve.base + curve.perThreat * threat, curve.clamp[0], curve.clamp[1]);
  if (flags.legendary) p += cfg.harm.legendaryBonus;
  if (flags.rout) p += cfg.harm.routBonus;
  return round2(clamp(p, 0, 1));
}

export function severityBand(roll: number, bands: SeverityBand[]): SeverityBand {
  return bands.find((b) => roll <= b.max) ?? bands[bands.length - 1];
}

/** Losses for a harmed group, taken from its active (uninjured) strength. */
export function groupLosses(group: GroupState, band: SeverityBand, cfg: ResolutionConfig): { killed: number; injured: number } {
  const active = Math.max(0, group.number - group.injured);
  if (active === 0) return { killed: 0, injured: 0 };
  const min = cfg.harm.groupMinimumLoss;
  const killed = Math.min(active, Math.max(min, Math.round(active * (band.killed ?? 0))));
  const injured = Math.min(active - killed, Math.max(min, Math.round(active * (band.injured ?? 0))));
  return { killed, injured };
}

function powerOf(r: ResourceState, input: BattleInput, cfg: ResolutionConfig, attached: HeroState[] = []): PowerBreakdown {
  return effectivePower(r, {
    cfg,
    attached,
    inTempleAura: input.inTempleAura,
    templeBonus: input.templeBonus,
    templeBonusTag: input.templeBonusTag,
  });
}

/**
 * Rolls one event battle. Pure with respect to the resources: nothing is mutated, so the DM can
 * inspect, override or reroll before `applyBattleResult` commits it.
 */
export function resolveBattle(input: BattleInput, rng: Rng, cfg: ResolutionConfig): BattleResult {
  const cardPowers = input.cards.map((c) => ({ resourceId: c.host.id, power: powerOf(c.host, input, cfg, c.attached) }));
  const { total, support } = eventPower(
    cardPowers.map((c) => c.power.total),
    cfg,
  );
  const target = targetNumber(input.difficulty, total, cfg);
  const d20 = rng.d(cfg.roll.die);
  const judged = judgeRoll(d20, target);
  const flags = { legendary: input.legendary, ...judged };

  const harm: Harm[] = [];
  for (const card of input.cards) {
    // Threat uses each member's own Power, so weak units bleed even beside a strong hero.
    const members: ResourceState[] = [card.host, ...card.attached];
    for (const m of members) {
      const own = powerOf(m, input, cfg).total;
      const threat = input.difficulty - own - resistanceOf(m);
      harm.push(rollHarm(m, threat, judged.outcome, flags, rng, cfg));
    }
  }

  return { cardPowers, eventPower: total, supportBonus: support, target, d20, ...judged, harm };
}

function rollHarm(
  r: ResourceState,
  threat: number,
  outcome: Outcome,
  flags: { legendary: boolean; rout: boolean; heroicVictory: boolean },
  rng: Rng,
  cfg: ResolutionConfig,
): Harm {
  const chance = harmChance(threat, outcome, flags, cfg);
  const harmed = chance > 0 && rng.chance(chance);

  if (r.kind === 'group') {
    const result: GroupHarm = { kind: 'group', resourceId: r.id, threat, chance, harmed, killed: 0, injured: 0 };
    if (!harmed) return result;
    const severityRoll = rng.d(cfg.harm.severityDie) + Math.max(0, threat);
    const band = severityBand(severityRoll, cfg.harm.groupSeverity);
    return { ...result, severityRoll, band: band.result, ...groupLosses(r, band, cfg) };
  }

  const result: HeroHarm = { kind: 'hero', resourceId: r.id, threat, chance, harmed };
  if (!harmed) return result;
  const severityRoll = rng.d(cfg.harm.severityDie) + Math.max(0, threat);
  const severity = severityBand(severityRoll, cfg.harm.heroSeverity).result as InjurySeverity;
  const fallen = severity === 'grievous' && r.injuries.some((i) => i.severity === 'grievous');
  return { ...result, severityRoll, severity, fallen };
}
