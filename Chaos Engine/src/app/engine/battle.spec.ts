import { BattleInput, eventPower, groupLosses, harmChance, judgeRoll, resolveBattle, targetNumber } from './battle';
import { Rng } from './rng';
import { CFG, ScriptedRng, face, group, hero } from './testing';

const noFlags = { legendary: false, rout: false, heroicVictory: false };
const input = (partial: Partial<BattleInput>): BattleInput => ({
  difficulty: 5,
  legendary: false,
  cards: [],
  inTempleAura: false,
  templeBonus: 3,
  templeBonusTag: 'tiste-andii',
  ...partial,
});

describe('targetNumber: the chance table in docs/resolution-model.md', () => {
  it.each([
    [-10, 20],
    [-9, 19],
    [-4, 14],
    [-2, 12],
    [0, 10],
    [2, 8],
    [4, 6],
    [6, 4],
    [8, 2],
    [12, 2],
  ])('Power - Difficulty %i gives target %i', (gap, target) => {
    expect(targetNumber(5, 5 + gap, CFG)).toBe(target);
  });
});

describe('eventPower', () => {
  it('is best + 1 per extra card, capped at +3', () => {
    expect(eventPower([8, 4, 5], CFG)).toEqual({ total: 10, support: 2 });
    expect(eventPower([3, 3, 3, 3, 3, 3], CFG)).toEqual({ total: 6, support: 3 });
    expect(eventPower([], CFG)).toEqual({ total: 0, support: 0 });
  });
});

describe('judgeRoll', () => {
  it('natural 1 always fails and natural 20 always wins', () => {
    expect(judgeRoll(1, 2)).toEqual({ outcome: 'lost', rout: true, heroicVictory: false });
    expect(judgeRoll(20, 20)).toEqual({ outcome: 'won', rout: false, heroicVictory: true });
    expect(judgeRoll(7, 7).outcome).toBe('won');
    expect(judgeRoll(6, 7).outcome).toBe('lost');
  });
});

describe('harmChance: the harm table in docs/resolution-model.md', () => {
  it('Legion vs D5 (T -1): won 0%, lost 30%', () => {
    expect(harmChance(-1, 'won', noFlags, CFG)).toBe(0);
    expect(harmChance(-1, 'lost', noFlags, CFG)).toBe(0.3);
  });
  it('Legion vs D7 (T +1): won 20%, lost 50%', () => {
    expect(harmChance(1, 'won', noFlags, CFG)).toBe(0.2);
    expect(harmChance(1, 'lost', noFlags, CFG)).toBe(0.5);
  });
  it('Avowed vs D9 (T -3): won 0%, lost 10%', () => {
    expect(harmChance(-3, 'won', noFlags, CFG)).toBe(0);
    expect(harmChance(-3, 'lost', noFlags, CFG)).toBe(0.1);
  });
  it('Karsa vs D10 legendary (T -3): won 20%, lost 30%', () => {
    const legendary = { ...noFlags, legendary: true };
    expect(harmChance(-3, 'won', legendary, CFG)).toBe(0.2);
    expect(harmChance(-3, 'lost', legendary, CFG)).toBe(0.3);
  });
  it('clamps, adds the rout bonus, and a heroic victory means no harm', () => {
    expect(harmChance(20, 'won', noFlags, CFG)).toBe(0.6);
    expect(harmChance(-20, 'lost', noFlags, CFG)).toBe(0.05);
    expect(harmChance(0, 'lost', { ...noFlags, rout: true }, CFG)).toBe(0.6);
    expect(harmChance(20, 'won', { ...noFlags, heroicVictory: true }, CFG)).toBe(0);
  });
});

