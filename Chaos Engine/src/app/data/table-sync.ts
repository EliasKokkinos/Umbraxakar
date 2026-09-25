import { DestroyRef, Injectable, InjectionToken, computed, effect, inject, signal } from '@angular/core';
import { TableView, tableView } from '../engine/table-view';
import { GameStore } from './game-store';
import { SeedService } from './seed.service';

export const TABLE_CHANNEL = 'chaos-engine-table';

export interface Channel {
  postMessage(message: unknown): void;
  close(): void;
  onmessage: ((ev: MessageEvent) => void) | null;
}

/** The DM laptop and the TV are two windows of one browser: BroadcastChannel links them. */
export const CHANNEL_FACTORY = new InjectionToken<(name: string) => Channel>('ChannelFactory', {
  providedIn: 'root',
  factory: () => (name: string) => new BroadcastChannel(name),
});

/** What the table may ask of the DM's window. Nothing else is accepted. */
export type TableIntent =
  | { kind: 'assign'; hostId: string; eventId: string }
  | { kind: 'unassign'; hostId: string }
  | { kind: 'attach'; heroId: string; hostId: string }
  | { kind: 'detach'; heroId: string };

export type ToTable =
  | { type: 'view'; view: TableView }
  | { type: 'result'; requestId: number; ok: boolean; error?: string }
  /** Sent when the DM window starts, so a table already open announces itself. */
  | { type: 'ping' };
export type ToHost = { type: 'hello' } | { type: 'intent'; requestId: number; intent: TableIntent };

/**
 * DM side. Publishes the sanitised table view whenever it changes, and carries out the
 * table's requests through the store, so they land in the DM's undo history.
 */
@Injectable({ providedIn: 'root' })
export class TableHost {
  private readonly store = inject(GameStore);
  private readonly seeds = inject(SeedService);
  private readonly channel = inject(CHANNEL_FACTORY)(TABLE_CHANNEL);

  private readonly _revealed = signal<string[]>([]);
  private readonly _showReport = signal(false);
  private readonly _connected = signal(false);

  readonly revealed = this._revealed.asReadonly();
  readonly showingReport = this._showReport.asReadonly();
  /** True once a table window has said hello. */
  readonly connected = this._connected.asReadonly();

  readonly view = computed<TableView | null>(() => {
    const state = this.store.state();
    if (!state) return null;
    return tableView(state, this.store.rules, this.seeds.seed()?.commanders ?? [], {
      pending: this.store.pending(),
      revealed: this._revealed(),
      showReport: this._showReport(),
    });
  });

  constructor() {
    this.channel.onmessage = (ev) => this.receive(ev.data as ToHost);
    this.post({ type: 'ping' });
    effect(() => {
      const view = this.view();
      if (view) this.post({ type: 'view', view });
    });
    inject(DestroyRef).onDestroy(() => this.channel.close());
  }

  reveal(eventId: string): void {
    if (!this._revealed().includes(eventId)) this._revealed.update((r) => [...r, eventId]);
  }

  revealAll(eventIds: string[]): void {
    this._revealed.set([...new Set([...this._revealed(), ...eventIds])]);
  }

  /** Ends the reckoning on the table: clears revealed battles, optionally shows the report. */
  endReckoning(showReport: boolean): void {
    this._revealed.set([]);
    this._showReport.set(showReport);
  }

  openTableWindow(): void {
    window.open(new URL('table', document.baseURI).href, 'chaos-engine-table', 'popup,width=1280,height=720');
  }

  private receive(msg: ToHost): void {
    if (msg?.type === 'hello') {
      this._connected.set(true);
      const view = this.view();
      if (view) this.post({ type: 'view', view });
      return;
    }
    if (msg?.type !== 'intent') return;
    const ok = this.execute(msg.intent);
    this.post({ type: 'result', requestId: msg.requestId, ok, error: ok ? undefined : (this.store.error() ?? 'Not allowed') });
  }

  private execute(intent: TableIntent): boolean {
    switch (intent?.kind) {
      case 'assign':
        return this.store.assign(intent.hostId, intent.eventId);
      case 'unassign':
        return this.store.unassign(intent.hostId);
      case 'attach':
        return this.store.attach(intent.heroId, intent.hostId);
      case 'detach':
        return this.store.detach(intent.heroId);
      default:
        return false;
    }
  }

  private post(msg: ToTable): void {
    this.channel.postMessage(msg);
  }
}

/** Table side. Holds the latest view from the DM and sends requests back. */
@Injectable({ providedIn: 'root' })
export class TableClient {
  private readonly channel = inject(CHANNEL_FACTORY)(TABLE_CHANNEL);
  private readonly _view = signal<TableView | null>(null);
  private readonly _error = signal<string | null>(null);
  private nextRequest = 1;

  readonly view = this._view.asReadonly();
  readonly error = this._error.asReadonly();

  constructor() {
    this.channel.onmessage = (ev) => this.receive(ev.data as ToTable);
    this.channel.postMessage({ type: 'hello' } satisfies ToHost);
    inject(DestroyRef).onDestroy(() => this.channel.close());
  }

  send(intent: TableIntent): void {
    this._error.set(null);
    this.channel.postMessage({ type: 'intent', requestId: this.nextRequest++, intent } satisfies ToHost);
  }

  clearError(): void {
    this._error.set(null);
  }

  private receive(msg: ToTable): void {
    if (msg?.type === 'ping') this.channel.postMessage({ type: 'hello' } satisfies ToHost);
    else if (msg?.type === 'view') this._view.set(msg.view);
    else if (msg?.type === 'result' && !msg.ok) this._error.set(msg.error ?? 'Not allowed');
  }
}
