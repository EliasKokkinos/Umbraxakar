import { createHistory, push, redo, undo } from './history';

describe('history', () => {
  it('undoes and redoes labelled steps', () => {
    let h = createHistory(0, 'Start');
    h = push(h, 1, 'one');
    h = push(h, 2, 'two');
    h = undo(h);
    expect(h.present).toEqual({ state: 1, label: 'one' });
    h = redo(h);
    expect(h.present).toEqual({ state: 2, label: 'two' });
  });

  it('keeps only the last 10 steps', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 15; i++) h = push(h, i, `step ${i}`);
    expect(h.past).toHaveLength(10);
    for (let i = 0; i < 20; i++) h = undo(h);
    expect(h.present.state).toBe(5);
  });

  it('a new action after undo discards the redo branch', () => {
    let h = push(push(createHistory(0), 1, 'a'), 2, 'b');
    h = push(undo(h), 9, 'c');
    expect(h.future).toEqual([]);
    expect(redo(h)).toBe(h);
  });

  it('undo with nothing to undo is a no-op', () => {
    const h = createHistory('x');
    expect(undo(h)).toBe(h);
  });
});
