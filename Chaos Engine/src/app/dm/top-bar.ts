import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { GameStore } from '../data/game-store';
import { SeedService } from '../data/seed.service';
import { SessionService } from '../data/session.service';
import { TableHost } from '../data/table-sync';
import { hasCommanderThisTurn } from '../engine/commanders';
import { seedMorePortals } from '../engine/dm-edits';
import { dayOfTurn } from '../engine/views';
import { fmt } from '../shared/format';

@Component({
  selector: 'ce-top-bar',
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopBar {
  protected readonly store = inject(GameStore);
  private readonly session = inject(SessionService);
  private readonly seeds = inject(SeedService);
  protected readonly table = inject(TableHost);

  readonly placing = input(false);
  readonly placePortal = output<boolean>();
  readonly resolve = output<void>();

  protected readonly fmt = fmt;
  protected readonly state = this.store.state;
  protected readonly commander = computed(() => {
    const s = this.state()!;
    return hasCommanderThisTurn(s) ? (this.seeds.seed()?.commanders.find((c) => c.id === s.commanderId) ?? null) : null;
  });
  protected readonly day = computed(() => dayOfTurn(this.state()!.events.turn, this.store.rules.events.turn.daysPerTurn));
  protected readonly openPortals = computed(() => this.state()!.events.portals.filter((p) => p.status === 'open').length);
  protected readonly confirmingNew = signal(false);
  protected readonly seedCount = signal(3);

  protected seedPortals(): void {
    const n = Math.max(1, Math.min(20, this.seedCount()));
    this.store.act(`Seed ${n} more portal${n === 1 ? '' : 's'}`, (s, r) => seedMorePortals(s, n, r));
  }

  protected newSession(): void {
    this.session.newSession();
    this.confirmingNew.set(false);
  }

  protected save(): void {
    const turn = this.state()!.events.turn;
    const json = this.store.exportSave(`Turn ${turn}`);
    if (!json) return;
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `chaos-engine-turn-${turn}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected async load(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.session.loadSave(await file.text());
    input.value = '';
  }
}
