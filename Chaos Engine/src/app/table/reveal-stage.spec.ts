import { TestBed } from '@angular/core/testing';
import { TableBattle } from '../engine/table-view';
import { HOLD_MS, RevealStage, TUMBLE_STEPS } from './reveal-stage';
import { TableSound } from './table-sound';

const battle = (over: Partial<TableBattle> = {}): TableBattle => ({
  eventId: 'p1',
  eventName: 'The Weeping Rift of Lether',
  d20: 14,
  target: 9,
  eventPower: 8,
  outcome: 'won',
  rout: false,
  heroicVictory: false,
  cards: ['Karsa Orlong'],
  ...over,
});

const TUMBLE_MS = TUMBLE_STEPS.reduce((a, b) => a + b, 0) + 260;

describe('RevealStage', () => {
  let sound: { tick: ReturnType<typeof vi.fn>; victory: ReturnType<typeof vi.fn>; defeat: ReturnType<typeof vi.fn> };

  const mount = (b: TableBattle) => {
    const fixture = TestBed.createComponent(RevealStage);
    fixture.componentRef.setInput('battle', b);
    fixture.detectChanges();
    return fixture;
  };
  const text = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  beforeEach(() => {
    vi.useFakeTimers();
    sound = { tick: vi.fn(), victory: vi.fn(), defeat: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: TableSound, useValue: sound }] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('tumbles, then lands on the real roll and strikes the verdict', () => {
    const f = mount(battle());
    expect(text(f)).toContain('Needs 9 or more');
    expect(text(f)).not.toContain('Victory');

    vi.advanceTimersByTime(TUMBLE_MS - 300);
    f.detectChanges();
    expect(sound.tick).toHaveBeenCalled();
    expect(text(f)).not.toContain('Victory');

    vi.advanceTimersByTime(300);
    f.detectChanges();
    expect(f.nativeElement.querySelector('.face').textContent.trim()).toBe('14');
    expect(text(f)).toContain('Victory');
    expect(sound.victory).toHaveBeenCalledTimes(1);
  });

  it('never shows the same face twice running while tumbling', () => {
    const f = mount(battle());
    const faces: string[] = [];
    for (const gap of TUMBLE_STEPS) {
      vi.advanceTimersByTime(gap);
      f.detectChanges();
      faces.push(f.nativeElement.querySelector('.face').textContent.trim());
    }
    faces.slice(1).forEach((face, i) => expect(face).not.toBe(faces[i]));
  });

  it('names a rout and a heroic victory, and sounds defeat on a loss', () => {
    const rout = mount(battle({ d20: 1, outcome: 'lost', rout: true }));
    vi.advanceTimersByTime(TUMBLE_MS);
    rout.detectChanges();
    expect(text(rout)).toContain('A rout');
    expect(sound.defeat).toHaveBeenCalled();
  });

  it('leaves the stage after holding the result', () => {
    const f = mount(battle());
    const done = vi.fn();
    f.componentInstance.done.subscribe(done);
    vi.advanceTimersByTime(TUMBLE_MS + HOLD_MS - 1);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('with reduced motion, shows the result at once', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const f = mount(battle({ d20: 20, heroicVictory: true }));
    expect(f.nativeElement.querySelector('.face').textContent.trim()).toBe('20');
    expect(text(f)).toContain('A heroic victory');
    expect(sound.tick).not.toHaveBeenCalled();
  });
});
