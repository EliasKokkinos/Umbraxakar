import { HeroState, ResourceState } from './resource-state';
import { ResolutionConfig } from './seed-types';

export interface PowerPart {
  label: string;
  value: number;
}

/** A total plus the itemised breakdown shown on the DM screen and in the turn log. */
export interface PowerBreakdown {
  total: number;
  parts: PowerPart[];
}

export interface PowerContext {
  cfg: ResolutionConfig;
  /** Heroes attached to this card (ignored for attached heroes themselves). */
  attached?: HeroState[];
  /** True when the event lies inside an active Mother Dark temple aura. */
  inTempleAura?: boolean;
  templeBonus?: number;
  templeBonusTag?: string;
}

export function moraleModifier(morale: number, cfg: ResolutionConfig): number {
  return cfg.power.moraleModifier[String(morale)] ?? 0;
}

export function injuryPenalty(hero: HeroState, cfg: ResolutionConfig): number {
  const sum = hero.injuries.reduce((acc, i) => acc + cfg.power.injuryPenalty[i.severity], 0);
  return Math.max(sum, cfg.power.injuryPenaltyMax);
}

/** Largest applicable penalty for a group's active strength ratio. */
export function strengthPenalty(activeRatio: number, cfg: ResolutionConfig): number {
  let modifier = 0;
  for (const step of cfg.power.groupStrengthPenalty) {
    if (activeRatio < step.below) modifier = Math.min(modifier, step.modifier);
  }
  return modifier;
}

export function effectivePower(r: ResourceState, ctx: PowerContext): PowerBreakdown {
  const { cfg } = ctx;
  const parts: PowerPart[] = [{ label: 'Base', value: r.power }];
  const add = (label: string, value: number) => {
    if (value !== 0) parts.push({ label, value });
  };

  add('Morale', moraleModifier(r.morale, cfg));

  if (r.kind === 'group') {
    const ratio = r.maxNumber > 0 ? (r.number - r.injured) / r.maxNumber : 0;
    add('Strength', strengthPenalty(ratio, cfg));
  } else {
    add('Injuries', injuryPenalty(r, cfg));
  }

  const attachedCount = ctx.attached?.length ?? 0;
  add('Attached heroes', Math.min(attachedCount * cfg.power.attachedHeroBonus, cfg.power.attachedHeroBonusMax));

  if (ctx.inTempleAura && ctx.templeBonusTag && r.tags.includes(ctx.templeBonusTag)) {
    add('Mother Dark', ctx.templeBonus ?? 0);
  }

  if (r.trainingTurnsLeft > 0) add('Training', r.trainingBonus);

  const raw = parts.reduce((acc, p) => acc + p.value, 0);
  return { total: Math.max(cfg.power.minimum, raw), parts };
}
