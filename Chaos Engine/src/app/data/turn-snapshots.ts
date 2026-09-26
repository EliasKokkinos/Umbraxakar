import { Injectable, inject, signal } from '@angular/core';
import { GameState } from '../engine/game-state';
import { deserialize, serialize } from '../engine/save';
import { PERSISTENCE } from './persistence';

export { SNAPSHOTS_KEY } from './persistence';
export const SNAPSHOT_LIMIT = 10;

export interface TurnSnapshot {
  /** Unique within the list; restoring then replaying a turn records it again. */
  id: string;
  turn: number;
  savedAt: string;
  label: string;
  /** A full save file, so old snapshots migrate like any save. */
  save: string;
}

/**
 * The state at the start of each turn, the last ten kept: on the Umbrel's disk, or in this
 * browser. Undo covers ten actions; this covers ten turns.
 */
@Injectable({ providedIn: 'root' })
export class TurnSnapshots {
  private readonly persistence = inject(PERSISTENCE);
  private readonly _list = signal<TurnSnapshot[]>([]);
  /** Counts writes, so a slow read never overwrites a snapshot recorded after it began. */
  private writes = 0;
  /** Newest first. */
  readonly list = this._list.asReadonly();
  /** Resolves once the stored list has been read. */
  readonly ready: Promise<void> = this.reload();

  /** Reads the stored list again (a reload, or after storage moves to the server). */
  async reload(): Promise<void> {
    const before = this.writes;
    let stored: TurnSnapshot[] = [];
    try {
      stored = await this.persistence.readSnapshots();
    } catch {
      // Unreadable storage: start from an empty list.
    }
    if (before === this.writes) this._list.set(stored);
  }

  record(state: GameState, label: string, now = new Date()): void {
    const entry: TurnSnapshot = {
      id: `${state.events.turn}-${now.getTime()}`,
      turn: state.events.turn,
      savedAt: now.toISOString(),
      label,
      save: serialize(state, label, now),
    };
    const next = [entry, ...this._list()].slice(0, SNAPSHOT_LIMIT);
    this.writes++;
    this._list.set(next);
    void this.persist(next);
  }

  /** The saved state, migrated to the current version, or null if it cannot be read. */
  load(id: string): GameState | null {
    const snap = this._list().find((s) => s.id === id);
    const file = snap ? deserialize(snap.save) : null;
    return file?.ok ? file.state.state : null;
  }

  clear(): void {
    this.writes++;
    this._list.set([]);
    void this.persistence.writeSnapshots([]);
  }

  /** Browser storage is small: if it is full, give up the oldest turns rather than the newest. */
  private async persist(list: TurnSnapshot[]): Promise<void> {
    let kept = list;
    while (kept.length && !(await this.persistence.writeSnapshots(kept))) kept = kept.slice(0, -1);
    if (kept.length !== list.length) this._list.set(kept);
  }
}
