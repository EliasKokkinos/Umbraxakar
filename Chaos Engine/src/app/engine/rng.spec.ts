import { Rng } from './rng';

describe('Rng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(Array.from({ length: 20 }, () => b.next()));
  });

  it('resumes from a saved state', () => {
    const a = new Rng(7);
    a.next();
    a.next();
    const resumed = new Rng(a.state);
    expect(resumed.next()).toBe(a.next());
  });

  it('rolls dice within range and covers every face', () => {
    const rng = new Rng(1);
    const faces = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.d(20);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(20);
      faces.add(v);
    }
    expect(faces.size).toBe(20);
  });
});
