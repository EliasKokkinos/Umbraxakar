import { rollExpression } from './dice';
import { Rng } from './rng';
import { ScriptedRng, face } from './testing';

describe('rollExpression', () => {
  it('rolls NdM dice', () => {
    expect(rollExpression('1d3', new ScriptedRng([face(2, 3)]))).toBe(2);
    expect(rollExpression('2d6', new ScriptedRng([face(6, 6), face(4, 6)]))).toBe(10);
    expect(rollExpression('d20', new ScriptedRng([face(17, 20)]))).toBe(17);
  });

  it('adds variables, constants and subtraction', () => {
    const rng = new ScriptedRng([face(5, 6)]);
    expect(rollExpression('deployableResources + 1d6', rng, { deployableResources: 24 })).toBe(29);
    expect(rollExpression('10 - 2 + x', new Rng(1), { x: 3 })).toBe(11);
  });

  it('rejects unknown terms', () => {
    expect(() => rollExpression('1d6 + mystery', new Rng(1))).toThrow(/mystery/);
  });
});
