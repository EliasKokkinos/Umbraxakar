import { Injectable, signal } from '@angular/core';
import { GameState } from '../engine/game-state';
import { deserialize, serialize } from '../engine/save';

export const SNAPSHOTS_KEY = 'chaos-engine:turns';
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
 * The state at the start of each turn, the last ten kept in browser storage. Undo covers
 * ten actions; this covers ten turns.
 */
@Injectable({ providedIn: 'root' })
export class TurnSnapshots {
  private readonly _list = signal<TurnSnapshot[]>(this.read());
  /** Newest first. */
  readonly list = this._list.asReadonly();

  record(state: GameState, label: string, now = new Date()): void {
    const entry: TurnSnapshot = {
      id: `${state.events.turn}-${now.getTime()}`,
      turn: state.events.turn,
      savedAt: now.toISOString(),
      label,
      save: serialize(state, label, now),
    };
    let next = [entry, ...this._list()].slice(0, SNAPSHOT_LIMIT);
    // Browser storage is small: if it is full, give up the oldest turns rather than the newest.
    while (next.length && !this.write(next)) next = next.slice(0, -1);
    this._list.set(next);
  }

  /** The saved state, migrated to the current version, or null if it cannot be read. */
  load(id: string): GameState | null {
    const snap = this._list().find((s) => s.id === id);
    const file = snap ? deserialize(snap.save) : null;
    return file?.ok ? file.state.state : null;
  }

  clear(): void {
    this.write([]);
    this._list.set([]);
  }

  private read(): TurnSnapshot[] {
    try {
      const raw = localStorage.getItem(SNAPSHOTS_KEY);
      return raw ? (JSON.parse(raw) as TurnSnapshot[]) : [];
    } catch {
      return [];
    }
  }

  private write(list: TurnSnapshot[]): boolean {
    try {
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  }
}
