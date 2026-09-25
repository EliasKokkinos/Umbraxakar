const numberFormat = new Intl.NumberFormat('en-GB');

export function fmt(n: number): string {
  return numberFormat.format(n);
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export { harmText } from '../engine/views';
