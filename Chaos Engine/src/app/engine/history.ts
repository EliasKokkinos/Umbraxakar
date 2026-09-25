/** A labelled snapshot: the state after a named action. */
export interface Entry<T> {
  state: T;
  label: string;
}

/** Bounded undo/redo over immutable snapshots. */
export interface History<T> {
  past: Entry<T>[];
  present: Entry<T>;
  future: Entry<T>[];
  limit: number;
}

export const UNDO_LIMIT = 10;

export function createHistory<T>(state: T, label = 'Start', limit = UNDO_LIMIT): History<T> {
  return { past: [], present: { state, label }, future: [], limit };
}

/** Records a new present. Oldest entries fall off past the limit; redo is cleared. */
export function push<T>(h: History<T>, state: T, label: string): History<T> {
  const past = [...h.past, h.present].slice(-h.limit);
  return { ...h, past, present: { state, label }, future: [] };
}

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  return { ...h, past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  return { ...h, past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}
