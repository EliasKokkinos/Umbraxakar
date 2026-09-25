import { TestBed } from '@angular/core/testing';
import { RULES, SEED } from '../engine/testing';
import { GameStore } from './game-store';
import { SNAPSHOTS_KEY, SNAPSHOT_LIMIT, TurnSnapshots } from './turn-snapshots';

describe('TurnSnapshots', () => {
  let store: GameStore;
  let snapshots: TurnSnapshots;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(GameStore);
    snapshots = TestBed.inject(TurnSnapshots);
    store.start(SEED, RULES, 77);
  });

  /** Takes command and ends the turn, as the DM would. */
  const playTurn = () => {
    store.takeCommand('col');
    expect(store.commit()).toBe(true);
  };

  it('keeps the start of the session and of every turn, newest first', () => {
    playTurn();
    playTurn();
    expect(snapshots.list().map((s) => s.turn)).toEqual([3, 2, 1]);
    expect(snapshots.list()[2].label).toBe('Start of turn 1, new session');
  });

  it('keeps only the last ten turns', () => {
    for (let i = 0; i < 12; i++) playTurn();
    expect(snapshots.list()).toHaveLength(SNAPSHOT_LIMIT);
    expect(snapshots.list()[0].turn).toBe(13);
    expect(snapshots.list().at(-1)!.turn).toBe(4);
  });

  it('restores an earlier turn exactly, with a fresh history, and keeps the later ones', () => {
    const turn2 = (() => {
      playTurn();
      return structuredClone(store.state());
    })();
    playTurn();
    playTurn();

    const id = snapshots.list().find((s) => s.turn === 2)!.id;
    expect(store.restoreSnapshot(id)).toBe(true);
    expect(store.state()).toEqual(turn2);
    expect(store.lastAction()).toBe('Rewound to the start of turn 2');
    expect(store.canUndo()).toBe(false);
    expect(snapshots.list().map((s) => s.turn)).toEqual([4, 3, 2, 1]);
  });

  it('survives a reload: the list is read back from storage', () => {
    playTurn();
    const again = new TurnSnapshots();
    expect(again.list().map((s) => s.turn)).toEqual([2, 1]);
    expect(JSON.parse(localStorage.getItem(SNAPSHOTS_KEY)!)).toHaveLength(2);
  });

  it('gives up the oldest turns when storage is full', () => {
    playTurn();
    playTurn();
    const realSetItem = Storage.prototype.setItem;
    // Storage that can hold at most two snapshots.
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === SNAPSHOTS_KEY && JSON.parse(value).length > 2) throw new DOMException('full', 'QuotaExceededError');
      realSetItem.call(this, key, value);
    });
    playTurn();
    spy.mockRestore();
    expect(snapshots.list().map((s) => s.turn)).toEqual([4, 3]);
  });

  it('a resumed session is snapshotted once for its turn, not on every reload', () => {
    snapshots.clear();
    const s = store.state()!;
    store.resume(s, RULES);
    store.resume(s, RULES);
    expect(snapshots.list().map((x) => x.label)).toEqual(['Turn 1, as resumed']);
  });

  it('reports a snapshot that cannot be read', () => {
    expect(store.restoreSnapshot('no-such-turn')).toBe(false);
    expect(store.error()).toBe('That turn could not be restored.');
  });
});
