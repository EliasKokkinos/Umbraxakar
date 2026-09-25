import { BattleResult } from './battle';
import { applyBattleResult, canDeploy, moraleAfterBattle } from './morale';
import { CFG, group, hero } from './testing';

describe('moraleAfterBattle', () => {
  it('-1 for serving, -2 on a loss, none on a heroic victory, never below 1', () => {
    expect(moraleAfterBattle(4, { outcome: 'won', heroicVictory: false }, CFG)).toBe(3);
    expect(moraleAfterBattle(4, { outcome: 'lost', heroicVictory: false }, CFG)).toBe(2);
    expect(moraleAfterBattle(4, { outcome: 'won', heroicVictory: true }, CFG)).toBe(4);
    expect(moraleAfterBattle(2, { outcome: 'lost', heroicVictory: false }, CFG)).toBe(1);
  });
});

describe('canDeploy', () => {
  it('allows a healthy resource', () => {
    expect(canDeploy(hero('karsa-orlong'), 9, 8, CFG)).toEqual({ ok: true });
  });

  it('refuses at morale 1', () => {
    expect(canDeploy(hero('karsa-orlong', { morale: 1 }), 3, 8, CFG)).toEqual({ ok: false, reason: 'Refuses' });
  });

  it('blocks locked, fallen, grievously injured, and broken groups', () => {
    expect(canDeploy(hero('anomander-rake'), 3, 10, CFG)).toEqual({ ok: false, reason: 'Not yet resurrected.' });
    expect(canDeploy(hero('korlat', { fallen: true }), 3, 7, CFG).ok).toBe(false);
    expect(canDeploy(hero('korlat', { injuries: [{ severity: 'grievous', turnsTreated: 0 }] }), 3, 4, CFG).ok).toBe(false);
    expect(canDeploy(hero('korlat', { injuries: [{ severity: 'serious', turnsTreated: 0 }] }), 3, 5, CFG).ok).toBe(true);
    expect(canDeploy(group('bridgeburners', { number: 10, injured: 10 }), 3, 1, CFG).ok).toBe(false);
  });

  it('Silchas refuses suicidal orders: Difficulty >= effective Power + 3', () => {
    // Healthy (Power 9) he never refuses, since Difficulty caps at 10.
    expect(canDeploy(hero('silchas-ruin'), 10, 9, CFG)).toEqual({ ok: true });
    // Worn down to effective Power 6, a Difficulty 9 portal is too much.
    expect(canDeploy(hero('silchas-ruin'), 9, 6, CFG)).toEqual({ ok: false, reason: 'No suicidal orders' });
    expect(canDeploy(hero('silchas-ruin'), 8, 6, CFG)).toEqual({ ok: true });
  });
});

describe('applyBattleResult', () => {
  const result = (partial: Partial<BattleResult>): BattleResult => ({
    cardPowers: [],
    eventPower: 0,
    supportBonus: 0,
    target: 10,
    d20: 5,
    outcome: 'lost',
    rout: false,
    heroicVictory: false,
    harm: [],
    ...partial,
  });

  it('applies morale, group losses and hero injuries without mutating inputs', () => {
    const legion = group('malazan-legion-1');
    const karsa = hero('karsa-orlong');
    const [l, k] = applyBattleResult(
      [legion, karsa],
      result({
        harm: [
          { kind: 'group', resourceId: legion.id, threat: 1, chance: 0.5, harmed: true, killed: 30, injured: 45 },
          { kind: 'hero', resourceId: karsa.id, threat: -3, chance: 0.1, harmed: true, severity: 'serious' },
        ],
      }),
      CFG,
    );
    expect(l.kind === 'group' && [l.number, l.injured, l.morale]).toEqual([270, 45, 2]);
    expect(k.kind === 'hero' && k.injuries).toEqual([{ severity: 'serious', turnsTreated: 0 }]);
    expect(legion.number).toBe(300);
    expect(karsa.injuries).toEqual([]);
  });

  it('marks a hero Fallen? rather than adding an injury', () => {
    const [k] = applyBattleResult(
      [hero('karsa-orlong')],
      result({ harm: [{ kind: 'hero', resourceId: 'karsa-orlong', threat: 0, chance: 1, harmed: true, severity: 'grievous', fallen: true }] }),
      CFG,
    );
    expect(k.kind !== 'group' && k.fallen).toBe(true);
  });
});
