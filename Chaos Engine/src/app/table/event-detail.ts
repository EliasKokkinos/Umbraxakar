import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { PortraitStore } from '../data/portrait-store';
import { PortalState, TempleState } from '../engine/event-state';
import { Odds } from '../engine/odds';
import { ResourceView } from '../engine/views';
import { NOTCH_PATHS, RESOURCE_DRAG_TYPE } from '../shared/map-board';
import { factionHue, monogram } from './resource-card';

/** A portal or temple on the TV: what it is, how bad it is, who is there, and the odds. */
@Component({
  selector: 'ce-event-detail',
  templateUrl: './event-detail.html',
  styleUrl: './event-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.temple]': "event().type === 'mother-dark-temple'",
    '[style.--heat]': 'heat()',
    '[class.dropping]': 'dropping()',
    '(dragover)': 'onDragOver($event)',
    '(dragleave)': 'onDragLeave($event)',
    '(drop)': 'onDrop($event)',
  },
})
export class EventDetail {
  private readonly portraits = inject(PortraitStore);

  readonly event = input.required<PortalState | TempleState>();
  readonly region = input('the wild lands');
  readonly cards = input<ResourceView[]>([]);
  readonly odds = input<Odds | null>(null);

  readonly recall = output<string>();
  readonly close = output<void>();
  /** A card dropped on the panel: send it here. */
  readonly dropped = output<string>();
  /** The event a held card is over (this one), or null when it leaves. */
  readonly hover = output<string | null>();

  protected readonly dropping = signal(false);

  protected readonly notches = NOTCH_PATHS;
  protected readonly threatSegments = Array.from({ length: 10 }, (_, i) => i + 1);

  protected readonly portal = computed(() => {
    const e = this.event();
    return e.type === 'chaos-portal' ? e : null;
  });
  protected readonly temple = computed(() => {
    const e = this.event();
    return e.type === 'mother-dark-temple' ? e : null;
  });

  /** The same ember as the portal's marker on the map. */
  protected readonly heat = computed(() => {
    const p = this.portal();
    return p ? `var(--ce-chaos-${Math.min(5, Math.max(1, p.corruption))})` : 'var(--ce-galain)';
  });

  protected readonly chance = computed(() => {
    const o = this.odds();
    if (!o) return null;
    const pct = Math.round(o.chance * 100);
    return { pct, target: o.target, tone: o.chance >= 0.65 ? 'good' : o.chance < 0.45 ? 'poor' : 'even' };
  });

  /** Can more cards be sent here? */
  protected readonly open = computed(() => !!this.portal() || !this.temple()!.active);

  protected onDragOver(ev: DragEvent): void {
    if (!this.open() || !ev.dataTransfer?.types.includes(RESOURCE_DRAG_TYPE)) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    if (!this.dropping()) {
      this.dropping.set(true);
      this.hover.emit(this.event().id);
    }
  }

  /** Leaving a child element is not leaving the panel. */
  protected onDragLeave(ev: DragEvent): void {
    const to = ev.relatedTarget as Node | null;
    if (to && (ev.currentTarget as Node).contains(to)) return;
    this.dropping.set(false);
    this.hover.emit(null);
  }

  protected onDrop(ev: DragEvent): void {
    const id = ev.dataTransfer?.getData(RESOURCE_DRAG_TYPE);
    this.dropping.set(false);
    this.hover.emit(null);
    if (!id || !this.open()) return;
    ev.preventDefault();
    this.dropped.emit(id);
  }

  protected readonly rows = computed(() =>
    this.cards().map((c) => ({
      ...c,
      portrait: this.portraits.urlFor(c.id, c.image),
      monogram: monogram(c.name),
      hue: factionHue(c.faction),
    })),
  );
}
