import { Rng } from './rng';

/**
 * Evaluates config dice expressions such as "1d3" or "deployableGroups + 1d6".
 * Terms: NdM dice, integers, or variable names; joined by + or -.
 */
export function rollExpression(expr: string, rng: Rng, vars: Record<string, number> = {}): number {
  const tokens = expr.replace(/\s+/g, '').match(/[+-]?[^+-]+/g);
  if (!tokens) throw new Error(`Empty dice expression: "${expr}"`);

  let total = 0;
  for (const token of tokens) {
    const sign = token.startsWith('-') ? -1 : 1;
    const term = token.replace(/^[+-]/, '');
    const dice = /^(\d*)d(\d+)$/i.exec(term);
    let value: number;
    if (dice) {
      const count = dice[1] ? Number(dice[1]) : 1;
      value = 0;
      for (let i = 0; i < count; i++) value += rng.d(Number(dice[2]));
    } else if (/^\d+$/.test(term)) {
      value = Number(term);
    } else if (term in vars) {
      value = vars[term];
    } else {
      throw new Error(`Unknown term "${term}" in dice expression "${expr}"`);
    }
    total += sign * value;
  }
  return total;
}
