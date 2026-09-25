import { BattleResult, Harm } from './battle';
import { ResourceState } from './resource-state';
import { ResolutionConfig } from './seed-types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function clampMorale(morale: number, cfg: ResolutionConfig): number {
  return clamp(morale, cfg.morale.min, cfg.morale.max);
}

export type DeployCheck = { ok: true } | { ok: false; reason: string };

/**
 * Whether a resource may be assigned to an event of the given difficulty.
 * `effectivePower` is the resource's current effective Power, used by refusal traits.
 */
export function canDeploy(r: ResourceState, difficulty: number, effectivePower: number, cfg: ResolutionConfig): DeployCheck {
  if (r.locked) return { ok: false, reason: r.lockReason ?? 'Locked' };
  if (r.kind !== 'group' && r.fallen) return { ok: false, reason: 'Fallen' };
  if (r.kind !== 'group' && r.injuries.some((i) => i.severity === 'grievous')) {
    return { ok: false, reason: 'Grievously injured' };
  }
  if (r.kind === 'group' && r.number - r.injured <= 0) return { ok: false, reason: 'No fighting strength' };
  if (r.morale <= cfg.morale.refuseAt) return { ok: false, reason: 'Refuses' };
  for (const t of r.traits) {
    if (t.refuseIfDifficultyAtLeastPowerPlus !== undefined && difficulty >= effectivePower + t.refuseIfDifficultyAtLeastPowerPlus) {
      return { ok: false, reason: 'No suicidal orders' };
    }
  }
  return { ok: true };
}

/** Morale after serving at an event this turn. */
export function moraleAfterBattle(morale: number, result: Pick<BattleResult, 'outcome' | 'heroicVictory'>, cfg: ResolutionConfig): number {
  if (result.heroicVictory && cfg.morale.heroicVictoryNoLoss) return morale;
  let delta = cfg.morale.perTurnAtEvent;
  if (result.outcome === 'lost') delta += cfg.morale.extraOnLoss;
  return clampMorale(morale + delta, cfg);
}

/**
 * Commits a (possibly DM-edited) battle result to the resources that fought.
 * Returns new objects; inputs are not mutated.
 */
export function applyBattleResult(fought: ResourceState[], result: BattleResult, cfg: ResolutionConfig): ResourceState[] {
  const harmById = new Map<string, Harm>(result.harm.map((h) => [h.resourceId, h]));

  return fought.map((r) => {
    const morale = moraleAfterBattle(r.morale, result, cfg);
    const h = harmById.get(r.id);

    if (r.kind === 'group') {
      const killed = h?.kind === 'group' ? h.killed : 0;
      const injured = h?.kind === 'group' ? h.injured : 0;
      const number = Math.max(0, r.number - killed);
      return { ...r, morale, number, injured: Math.min(number, r.injured + injured) };
    }

    if (h?.kind === 'hero' && h.harmed && h.severity) {
      if (h.fallen) return { ...r, morale, fallen: true };
      return { ...r, morale, injuries: [...r.injuries, { severity: h.severity, turnsTreated: 0 }] };
    }
    return { ...r, morale };
  });
}
