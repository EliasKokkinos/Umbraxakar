import { Injectable, computed, effect, signal } from '@angular/core';
import { assign, attach, detach, unassign } from '../engine/assignment';
import { Harm, Outcome } from '../engine/battle';
import { GameState, Result, Rules, eventById, newGame, resourceById } from '../engine/game-state';
import { History, createHistory, push, redo, undo } from '../engine/history';
import { deserialize, serialize } from '../engine/save';
import { Seed } from '../engine/seed-types';
import { PendingResolution, commitTurn, rerollBattle, resolveAll } from '../engine/turn';

export const AUTOSAVE_KEY = 'chaos-engine:autosave';

type Op = (state: GameState, rules: Rules) => Result;

/**
 * The single source of game state. Every change is a named engine operation recorded
 * in a 10-step undo history; the RNG lives in the state, so undo also restores the dice.
 */
@Injectable({ providedIn: 'root' })
export class GameStore {
  private readonly history = signal<History<GameState> | null>(null);
  private readonly _pending = signal<PendingResolution | null>(null);
  private readonly _error = signal<string | null>(null);
  private rulesRef: Rules | null = null;

  readonly state = computed(() => this.history()?.present.state ?? null);
  readonly lastAction = computed(() => this.history()?.present.label ?? null);
  /** Battles rolled and awaiting DM review; null outside resolution. */
  readonly pending = this._pending.asReadonly();
  readonly error = this._error.asReadonly();
  readonly canUndo = computed(() => !!this.history()?.past.length);
  readonly canRedo = computed(() => !!this.history()?.future.length);
  readonly undoLabel = computed(() => (this.canUndo() ? this.history()!.present.label : null));
  readonly redoLabel = computed(() => this.history()?.future[0]?.label ?? null);

  constructor() {
    effect(() => {
      const s = this.state();
      if (!s) return;
      try {
        localStorage.setItem(AUTOSAVE_KEY, serialize(s, 'Autosave'));
      } catch {
        // Storage may be full or blocked; the session carries on without autosave.
      }
    });
  }

  get rules(): Rules {
    if (!this.rulesRef) throw new Error('GameStore used before start()');
    return this.rulesRef;
  }

  // ------------------------------------------------------------ session

  start(seed: Seed, rules: Rules, rngSeed = Math.floor(Math.random() * 2 ** 32)): void {
    this.rulesRef = rules;
    this.reset(newGame(seed, rules, rngSeed), 'New session');
  }

  /** Continues from an existing state (a loaded save or the autosave). */
  resume(state: GameState, rules: Rules, label = 'Session resumed'): void {
    this.rulesRef = rules;
    this.reset(state, label);
  }

  private reset(state: GameState, label: string): void {
    this.history.set(createHistory(state, label));
    this._pending.set(null);
    this._error.set(null);
  }

  // ------------------------------------------------------------ actions

  /** Runs a named engine operation. On failure nothing changes and `error` explains why. */
  act(label: string, op: Op): boolean {
    const h = this.history();
    if (!h) return false;
    const result = op(h.present.state, this.rules);
    if (!result.ok) {
      this._error.set(result.error);
      return false;
    }
    this.history.set(push(h, result.state, label));
    this._pending.set(null);
    this._error.set(null);
    return true;
  }

  clearError(): void {
    this._error.set(null);
  }

  private nameOf(id: string): string {
    const s = this.state();
    return (s && (resourceById(s, id)?.name ?? eventById(s, id)?.name)) || id;
  }

  assign(hostId: string, eventId: string): boolean {
    return this.act(`Send ${this.nameOf(hostId)} to ${this.nameOf(eventId)}`, (s, r) => assign(s, hostId, eventId, r));
  }

  unassign(hostId: string): boolean {
    return this.act(`Recall ${this.nameOf(hostId)}`, (s) => unassign(s, hostId));
  }

  attach(heroId: string, hostId: string): boolean {
    return this.act(`Attach ${this.nameOf(heroId)} to ${this.nameOf(hostId)}`, (s) => attach(s, heroId, hostId));
  }

  detach(heroId: string): boolean {
    return this.act(`Detach ${this.nameOf(heroId)}`, (s) => detach(s, heroId));
  }

  undo(): void {
    const h = this.history();
    if (h) this.history.set(undo(h));
    this._pending.set(null);
  }

  redo(): void {
    const h = this.history();
    if (h) this.history.set(redo(h));
    this._pending.set(null);
  }

  // ------------------------------------------------------------ end of turn

  /** Rolls every contested event for DM review. Changes nothing until commit. */
  resolve(): PendingResolution | null {
    const s = this.state();
    if (!s) return null;
    const pending = resolveAll(s, this.rules);
    this._pending.set(pending);
    return pending;
  }

  reroll(eventId: string): void {
    const s = this.state();
    const p = this._pending();
    if (s && p) this._pending.set(rerollBattle(s, p, eventId, this.rules));
  }

  /** DM override of a rolled battle's outcome and/or harm, before the reveal. */
  overrideBattle(eventId: string, change: { outcome?: Outcome; harm?: Harm[] }): void {
    const p = this._pending();
    const battle = p?.battles[eventId];
    if (!p || !battle) return;
    const outcome = change.outcome ?? battle.outcome;
    this._pending.set({
      ...p,
      battles: {
        ...p.battles,
        [eventId]: {
          ...battle,
          outcome,
          // A forced result is no longer a natural 1 or 20.
          rout: change.outcome ? false : battle.rout,
          heroicVictory: change.outcome ? false : battle.heroicVictory,
          harm: change.harm ?? battle.harm,
        },
      },
    });
  }

  cancelResolution(): void {
    this._pending.set(null);
  }

  /** Applies the reviewed battles and advances the turn: one undoable step. */
  commit(): boolean {
    const s = this.state();
    const p = this._pending() ?? (s ? resolveAll(s, this.rules) : null);
    if (!s || !p) return false;
    return this.act(`End turn ${s.events.turn}`, (state, rules) => ({ ok: true, state: commitTurn(state, p, rules) }));
  }

  // ------------------------------------------------------------ persistence

  exportSave(label = 'Manual save'): string | null {
    const s = this.state();
    return s ? serialize(s, label) : null;
  }

  importSave(json: string, rules: Rules): boolean {
    const file = deserialize(json);
    if (!file.ok) {
      this._error.set(file.error);
      return false;
    }
    this.resume(file.state.state, rules, `Loaded "${file.state.label}"`);
    return true;
  }

  readAutosave(): string | null {
    try {
      return localStorage.getItem(AUTOSAVE_KEY);
    } catch {
      return null;
    }
  }
}
