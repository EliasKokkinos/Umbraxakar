import { CastleState, GameState, Result, Rules, fail, isAtCastle, isOccupied, ok, resourceById } from './game-state';
import { clampMorale } from './morale';
import { GroupState, HeroState, Injury, ResourceState } from './resource-state';

// ---------------------------------------------------------------- facility lookups

export function facilityLevel(state: GameState, id: string): number {
  return state.castle.facilities[id] ?? 1;
}

/** A numeric property of a facility at its current level. */
export function facilityValue(state: GameState, rules: Rules, id: string, key: string): number {
  const f = rules.castle.facilities.find((x) => x.id === id);
  const v = f?.levels[String(facilityLevel(state, id))]?.[key];
  return typeof v === 'number' ? v : 0;
}

export function facilityFlag(state: GameState, rules: Rules, id: string, key: string): boolean {
  const f = rules.castle.facilities.find((x) => x.id === id);
  return f?.levels[String(facilityLevel(state, id))]?.[key] === true;
}

/** Healers' Hall slots plus one per healer hero at home and free. */
export function healSlots(state: GameState, rules: Rules): number {
  const healers = state.resources.filter(
    (r) => r.kind !== 'group' && r.tags.includes('healer') && !r.locked && isAtCastle(state, r.id) && !isOccupied(state, r.id),
  ).length;
  return facilityValue(state, rules, 'healers-hall', 'healSlots') + healers * rules.castle.healerHeroSlotBonus;
}

// ---------------------------------------------------------------- helpers

function spend(state: GameState, cost: number, change: (c: CastleState) => CastleState): Result {
  if (state.castle.treasury < cost) return fail(`Not enough gold (${cost} needed)`);
  return ok({ ...state, castle: change({ ...state.castle, treasury: state.castle.treasury - cost }) });
}

function updateResource(state: GameState, id: string, change: (r: ResourceState) => ResourceState): GameState {
  return { ...state, resources: state.resources.map((r) => (r.id === id ? change(r) : r)) };
}

function homeAndFree(state: GameState, r: ResourceState): string | null {
  if (!isAtCastle(state, r.id)) return `${r.name} is not at the castle`;
  if (isOccupied(state, r.id)) return `${r.name} is already occupied`;
  return null;
}

// ---------------------------------------------------------------- actions (planning phase)

export function hireEntertainers(state: GameState, rules: Rules): Result {
  if (state.castle.entertainersTurnsLeft > 0) return fail('Entertainers are already engaged');
  const cfg = rules.castle.actions.entertainers;
  const factor = facilityValue(state, rules, 'great-hall', 'entertainerCostFactor') || 1;
  return spend(state, Math.round(cfg.cost * factor), (c) => ({ ...c, entertainersTurnsLeft: cfg.durationTurns }));
}

export function train(state: GameState, id: string, rules: Rules): Result {
  const r = resourceById(state, id);
  if (!r) return fail(`No resource ${id}`);
  const busy = homeAndFree(state, r);
  if (busy) return fail(busy);
  const cfg = rules.castle.actions.train;
  if (r.morale < cfg.minMorale) return fail(`${r.name} is too dispirited to train`);
  if (state.castle.training.length >= facilityValue(state, rules, 'training-grounds', 'trainSlots')) {
    return fail('No free training slot');
  }
  const spent = spend(state, cfg.cost, (c) => ({ ...c, training: [...c.training, id] }));
  if (!spent.ok) return spent;
  return ok(updateResource(spent.state, id, (x) => ({ ...x, morale: clampMorale(x.morale - cfg.moraleCost, rules.resolution) })));
}

export function heal(state: GameState, id: string, rules: Rules): Result {
  const r = resourceById(state, id);
  if (!r || r.kind === 'group') return fail('Only heroes are healed in the Healers’ Hall');
  const busy = homeAndFree(state, r);
  if (busy) return fail(busy);
  const worst = r.injuries.some((i) => i.severity === 'grievous')
    ? 'grievous'
    : r.injuries.some((i) => i.severity === 'serious')
      ? 'serious'
      : null;
  if (!worst) return fail(`${r.name} needs rest, not a healer`);
  if (state.castle.treatments.length >= healSlots(state, rules)) return fail('No free healing slot');

  const cfg = rules.castle.actions.heal;
  const turnsLeft = worst === 'grievous' ? cfg.grievousTurnsInSlot : 1;
  return spend(state, cfg.costs[worst], (c) => ({
    ...c,
    treatments: [...c.treatments, { resourceId: id, severity: worst, turnsLeft }],
  }));
}

/** Most soldiers a group can recruit this turn. */
export function recruitCapacity(state: GameState, g: GroupState, rules: Rules): number {
  const rate = g.recruitRate ?? rules.castle.actions.recruit.defaultRecruitRate;
  const perTurn = Math.ceil(rate * g.maxNumber * facilityValue(state, rules, 'barracks', 'recruitMultiplier'));
  return Math.max(0, Math.min(perTurn, g.maxNumber - g.number));
}

