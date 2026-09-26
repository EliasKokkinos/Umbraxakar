import { assign, attach } from './assignment';
import { heal, hireEntertainers, recruit, serveWine } from './castle';
import { GameState, Result, deployableHosts, eventOf, newGame, resourceById } from './game-state';
import { HeroState } from './resource-state';
import { commitTurn, endTurn, rerollBattle, resolveAll } from './turn';
import { RULES, SEED } from './testing';

const tryApply = (s: GameState, r: Result): GameState => (r.ok ? r.state : s);
const openPortals = (s: GameState) => s.events.portals.filter((p) => p.status === 'open');

describe('resolveAll / commitTurn', () => {
  const setup = () => {
    let s = newGame(SEED, RULES, 2024);
    const [a, b] = openPortals(s);
    s = tryApply(s, attach(s, 'karsa-orlong', 'malazan-legion-1'));
    s = tryApply(s, assign(s, 'malazan-legion-1', a.id, RULES));
    s = tryApply(s, assign(s, 'letheri-army-1', b.id, RULES));
    return { s, a: a.id, b: b.id };
  };

  it('rolls only contested events, without changing the state', () => {
    const { s, a, b } = setup();
    const pending = resolveAll(s, RULES);
    expect(Object.keys(pending.battles).sort()).toEqual([a, b].sort());
    expect(pending.battles[a].cardPowers.map((c) => c.resourceId)).toEqual(['malazan-legion-1']);
    // Karsa rides with the Legion: his own harm is rolled too.
    expect(pending.battles[a].harm.map((h) => h.resourceId)).toEqual(['malazan-legion-1', 'karsa-orlong']);
    expect(pending.rngState).not.toBe(s.rngState);
  });

  it('a reroll draws fresh dice for that event only', () => {
    const { s, a, b } = setup();
    const pending = resolveAll(s, RULES);
    const rerolled = rerollBattle(s, pending, b, RULES);
    expect(rerolled.battles[a]).toBe(pending.battles[a]);
    expect(rerolled.rngState).not.toBe(pending.rngState);
  });

  it('commits outcomes: winners come home without castle recovery, the turn advances, the log records it', () => {
    const { s, a } = setup();
    const pending = resolveAll(s, RULES);
    // Force a victory at A to make the assertions exact.
    const forced = { ...pending, battles: { ...pending.battles, [a]: { ...pending.battles[a], outcome: 'won' as const, heroicVictory: false, harm: [] } } };
    const next = commitTurn(s, forced, RULES);

    expect(next.events.turn).toBe(2);
    const portalA = next.events.portals.find((p) => p.id === a)!;
    expect(portalA.status).toBe('closed');
    expect(eventOf(next, 'karsa-orlong')).toBeUndefined();
    // Served (-1) and did not rest this turn.
    expect(resourceById(next, 'karsa-orlong')!.morale).toBe(3);
    // Stayed home: +1.
    expect(resourceById(next, 'uruk')!.morale).toBe(4);

    expect(next.log).toHaveLength(1);
    expect(next.log[0].turn).toBe(1);
    expect(next.log[0].events.closed).toContain(a);
    expect(next.events.civilianDeaths).toBe(next.log[0].civilianDeaths);
    expect(next.events.civilianDeaths).toBeGreaterThan(0);
  });

  it('routs a card that falls to morale 1 on a lost event', () => {
    let s = newGame(SEED, RULES, 5);
    const target = openPortals(s)[0];
    s = { ...s, resources: s.resources.map((r) => (r.id === 'letheri-army-1' ? { ...r, morale: 3 } : r)) };
    s = tryApply(s, assign(s, 'letheri-army-1', target.id, RULES));
    const pending = resolveAll(s, RULES);
    const lost = { ...pending, battles: { [target.id]: { ...pending.battles[target.id], outcome: 'lost' as const, heroicVictory: false, harm: [] } } };
    const next = commitTurn(s, lost, RULES);
    expect(resourceById(next, 'letheri-army-1')!.morale).toBe(1);
    expect(next.log[0].routed).toEqual(['letheri-army-1']);
    expect(eventOf(next, 'letheri-army-1')).toBeUndefined();
  });
});

// ---------------------------------------------------------------- 5-turn simulation

