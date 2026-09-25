import { TestBed } from '@angular/core/testing';
import { hireEntertainers } from '../engine/castle';
import { eventOf } from '../engine/game-state';
import { RULES, SEED } from '../engine/testing';
import { AUTOSAVE_KEY, GameStore } from './game-store';

describe('GameStore', () => {
  let store: GameStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(GameStore);
    store.start(SEED, RULES, 1111);
  });

  const firstPortal = () => store.state()!.events.portals[0].id;

  it('starts a session with nothing to undo', () => {
    expect(store.state()!.events.turn).toBe(1);
    expect(store.lastAction()).toBe('New session');
    expect(store.canUndo()).toBe(false);
  });

  it('records named actions and undoes them', () => {
    expect(store.assign('karsa-orlong', firstPortal())).toBe(true);
    expect(store.undoLabel()).toMatch(/^Send Karsa Orlong to /);
    expect(eventOf(store.state()!, 'karsa-orlong')).toBeDefined();

    store.undo();
    expect(eventOf(store.state()!, 'karsa-orlong')).toBeUndefined();
    expect(store.redoLabel()).toMatch(/^Send Karsa Orlong/);
    store.redo();
    expect(eventOf(store.state()!, 'karsa-orlong')).toBeDefined();
  });

  it('reports a refused action without changing anything', () => {
    const before = store.state();
    expect(store.assign('anomander-rake', firstPortal())).toBe(false);
    expect(store.error()).toBe('Anomander Rake: Not yet resurrected.');
    expect(store.state()).toBe(before);
    expect(store.canUndo()).toBe(false);
  });

  it('runs any engine operation as a named action', () => {
    expect(store.act('Hire entertainers', hireEntertainers)).toBe(true);
    expect(store.state()!.castle.treasury).toBe(198000);
  });

  it('keeps ten undo steps', () => {
    const portals = store.state()!.events.portals;
    const hosts = ['karsa-orlong', 'uruk', 'korlat', 'blues', 'cowl', 'shimmer', 'kazz-davore', 'sanjuro-sawa', 'john-ahl117', 'trull-sengar', 'silchas-ruin', 'bridgeburners'];
    hosts.forEach((h, i) => store.assign(h, portals[i].id));
    let undos = 0;
    while (store.canUndo()) {
      store.undo();
      undos++;
    }
    expect(undos).toBe(10);
    expect(eventOf(store.state()!, 'uruk')).toBeDefined(); // the first two assignments fell off
    expect(eventOf(store.state()!, 'korlat')).toBeUndefined();
  });

  it('resolves for review, then commits the turn as one undoable step', () => {
    store.assign('karsa-orlong', firstPortal());
    const pending = store.resolve()!;
    expect(Object.keys(pending.battles)).toEqual([firstPortal()]);
    expect(store.state()!.events.turn).toBe(1);

    expect(store.commit()).toBe(true);
    expect(store.state()!.events.turn).toBe(2);
    expect(store.pending()).toBeNull();
    expect(store.undoLabel()).toBe('End turn 1');
  });

  it('undoing a turn restores the dice: resolving again gives the same rolls', () => {
    store.assign('karsa-orlong', firstPortal());
    store.assign('malazan-legion-1', store.state()!.events.portals[1].id);
    const first = store.resolve()!;
    store.commit();
    const afterFirst = store.state();
    store.undo();
    expect(store.resolve()).toEqual(first);
    store.commit();
    expect(store.state()).toEqual(afterFirst);
  });

  it('lets the DM force an outcome before committing', () => {
    const id = firstPortal();
    store.assign('trull-sengar', id);
    store.resolve();
    store.overrideBattle(id, { outcome: 'won', harm: [] });
    expect(store.pending()!.battles[id]).toMatchObject({ outcome: 'won', rout: false, heroicVictory: false, harm: [] });
    store.commit();
    // New portals start at corruption 1, so a forced win closes it outright.
    expect(store.state()!.events.portals.find((p) => p.id === id)!.status).toBe('closed');
    expect(store.state()!.log[0].battles[id].outcome).toBe('won');
  });

  it('exports and imports saves; the import is a fresh history', () => {
    store.assign('karsa-orlong', firstPortal());
    store.commit();
    const json = store.exportSave('Before the storm')!;
    const saved = store.state();

    store.assign('uruk', store.state()!.events.portals.find((p) => p.status === 'open')!.id);
    expect(store.importSave(json, RULES)).toBe(true);
    expect(store.state()).toEqual(saved);
    expect(store.lastAction()).toBe('Loaded "Before the storm"');
    expect(store.canUndo()).toBe(false);

    expect(store.importSave('{"nope":1}', RULES)).toBe(false);
    expect(store.error()).toBe('Not a Chaos Engine save file');
  });

  it('autosaves every change to local storage', () => {
    store.assign('karsa-orlong', firstPortal());
    TestBed.tick();
    const auto = JSON.parse(localStorage.getItem(AUTOSAVE_KEY)!);
    expect(auto.label).toBe('Autosave');
    expect(auto.state).toEqual(store.state());
    expect(store.readAutosave()).toBe(localStorage.getItem(AUTOSAVE_KEY));
  });
});
