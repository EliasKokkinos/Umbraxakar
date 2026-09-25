import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { TableClient } from '../data/table-sync';
import { TableBattle } from '../engine/table-view';
import { ResourceView } from '../engine/views';
import { fmt } from '../shared/format';
import { MapBoard, RESOURCE_DRAG_TYPE } from '../shared/map-board';
import { ResourceCard } from './resource-card';
import { RevealStage } from './reveal-stage';
import { TableSound } from './table-sound';

/** Readable from across the room: the whole screen scales from the root size. */
const TV_ROOT_FONT = '20px';
/** Markers drawn this much larger than on the DM screen. */
const TV_MARKER_SCALE = 1.35;
const BANNER_MS = 5000;

@Component({
  selector: 'ce-table-screen',
  imports: [MapBoard, ResourceCard, RevealStage],
  templateUrl: './table-screen.html',
  styleUrl: './table-screen.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableScreen {
  private readonly client = inject(TableClient);
  protected readonly sound = inject(TableSound);
  protected readonly markerScale = TV_MARKER_SCALE;

  /** The battle on the stage right now, if one is being revealed. */
  protected readonly staged = signal<TableBattle | null>(null);
  /** Shown briefly when someone takes command. */
  protected readonly banner = signal<{ name: string; impact: { name: string; delta: number }[] } | null>(null);
  private readonly seenBattles = new Set<string>();
  private lastCommander: string | null | undefined = undefined;
  private lastReportTurn: number | null = null;
  private bannerTimer: ReturnType<typeof setTimeout> | undefined;
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
    inject(DestroyRef).onDestroy(() => {
      root.style.fontSize = before;
      clearTimeout(this.bannerTimer);
    });

    // Each newly revealed battle takes the stage once; the list keeps them all.
    effect(() => {
      const battles = this.view()?.reckoning;
      untracked(() => {
        if (!battles) {
          this.seenBattles.clear();
          this.staged.set(null);
          return;
        }
        const fresh = battles.filter((b) => !this.seenBattles.has(b.eventId));
        fresh.forEach((b) => this.seenBattles.add(b.eventId));
        if (fresh.length) this.staged.set(fresh[fresh.length - 1]);
      });
    });

    // Someone takes command: announce it. Not on first load, which is only catching up.
    effect(() => {
      const view = this.view();
      untracked(() => {
        if (!view) return;
        const c = view.commander;
        const name = c?.name ?? null;
        if (this.lastCommander !== undefined && c && name !== this.lastCommander) {
          this.banner.set({ name: c.name, impact: c.impact });
          this.sound.command();
          clearTimeout(this.bannerTimer);
          this.bannerTimer = setTimeout(() => this.banner.set(null), BANNER_MS);
        }
        this.lastCommander = name;
      });
    });

    // A report with a legendary spawn gets its rumble, once.
    effect(() => {
      const r = this.view()?.report;
      untracked(() => {
        if (r && r.turn !== this.lastReportTurn && r.legendary.length) this.sound.legendary();
        this.lastReportTurn = r?.turn ?? null;
      });
    });
  }

  /** Groups beside heroes; each column runs ready, then in the field, then resting. */
  protected readonly columns = computed(() => {
    const rs = this.view()?.resources.filter((r) => !r.attachedTo) ?? [];
    const byPower = (a: ResourceView, b: ResourceView) => b.power.total - a.power.total;
    const bands = (rows: ResourceView[]) =>
      [
        { label: 'Ready', rows: rows.filter((r) => r.location.kind === 'castle' && !r.status).sort(byPower) },
        { label: 'In the field', rows: rows.filter((r) => r.location.kind === 'event').sort(byPower) },
        { label: 'Resting', rows: rows.filter((r) => r.location.kind === 'castle' && !!r.status).sort(byPower) },
      ].filter((b) => b.rows.length);
    const heroes = rs.filter((r) => r.kind !== 'group');
    const groups = rs.filter((r) => r.kind === 'group');
    // Groups on the left, heroes beside the map: heroes are usually dragged onto groups.
    return [
      { title: 'Groups', count: groups.length, bands: bands(groups) },
      { title: 'Heroes', count: heroes.length, bands: bands(heroes) },
    ];
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

  /** Revealed battles, minus the one still on the stage: the list must not spoil the throw. */
  private readonly settled = computed(() => (this.view()?.reckoning ?? []).filter((b) => b.eventId !== this.staged()?.eventId));
  protected readonly latestBattle = computed(() => this.settled().at(-1) ?? null);
  protected readonly earlierBattles = computed(() => this.settled().slice(0, -1).reverse());

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