describe('groupLosses', () => {
  it('takes percentages of active strength, minimum 1 each', () => {
    const light = CFG.harm.groupSeverity[0];
    const severe = CFG.harm.groupSeverity[2];
    expect(groupLosses(group('malazan-legion-1'), light, CFG)).toEqual({ killed: 15, injured: 30 });
    expect(groupLosses(group('bridgeburners', { number: 5, injured: 0 }), light, CFG)).toEqual({ killed: 1, injured: 1 });
    expect(groupLosses(group('malazan-legion-1', { number: 100, injured: 50 }), severe, CFG)).toEqual({ killed: 10, injured: 10 });
    expect(groupLosses(group('bridgeburners', { number: 3, injured: 3 }), severe, CFG)).toEqual({ killed: 0, injured: 0 });
  });
});

describe('resolveBattle', () => {
  const karsaCards = () => [
    { host: hero('karsa-orlong'), attached: [] },
    { host: group('malazan-legion-1'), attached: [] },
    { host: group('bridgeburners'), attached: [] },
  ];

  it('worked example: Karsa + Legion + Bridgeburners vs D7 is Power 10, target 7', () => {
    const rng = new ScriptedRng([face(7, 20), 0.99, 0.99, 0.99]);
    const r = resolveBattle(input({ difficulty: 7, cards: karsaCards() }), rng, CFG);
    expect(r.eventPower).toBe(10);
    expect(r.supportBonus).toBe(2);
    expect(r.target).toBe(7);
    expect(r.d20).toBe(7);
    expect(r.outcome).toBe('won');
    expect(r.harm.every((h) => !h.harmed)).toBe(true);
  });

  it('uses each member’s own power for threat: the legion bleeds beside Karsa', () => {
    const rng = new ScriptedRng([face(7, 20), 0.99, 0.99, 0.99]);
    const r = resolveBattle(input({ difficulty: 7, cards: karsaCards() }), rng, CFG);
    const byId = Object.fromEntries(r.harm.map((h) => [h.resourceId, h]));
    expect(byId['karsa-orlong'].threat).toBe(7 - 8 - 5);
    expect(byId['malazan-legion-1'].threat).toBe(7 - 4 - 2);
    expect(byId['malazan-legion-1'].chance).toBe(0.2);
  });

  it('rolls harm and severity (+threat) on a loss', () => {
    // d20 = 2 (lost); legion harm check passes (0.0 < 0.5); severity d6 = 5 + T1 = 6 → severe.
    const rng = new ScriptedRng([face(2, 20), 0.0, face(5, 6)]);
    const r = resolveBattle(input({ difficulty: 7, cards: [{ host: group('malazan-legion-1'), attached: [] }] }), rng, CFG);
    expect(r.outcome).toBe('lost');
    const h = r.harm[0];
    expect(h.kind === 'group' && [h.band, h.severityRoll, h.killed, h.injured]).toEqual(['severe', 6, 60, 60]);
  });

  it('flags a second grievous injury as Fallen? instead of killing', () => {
    const wounded = hero('trull-sengar', { injuries: [{ severity: 'grievous', turnsTreated: 0 }] });
    // Deploy checks are not the battle's concern; force the scenario.
    const rng = new ScriptedRng([face(2, 20), 0.0, face(6, 6)]);
    const r = resolveBattle(input({ difficulty: 9, cards: [{ host: wounded, attached: [] }] }), rng, CFG);
    const h = r.harm[0];
    expect(h.kind === 'hero' && [h.severity, h.fallen]).toEqual(['grievous', true]);
  });

  it('attached heroes add power and roll their own harm', () => {
    const card = { host: group('avowed-prince'), attached: [hero('blues'), hero('cowl')] };
    const r = resolveBattle(input({ difficulty: 9, cards: [card] }), new Rng(3), CFG);
    expect(r.eventPower).toBe(9);
    expect(r.harm.map((h) => h.resourceId)).toEqual(['avowed-prince', 'blues', 'cowl']);
  });

  it('is deterministic for the same RNG state', () => {
    const a = resolveBattle(input({ difficulty: 7, cards: karsaCards() }), new Rng(99), CFG);
    const b = resolveBattle(input({ difficulty: 7, cards: karsaCards() }), new Rng(99), CFG);
    expect(a).toEqual(b);
  });
});
