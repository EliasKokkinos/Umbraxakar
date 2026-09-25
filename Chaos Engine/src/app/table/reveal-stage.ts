import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TableBattle } from '../engine/table-view';
import { TableSound } from './table-sound';

/** How the tumble slows: the gaps between faces, in ms. About 1.4 s in all. */
export const TUMBLE_STEPS = [45, 45, 50, 55, 60, 70, 80, 95, 110, 130, 155, 185, 220];
/** How long the landed result holds the stage before it settles into the list. */
export const HOLD_MS = 3200;

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The one orchestrated moment of the evening: a battle revealed on the TV.
 * The d20 tumbles, slowing, and lands on the roll; then the outcome is struck.
 */
@Component({
  selector: 'ce-reveal-stage',
  templateUrl: './reveal-stage.html',
  styleUrl: './reveal-stage.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RevealStage {
  private readonly sound = inject(TableSound);
  readonly battle = input.required<TableBattle>();
  readonly done = output<void>();

  protected readonly face = signal(20);
  protected readonly landed = signal(false);
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    effect(() => {
      const b = this.battle();
      untracked(() => this.play(b));
    });
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  private play(b: TableBattle): void {
    this.clear();
    this.landed.set(false);

    if (prefersReducedMotion()) {
      this.land(b);
      return;
    }

    let at = 0;
    let last = 0;
    for (const gap of TUMBLE_STEPS) {
      at += gap;
      this.later(at, () => {
        // Never show the same face twice running: a die that "sticks" reads as a glitch.
        let f = last;
        while (f === last) f = 1 + Math.floor(Math.random() * 20);
        last = f;
        this.face.set(f);
        this.sound.tick();
      });
    }
    this.later(at + 260, () => this.land(b));
  }

  private land(b: TableBattle): void {
    this.face.set(b.d20);
    this.landed.set(true);
    if (b.outcome === 'won') this.sound.victory();
    else this.sound.defeat();
    this.later(HOLD_MS, () => this.done.emit());
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private clear(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  protected verdict(b: TableBattle): string {
    if (b.heroicVictory) return 'A heroic victory';
    if (b.rout) return 'A rout';
    return b.outcome === 'won' ? 'Victory' : 'Defeat';
  }
}