export function recruit(state: GameState, id: string, requested: number, rules: Rules): Result {
  const g = resourceById(state, id);
  if (!g || g.kind !== 'group') return fail('Only groups recruit');
  if (!g.replenishable) return fail(`${g.name} can never be replenished`);
  if (!isAtCastle(state, id)) return fail(`${g.name} must be at the castle to recruit`);
  if (state.castle.recruits[id]) return fail(`${g.name} is already recruiting this turn`);
  const amount = Math.min(requested, recruitCapacity(state, g, rules));
  if (amount <= 0) return fail(`${g.name} has no room to recruit`);
  return spend(state, amount * rules.castle.actions.recruit.costPerSoldier, (c) => ({
    ...c,
    recruits: { ...c.recruits, [id]: amount },
  }));
}

export function musterMilitia(state: GameState, rules: Rules): Result {
  if (!facilityFlag(state, rules, 'barracks', 'militia')) return fail('The Barracks must be level 2 to muster militia');
  const cfg = rules.castle.actions.militia;
  return spend(state, cfg.cost, (c) => ({ ...c, projects: [...c.projects, { kind: 'militia', turnsLeft: cfg.turns }] }));
}

export function forgeArms(state: GameState, id: string, rules: Rules): Result {
  const g = resourceById(state, id);
  if (!g || g.kind !== 'group') return fail('Only groups are armed at the forge');
  const inForge = state.castle.projects.filter((p) => p.kind === 'forge');
  if (g.forged || inForge.some((p) => p.groupId === id)) return fail(`${g.name} has already been armed by the forge`);
  if (inForge.length >= facilityValue(state, rules, 'forge', 'forgeSlots')) return fail('No free forging slot');
  const turns = facilityValue(state, rules, 'forge', 'forgeTurns');
  return spend(state, rules.castle.actions.forgeArms.cost, (c) => ({
    ...c,
    projects: [...c.projects, { kind: 'forge', groupId: id, turnsLeft: turns }],
  }));
}

export function serveWine(state: GameState, id: string, rules: Rules): Result {
  const r = resourceById(state, id);
  if (!r) return fail(`No resource ${id}`);
  if (!isAtCastle(state, id)) return fail(`${r.name} is not at the castle`);
  if (state.castle.casksServed >= facilityValue(state, rules, 'winery', 'casksPerTurn')) return fail('No casks left this turn');
  if (r.morale >= rules.resolution.morale.max) return fail(`${r.name}'s spirits are already high`);
  const cfg = rules.castle.actions.wine;
  const spent = spend(state, cfg.cost, (c) => ({ ...c, casksServed: c.casksServed + 1 }));
  if (!spent.ok) return spent;
  return ok(updateResource(spent.state, id, (x) => ({ ...x, morale: clampMorale(x.morale + cfg.moraleBonus, rules.resolution) })));
}

export function upgradeFacility(state: GameState, facilityId: string, rules: Rules): Result {
  const level = facilityLevel(state, facilityId);
  if (!rules.castle.facilities.some((f) => f.id === facilityId)) return fail(`No facility ${facilityId}`);
  if (level >= 3) return fail('Already at the highest level');
  if (state.castle.projects.some((p) => p.kind === 'upgrade' && p.facilityId === facilityId)) return fail('Already being upgraded');
  const cost = rules.castle.upgrade.costs[String(level + 1)];
  return spend(state, cost, (c) => ({
    ...c,
    projects: [...c.projects, { kind: 'upgrade', facilityId, toLevel: level + 1, turnsLeft: rules.castle.upgrade.turnsToBuild }],
  }));
}

/** DM correction of the treasury, e.g. loot or tribute from the recaps. */
export function adjustTreasury(state: GameState, delta: number): Result {
  return ok({ ...state, castle: { ...state.castle, treasury: Math.max(0, state.castle.treasury + delta) } });
}

// ---------------------------------------------------------------- end-of-turn castle phase

export interface CastlePhaseInput {
  /** Every resource that fought this turn: they neither rest nor recover morale. */
  deployed: Set<string>;
}

function rest(hero: HeroState, rules: Rules): HeroState {
  const { minorTurns, seriousTurns, grievousHealsByRest } = rules.castle.rest;
  const injuries: Injury[] = [];
  for (const i of hero.injuries) {
    const t = i.turnsTreated + 1;
    const healed =
      (i.severity === 'minor' && t >= minorTurns) || (i.severity === 'serious' && t >= seriousTurns) || (i.severity === 'grievous' && grievousHealsByRest);
    if (!healed) injuries.push({ ...i, turnsTreated: t });
  }
  return { ...hero, injuries };
}

