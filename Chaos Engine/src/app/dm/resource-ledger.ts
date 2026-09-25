import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { GameStore } from '../data/game-store';
import { ResourceView, resourceView } from '../engine/views';
import { MoraleMarks } from '../shared/morale-marks';

interface Section {
  title: string;
  rows: ResourceView[];
}

/** Every resource, as a ledger: who is home, who is in the field, who cannot be called. */
@Component({
  selector: 'ce-resource-ledger',
  imports: [MoraleMarks],
  templateUrl: './resource-ledger.html',
  styleUrl: './resource-ledger.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourceLedger {
  private readonly store = inject(GameStore);
  readonly selectedId = input<string | null>(null);
  readonly select = output<string>();

  protected readonly filter = signal('');

  private readonly views = computed(() => {
    const s = this.store.state()!;
    return s.resources.map((r) => resourceView(s, r, this.store.rules));
  });

  /** Attached heroes are listed under their card, not on their own. */
  protected readonly attachedNames = computed(() => {
    const byHost = new Map<string, ResourceView[]>();
    for (const v of this.views()) {
      if (v.attachedTo) byHost.set(v.attachedTo, [...(byHost.get(v.attachedTo) ?? []), v]);
    }
    return byHost;
  });

  protected readonly sections = computed<Section[]>(() => {
    const q = this.filter().trim().toLowerCase();
    const rows = this.views().filter(
      (v) => !v.attachedTo && (!q || v.name.toLowerCase().includes(q) || v.faction.toLowerCase().includes(q)),
    );
    const unavailable = (v: ResourceView) => v.locked || v.status === 'Fallen?';
    return [
      { title: 'In the field', rows: rows.filter((v) => !unavailable(v) && v.location.kind === 'event') },
      { title: 'At the castle', rows: rows.filter((v) => !unavailable(v) && v.location.kind === 'castle') },
      { title: 'Unavailable', rows: rows.filter(unavailable) },
    ].filter((s) => s.rows.length);
  });

  protected strength(v: ResourceView): string {
    return v.kind === 'group' ? `${v.number! - v.injured!}/${v.maxNumber}` : v.kind === 'avatar' ? 'Avatar' : 'Hero';
  }
}
