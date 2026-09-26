import { effectivePower, moraleModifier, strengthPenalty } from './power';
import { CFG, group, hero } from './testing';

describe('moraleModifier', () => {
  it.each([
    [1, 0],
    [2, -1],
    [3, 0],
    [4, 0],
    [5, 1],
  ])('morale %i gives %i', (morale, mod) => {
    expect(moraleModifier(morale, CFG)).toBe(mod);
  });
});

describe('strengthPenalty', () => {
  it.each([
    [1.0, 0],
    [0.75, 0],
    [0.74, -1],
    [0.5, -1],
    [0.49, -2],
    [0.24, -3],
  ])('active ratio %f gives %i', (ratio, mod) => {
    expect(strengthPenalty(ratio, CFG)).toBe(mod);
  });
});

describe('effectivePower', () => {
  it('is the base power for a healthy hero at morale 4', () => {
    expect(effectivePower(hero('karsa-orlong'), { cfg: CFG }).total).toBe(8);
  });

  it('sums injury penalties, capped at -4', () => {
    const karsa = hero('karsa-orlong', {
      injuries: [
        { severity: 'serious', turnsTreated: 0 },
        { severity: 'grievous', turnsTreated: 0 },
      ],
    });
    expect(effectivePower(karsa, { cfg: CFG }).total).toBe(4);
  });

  it('applies the group strength penalty from injured and dead', () => {
    const legion = group('malazan-legion-1', { number: 200, injured: 60 }); // 140/300 active
    expect(effectivePower(legion, { cfg: CFG }).total).toBe(2);
  });

  it('adds a third of each attached hero\'s power, rounded up, capped at +5', () => {
    const legion = group('malazan-legion-1');
    expect(effectivePower(legion, { cfg: CFG, attached: [hero('karsa-orlong')] }).total).toBe(4 + 3);
    expect(effectivePower(legion, { cfg: CFG, attached: [hero('trull-sengar')] }).total).toBe(4 + 2);
    // A wounded hero lends less: Karsa at 8 - 2 = 6 adds only +2.
    const hurt = hero('karsa-orlong', { injuries: [{ severity: 'serious', turnsTreated: 0 }] });
    expect(effectivePower(legion, { cfg: CFG, attached: [hurt] }).total).toBe(4 + 2);
    const three = [hero('karsa-orlong'), hero('silchas-ruin'), hero('uruk')];
    expect(effectivePower(legion, { cfg: CFG, attached: three }).total).toBe(4 + 5);
  });

  it('grants the Mother Dark bonus only to tiste-andii inside an aura', () => {
    const ctx = { cfg: CFG, inTempleAura: true, templeBonus: 3, templeBonusTag: 'tiste-andii' };
    expect(effectivePower(hero('korlat'), ctx).total).toBe(10);
    expect(effectivePower(hero('karsa-orlong'), ctx).total).toBe(8);
    expect(effectivePower(hero('korlat'), { ...ctx, inTempleAura: false }).total).toBe(7);
  });

  it('adds an active training bonus', () => {
    expect(effectivePower(hero('trull-sengar', { trainingBonus: 2, trainingTurnsLeft: 1 }), { cfg: CFG }).total).toBe(7);
    expect(effectivePower(hero('trull-sengar', { trainingBonus: 2, trainingTurnsLeft: 0 }), { cfg: CFG }).total).toBe(5);
  });

  it('never drops below 1 and itemises the parts', () => {
    const trull = hero('trull-sengar', {
      morale: 2,
      injuries: [
        { severity: 'grievous', turnsTreated: 0 },
        { severity: 'serious', turnsTreated: 0 },
      ],
    });
    const p = effectivePower(trull, { cfg: CFG });
    expect(p.total).toBe(1);
    expect(p.parts).toEqual([
      { label: 'Base', value: 5 },
      { label: 'Morale', value: -1 },
      { label: 'Injuries', value: -4 },
    ]);
  });
});
