import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { TableClient } from '../data/table-sync';
import { ResourceView } from '../engine/views';
import { fmt } from '../shared/format';
import { MapBoard, RESOURCE_DRAG_TYPE } from '../shared/map-board';
import { ResourceCard } from './resource-card';

/** Readable from across the room: the whole screen scales from the root size. */
const TV_ROOT_FONT = '19px';

@Component({
  selector: 'ce-table-screen',
  imports: [MapBoard, ResourceCard],
  templateUrl: './table-screen.html',
  styleUrl: './table-screen.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableScreen {
  private readonly client = inject(TableClient);
  protected readonly view = this.client.view;
  protected readonly error = this.client.error;
  protected readonly fmt = fmt;

  protected readonly selectedEventId = signal<string | null>(null);
  protected readonly selectedResourceId = signal<string | null>(null);
  protected readonly castleOpen = signal(false);
  protected readonly castleDropping = signal(false);

  constructor() {
    const root = document.documentElement;
    const before = root.style.fontSize;
    root.style.fontSize = TV_ROOT_FONT;
    inject(DestroyRef).onDestroy(() => (root.style.fontSize = before));
  }

  protected readonly sections = computed(() => {
    const rs = this.view()?.resources.filter((r) => !r.attachedTo) ?? [];
    const byPower = (a: ResourceView, b: ResourceView) => b.power.total - a.power.total;
    return [
      { title: 'Ready at the castle', rows: rs.filter((r) => r.location.kind === 'castle' && !r.status).sort(byPower) },
      { title: 'In the field', rows: rs.filter((r) => r.location.kind === 'event').sort(byPower) },
      { title: 'Resting', rows: rs.filter((r) => r.location.kind === 'castle' && !!r.status).sort(byPower) },
    ].filter((s) => s.rows.length);
  });

  protected readonly selectedEvent = computed(() => {
    const v = this.view();
    const id = this.selectedEventId();
    if (!v || !id) return null;
    return v.portals.find((p) => p.id === id) ?? v.temples.find((t) => t.id === id) ?? null;
  });

  protected readonly selectedEventCards = computed(() => {
    const e = this.selectedEvent();
    return e ? (this.view()?.resources.filter((r) => e.assigned.includes(r.id)) ?? []) : [];
  });

  protected readonly selectedResource = computed(() => {
    const id = this.selectedResourceId();
    return this.view()?.resources.find((r) => r.id === id) ?? null;
  });

  protected readonly latestBattle = computed(() => this.view()?.reckoning?.at(-1) ?? null);
  protected readonly earlierBattles = computed(() => (this.view()?.reckoning ?? []).slice(0, -1).reverse());

  protected regionName(id: string | null): string {
    return this.view()?.map.regions.find((r) => r.id === id)?.name ?? 'the wild lands';
  }

  protected selectEvent(id: string): void {
    this.selectedResourceId.set(null);
    this.selectedEventId.set(this.selectedEventId() === id ? null : id);
  }

  protected inspectResource(id: string): void {
    this.selectedEventId.set(null);
    this.selectedResourceId.set(this.selectedResourceId() === id ? null : id);
  }

  /** A card dropped on an event: bring it home first if it is elsewhere. */
  protected send(resourceId: string, eventId: string): void {
    const r = this.view()?.resources.find((x) => x.id === resourceId);
    if (!r) return;
    if (r.location.kind === 'event') {
      if (r.location.id === eventId) return;
      this.client.send({ kind: 'unassign', hostId: resourceId });
    }
    this.client.send({ kind: 'assign', hostId: resourceId, eventId });
    this.selectedEventId.set(eventId);
  }

  protected attach(heroId: string, hostId: string): void {
    this.client.send({ kind: 'attach', heroId, hostId });
  }

  protected recall(resourceId: string): void {
    this.client.send({ kind: 'unassign', hostId: resourceId });
  }

  protected detach(heroId: string): void {
    this.client.send({ kind: 'detach', heroId });
  }

  // The castle is a drop zone too: dropping a card there calls it home.
  protected onCastleDragOver(ev: DragEvent): void {
    if (!ev.dataTransfer?.types.includes(RESOURCE_DRAG_TYPE)) return;
    ev.preventDefault();
    this.castleDropping.set(true);
  }

  protected onCastleDrop(ev: DragEvent): void {
    this.castleDropping.set(false);
    const id = ev.dataTransfer?.getData(RESOURCE_DRAG_TYPE);
    if (!id) return;
    ev.preventDefault();
    this.recall(id);
  }

  protected dismissError(): void {
    this.client.clearError();
  }
}
