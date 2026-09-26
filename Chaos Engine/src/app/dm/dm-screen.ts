import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { GameStore } from '../data/game-store';
import { TableHost } from '../data/table-sync';
import { addPortal, moveEvent } from '../engine/dm-edits';
import { eventById } from '../engine/game-state';
import { Point } from '../engine/seed-types';
import { MapBoard } from '../shared/map-board';
import { CastlePanel } from './castle-panel';
import { CommandPicker } from './command-picker';
import { EventInspector } from './event-inspector';
import { NewResourceForm } from './new-resource-form';
import { Reckoning } from './reckoning';
import { ResourceInspector } from './resource-inspector';
import { ResourceLedger } from './resource-ledger';
import { TopBar } from './top-bar';

export type Selection = { kind: 'event' | 'resource'; id: string } | { kind: 'new' } | null;
export type Placing = { kind: 'portal' } | { kind: 'move'; id: string } | null;

@Component({
  selector: 'ce-dm-screen',
  imports: [TopBar, ResourceLedger, MapBoard, EventInspector, ResourceInspector, CastlePanel, Reckoning, CommandPicker, NewResourceForm],
  templateUrl: './dm-screen.html',
  styleUrl: './dm-screen.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
})
export class DmScreen {
  protected readonly store = inject(GameStore);
  protected readonly table = inject(TableHost);
  protected readonly state = this.store.state;
  protected readonly map = computed(() => this.store.rules.map.map);
  protected readonly auraRadius = computed(() => this.store.rules.events.temple.auraRadius);

  protected readonly selection = signal<Selection>(null);
  protected readonly placing = signal<Placing>(null);
  /** Showing the reckoning panel: rolled battles, then the turn report. */
  protected readonly reckoning = signal(false);

  protected readonly selectedEventId = computed(() => {
    const s = this.selection();
    return s?.kind === 'event' && this.state() && eventById(this.state()!, s.id) ? s.id : null;
  });
  protected readonly selectedResourceId = computed(() => {
    const s = this.selection();
    return s?.kind === 'resource' && this.state()!.resources.some((r) => r.id === s.id) ? s.id : null;
  });
  protected readonly creating = computed(() => this.selection()?.kind === 'new');

  protected selectEvent(id: string): void {
    this.selection.set({ kind: 'event', id });
  }

  protected selectResource(id: string): void {
    this.selection.set({ kind: 'resource', id });
  }

  protected onPlace(p: Point): void {
    const mode = this.placing();
    if (mode?.kind === 'portal') this.store.act('Open a portal by hand', (s, r) => addPortal(s, r, p));
    if (mode?.kind === 'move') this.store.act(`Move ${this.nameOf(mode.id)}`, (s, r) => moveEvent(s, mode.id, p, r));
    this.placing.set(null);
  }

  private nameOf(eventId: string): string {
    const s = this.state();
    return (s && eventById(s, eventId)?.name) ?? eventId;
  }

  protected onKey(ev: KeyboardEvent): void {
    const target = ev.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (ev.key === 'Escape') {
      this.placing.set(null);
      this.selection.set(null);
    }
    if (!(ev.ctrlKey || ev.metaKey)) return;
    if (ev.key === 'z' && !ev.shiftKey) {
      ev.preventDefault();
      this.store.undo();
    } else if (ev.key === 'y' || (ev.key === 'z' && ev.shiftKey)) {
      ev.preventDefault();
      this.store.redo();
    }
  }
}