/** A simple, deterministic "player": tends the castle, then sends each card to the worst portal. */
function playTurn(state: GameState): GameState {
  let s = state;
  if (s.events.turn === 1) s = tryApply(s, hireEntertainers(s, RULES));

  for (const r of s.resources) {
    if (r.kind !== 'group' && r.injuries.some((i) => i.severity !== 'minor')) s = tryApply(s, heal(s, r.id, RULES));
    if (r.kind === 'group' && r.replenishable && r.number < r.maxNumber) s = tryApply(s, recruit(s, r.id, r.maxNumber, RULES));
  }
  const lowest = [...s.resources].filter((r) => !r.locked).sort((a, b) => a.morale - b.morale)[0];
  s = tryApply(s, serveWine(s, lowest.id, RULES));

  // Heroes join the groups with the fewest heroes, then the groups go out.
  for (const h of s.resources.filter((r) => r.kind !== 'group' && !r.attachedTo && !r.locked)) {
    const host = s.resources
      .filter((g) => g.kind === 'group' && !g.locked)
      .sort((a, b) => s.resources.filter((x) => x.attachedTo === a.id).length - s.resources.filter((x) => x.attachedTo === b.id).length)[0];
    if (host) s = tryApply(s, attach(s, h.id, host.id));
  }
  const portals = openPortals(s).sort((a, b) => b.impact - a.impact);
  const hosts = deployableHosts(s, RULES)
    .filter((r) => !eventOf(s, r.id))
    .sort((a, b) => b.power - a.power);
  hosts.forEach((h, i) => {
    const p = portals[i % Math.max(1, portals.length)];
    if (p) s = tryApply(s, assign(s, h.id, p.id, RULES));
  });
  return endTurn(s, RULES);
}

function simulate(seed: number, turns: number): GameState[] {
  const states = [newGame(SEED, RULES, seed)];
  for (let t = 0; t < turns; t++) states.push(playTurn(states[states.length - 1]));
  return states;
}

describe('5-turn simulation', () => {
  const run = simulate(31337, 5);
  const final = run[run.length - 1];

  it('is fully deterministic', () => {
    expect(simulate(31337, 5)).toEqual(run);
  });

  it('advances five turns and logs each', () => {
    expect(final.events.turn).toBe(6);
    expect(final.log.map((l) => l.turn)).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps every invariant, every turn', () => {
    for (const s of run) {
      for (const r of s.resources) {
        expect(r.morale).toBeGreaterThanOrEqual(1);
        expect(r.morale).toBeLessThanOrEqual(5);
        if (r.kind === 'group') {
          expect(r.number).toBeGreaterThanOrEqual(0);
          expect(r.number).toBeLessThanOrEqual(r.maxNumber);
          expect(r.injured).toBeGreaterThanOrEqual(0);
          expect(r.injured).toBeLessThanOrEqual(r.number);
        }
      }
      expect(s.castle.treasury).toBeGreaterThanOrEqual(0);

      // No card is in two places; closed portals hold no one; locked resources never deploy.
      const assigned = [...s.events.portals, ...s.events.temples].flatMap((e) => e.assigned);
      expect(new Set(assigned).size).toBe(assigned.length);
      expect(s.events.portals.filter((p) => p.status === 'closed').every((p) => p.assigned.length === 0)).toBe(true);
      expect(assigned.every((id) => !resourceById(s, id)!.locked)).toBe(true);

      for (const p of s.events.portals) {
        expect(p.corruption).toBeGreaterThanOrEqual(1);
        expect(p.corruption).toBeLessThanOrEqual(5);
        expect(p.difficulty).toBeLessThanOrEqual(p.legendary ? 10 : 9);
      }
    }
  });

  it('civilian deaths only ever rise, and match the log', () => {
    const deaths = run.map((s) => s.events.civilianDeaths);
    deaths.slice(1).forEach((d, i) => expect(d).toBeGreaterThanOrEqual(deaths[i]));
    expect(final.log.reduce((acc, l) => acc + l.civilianDeaths, 0)).toBe(final.events.civilianDeaths);
  });

  it('the Avowed never regain their dead', () => {
    const avowed = run.map((s) => resourceById(s, 'avowed-prince')!).map((r) => (r.kind === 'group' ? r.number : 0));
    avowed.slice(1).forEach((n, i) => expect(n).toBeLessThanOrEqual(avowed[i]));
  });

  it('no hero is ever killed by the system', () => {
    const heroes = final.resources.filter((r): r is HeroState => r.kind !== 'group');
    expect(heroes.length).toBe(18);
  });
});
