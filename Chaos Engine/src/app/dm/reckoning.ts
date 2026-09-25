import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { GameStore } from '../data/game-store';
import { TableHost } from '../data/table-sync';
import { BattleResult } from '../engine/battle';
import { eventById, resourceById } from '../engine/game-state';
import { harmLines, lastTurnReport } from '../engine/views';
import { fmt } from '../shared/format';

/**
 * End of turn, for the DM: every battle rolled, open to reroll or override, then committed
 * as one undoable step, followed by the turn report.
 */
@Component({
  selector: 'ce-reckoning',
  templateUrl: './reckoning.html',
  styleUrl: './reckoning.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Reckoning implements OnInit {
  protected readonly store = inject(GameStore);
  protected readonly table = inject(TableHost);
  readonly done = output<void>();
  readonly selectEvent = output<string>();

  protected readonly fmt = fmt;
  protected readonly phase = signal<'review' | 'report'>('review');

  ngOnInit(): void {
    if (!this.store.pending()) this.store.resolve();
  }

  protected readonly battles = computed(() => {
    const p = this.store.pending();
    const s = this.store.state()!;
    if (!p) return [];
    return Object.entries(p.battles).map(([id, b]) => ({
      id,
      name: eventById(s, id)?.name ?? id,
      battle: b,
      cards: b.cardPowers.map((c) => `${this.name(c.resourceId)} ${c.power.total}`).join(', '),
      harm: this.harmLines(b),
    }));
  });

  protected readonly unopposed = computed(() =>
    this.store.state()!.events.portals.filter((p) => p.status === 'open' && !p.assigned.length),
  );

  protected readonly report = computed(() => lastTurnReport(this.store.state()!, this.store.rules));

  private name(id: string): string {
    return resourceById(this.store.state()!, id)?.name ?? id;
  }

  private harmLines(b: BattleResult): string[] {
    return harmLines(this.store.state()!, b);
  }

  protected force(id: string, outcome: 'won' | 'lost'): void {
    this.store.overrideBattle(id, { outcome });
  }

  protected spare(id: string, b: BattleResult, index: number): void {
    const harm = b.harm.filter((h) => h.harmed);
    const target = harm[index];
    this.store.overrideBattle(id, { harm: b.harm.map((h) => (h === target ? { ...h, harmed: false } : h)) });
  }

  protected isRevealed(id: string): boolean {
    return this.table.revealed().includes(id);
  }

  protected revealAll(): void {
    this.table.revealAll(this.battles().map((b) => b.id));
  }

  protected commit(): void {
    if (!this.store.commit()) return;
    this.table.endReckoning(true);
    this.phase.set('report');
  }

  protected cancel(): void {
    this.store.cancelResolution();
    this.table.endReckoning(false);
    this.done.emit();
  }

  protected finish(): void {
    this.table.endReckoning(false);
    this.done.emit();
  }
}
