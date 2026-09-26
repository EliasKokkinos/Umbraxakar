import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { GameStore } from '../data/game-store';
import { eventDifficulty } from '../engine/assignment';
import { PortalPatch, TemplePatch, removeEvent, updatePortal, updateTemple } from '../engine/dm-edits';
import { AURA_RADIUS_RANGE, activeTemplesCovering, auraRadiusOf } from '../engine/events';
import { currentOdds } from '../engine/odds';
import { eventById, resourceById } from '../engine/game-state';
import { hostOptionsFor, resourceView } from '../engine/views';
import { fmt } from '../shared/format';

@Component({
  selector: 'ce-event-inspector',
  templateUrl: './event-inspector.html',
  styleUrl: './inspector.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventInspector {
  protected readonly store = inject(GameStore);
  readonly eventId = input.required<string>();
  readonly selectResource = output<string>();
  readonly move = output<void>();
  readonly removed = output<void>();

  protected readonly fmt = fmt;
  protected readonly toAdd = signal('');
  protected readonly confirmRemove = signal(false);

  protected readonly event = computed(() => eventById(this.store.state()!, this.eventId()));
  protected readonly difficulty = computed(() => {
    const e = this.event();
    return e ? eventDifficulty(e) : 0;
  });
  protected readonly region = computed(() => {
    const id = this.event()?.regionId;
    return this.store.rules.map.map.regions.find((r) => r.id === id)?.name ?? 'Beyond the named lands';
  });
  /** The reach of every temple, in whole percent of the map's width. */
  protected readonly reach = computed(() => {
    const events = this.store.state()!.events;
    const pct = (r: number) => Math.round(r * 100);
    return {
      pct: pct(auraRadiusOf(events, this.store.rules.events)),
      config: pct(this.store.rules.events.temple.auraRadius),
      edited: events.auraRadius !== null,
      min: pct(AURA_RADIUS_RANGE[0]),
      max: pct(AURA_RADIUS_RANGE[1]),
    };
  });

  protected setReach(ev: Event): void {
    this.store.setAuraRadius(Number((ev.target as HTMLInputElement).value) / 100);
  }

  protected resetReach(): void {
    this.store.setAuraRadius(null);
  }

  protected readonly warded = computed(() => {
    const e = this.event();
    if (!e) return [];
    return activeTemplesCovering(
      e.position,
      this.store.state()!.events.temples,
      this.store.rules.events,
      this.store.rules.map.map,
      auraRadiusOf(this.store.state()!.events, this.store.rules.events),
    ).filter(
      (t) => t.id !== e.id,
    );
  });
  protected readonly cards = computed(() => {
    const s = this.store.state()!;
    return (this.event()?.assigned ?? []).flatMap((id) => {
      const r = resourceById(s, id);
      return r ? [resourceView(s, r, this.store.rules)] : [];
    });
  });
  protected readonly options = computed(() => hostOptionsFor(this.store.state()!, this.eventId(), this.store.rules));
  protected readonly odds = computed(() => currentOdds(this.store.state()!, this.eventId(), this.store.rules));
  protected readonly contestable = computed(() => {
    const e = this.event();
    return !!e && (e.type === 'chaos-portal' ? e.status === 'open' : !e.active && e.discovered);
  });
  /** Resources that lost here last turn cannot be recalled. */
  protected readonly pinned = computed(() => {
    const e = this.event();
    const last = this.store.state()!.log.at(-1)?.battles[this.eventId()];
    return new Set(e?.lastOutcome === 'lost' && last ? last.cardPowers.map((c) => c.resourceId) : []);
  });

  private get name(): string {
    return this.event()?.name ?? this.eventId();
  }

  protected add(): void {
    const id = this.toAdd() || this.options().find((o) => o.ok)?.id;
    if (id && this.store.assign(id, this.eventId())) this.toAdd.set('');
  }

  protected editPortal(patch: PortalPatch, what: string): void {
    this.store.act(`${what}: ${this.name}`, (s, r) => updatePortal(s, this.eventId(), patch, r));
  }

  protected editTemple(patch: TemplePatch, what: string): void {
    this.store.act(`${what}: ${this.name}`, (s, r) => updateTemple(s, this.eventId(), patch, r));
  }

  protected remove(): void {
    if (this.store.act(`Remove ${this.name}`, (s) => removeEvent(s, this.eventId()))) this.removed.emit();
  }

  /** The worst an unopposed portal of this impact can do in one turn. */
  protected maxLoss(impact: number): number {
    const p = this.store.rules.events.portal;
    return Math.round(impact * p.civiliansPerImpact * p.casualtyVariance[1]);
  }

  protected num(ev: Event): number {
    return Number((ev.target as HTMLInputElement).value);
  }

  protected text(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }

  protected checked(ev: Event): boolean {
    return (ev.target as HTMLInputElement).checked;
  }
}