/** Removes the treated injury (serious) or downgrades it (grievous → serious). */
function finishTreatment(hero: HeroState, severity: 'serious' | 'grievous'): HeroState {
  const idx = hero.injuries.findIndex((i) => i.severity === severity);
  if (idx < 0) return hero;
  const injuries = [...hero.injuries];
  if (severity === 'grievous') injuries[idx] = { severity: 'serious', turnsTreated: 0 };
  else injuries.splice(idx, 1);
  return { ...hero, injuries };
}

/** docs/castle-model.md §6. Returns the new state and the ids of things completed this turn. */
export function runCastlePhase(state: GameState, input: CastlePhaseInput, rules: Rules): { state: GameState; completed: string[] } {
  const c = state.castle;
  const completed: string[] = [];
  const home = (r: ResourceState) => isAtCastle(state, r.id) && !input.deployed.has(r.id);

  // 1. Income.
  const treasury = c.treasury + c.incomePerTurn;

  // 2. Morale recovery for those who stayed home and did not train.
  const recovery =
    facilityValue(state, rules, 'great-hall', 'moraleRecovery') +
    (c.entertainersTurnsLeft > 0 ? rules.castle.actions.entertainers.moraleBonus : 0);

  const trainingBonus = facilityValue(state, rules, 'training-grounds', 'powerBonus');
  const injuredRecovery = facilityValue(state, rules, 'healers-hall', 'injuredRecovery');

  let resources = state.resources.map((r): ResourceState => {
    let next: ResourceState = { ...r };

    // Training buffs tick down, then this turn's trainees gain theirs.
    if (next.trainingTurnsLeft > 0) next.trainingTurnsLeft -= 1;
    if (c.training.includes(r.id)) {
      next.trainingBonus = trainingBonus;
      next.trainingTurnsLeft = rules.castle.actions.train.durationTurns;
    }

    if (!home(r)) return next;

    if (!c.training.includes(r.id)) next.morale = clampMorale(next.morale + recovery, rules.resolution);

    // 3. Heroes rest. 4. Groups' injured return to the ranks.
    if (next.kind !== 'group') next = rest(next, rules);
    else if (next.injured > 0) {
      const back = Math.min(next.injured, Math.max(1, Math.round(next.injured * injuredRecovery)));
      next = { ...next, injured: next.injured - back };
    }

    // 5. Recruits arrive.
    const recruits = c.recruits[r.id];
    if (recruits && next.kind === 'group') next = { ...next, number: Math.min(next.maxNumber, next.number + recruits) };
    return next;
  });

  // 3b. Healers' Hall treatments progress.
  const treatments = [];
  for (const t of c.treatments) {
    const turnsLeft = t.turnsLeft - 1;
    if (turnsLeft > 0) {
      treatments.push({ ...t, turnsLeft });
      continue;
    }
    resources = resources.map((r) => (r.id === t.resourceId && r.kind !== 'group' ? finishTreatment(r, t.severity) : r));
    completed.push(`heal:${t.resourceId}`);
  }

  // 6. Projects: militia, forge work, upgrades.
  const facilities = { ...c.facilities };
  const projects = [];
  let militiaSerial = c.nextMilitiaSerial;
  for (const p of c.projects) {
    const turnsLeft = p.turnsLeft - 1;
    if (turnsLeft > 0) {
      projects.push({ ...p, turnsLeft });
      continue;
    }
    if (p.kind === 'upgrade') {
      facilities[p.facilityId] = p.toLevel;
      completed.push(`upgrade:${p.facilityId}:${p.toLevel}`);
    } else if (p.kind === 'forge') {
      const bonus = rules.castle.actions.forgeArms.powerBonus;
      resources = resources.map((r) => (r.id === p.groupId ? { ...r, power: Math.min(10, r.power + bonus), forged: true } : r));
      completed.push(`forge:${p.groupId}`);
    } else {
      const t = rules.castle.actions.militia.template;
      const n = militiaSerial++;
      const id = `militia-${n}`;
      const power = facilityValue(state, rules, 'training-grounds', 'militiaPower') || t.power;
      resources = [
        ...resources,
        {
          id,
          kind: 'group',
          name: n > 1 ? `${t.name} ${n}` : t.name,
          faction: t.faction,
          power,
          morale: t.morale,
          tags: [...t.tags],
          canCleanse: false,
          locked: false,
          traits: [],
          notes: 'Mustered at the castle.',
          attachedTo: null,
          trainingBonus: 0,
          trainingTurnsLeft: 0,
          number: t.number,
          maxNumber: t.maxNumber,
          injured: 0,
          replenishable: t.replenishable,
          decimationResistance: t.decimationResistance,
          forged: false,
        },
      ];
      completed.push(`militia:${id}`);
    }
  }

  return {
    state: {
      ...state,
      resources,
      castle: {
        ...c,
        treasury,
        facilities,
        entertainersTurnsLeft: Math.max(0, c.entertainersTurnsLeft - 1),
        casksServed: 0,
        training: [],
        treatments,
        recruits: {},
        projects,
        nextMilitiaSerial: militiaSerial,
      },
    },
    completed,
  };
}
