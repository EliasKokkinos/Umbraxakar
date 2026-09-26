import { TestBed } from '@angular/core/testing';
import { Injector, runInInjectionContext } from '@angular/core';
import { cropSquare } from '../shared/portrait';
import { newGame } from '../engine/game-state';
import { deserialize, serialize } from '../engine/save';
import { RULES, SEED } from '../engine/testing';
import { PERSISTENCE, memoryChosen } from './persistence';
import { PortraitStore } from './portrait-store';
import { CHANNEL_FACTORY, Channel } from './table-sync';

function channelHub() {
  const members = new Set<Channel>();
  return (): Channel => {
    const ch: Channel = {
      onmessage: null,
      postMessage: (data) => {
        for (const other of members) if (other !== ch) queueMicrotask(() => other.onmessage?.({ data } as MessageEvent));
      },
      close: () => members.delete(ch),
    };
    members.add(ch);
    return ch;
  };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('cropSquare', () => {
  it('centres a wide image', () => {
    expect(cropSquare(400, 200)).toEqual({ sx: 100, sy: 0, side: 200 });
  });

  it('biases a tall image towards the top, where faces are', () => {
    expect(cropSquare(200, 400)).toEqual({ sx: 0, sy: 50, side: 200 });
  });

  it('leaves a square alone', () => {
    expect(cropSquare(300, 300)).toEqual({ sx: 0, sy: 0, side: 300 });
  });
});

describe('PortraitStore', () => {
  let dm: PortraitStore;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        // One shared store, as two windows of one browser (or one Umbrel) share.
        { provide: PERSISTENCE, useValue: memoryChosen() },
        { provide: CHANNEL_FACTORY, useValue: channelHub() },
      ],
    });
    dm = TestBed.inject(PortraitStore);
    await dm.ready;
  });

  const tableWindow = async () => {
    const store = runInInjectionContext(TestBed.inject(Injector), () => new PortraitStore());
    await store.ready;
    return store;
  };

  it('prefers an uploaded portrait over the seed image, and falls back to nothing', async () => {
    expect(dm.urlFor('karsa-orlong')).toBeNull();
    expect(dm.urlFor('karsa-orlong', 'portraits/karsa.jpg')).toBe('portraits/karsa.jpg');
    await dm.set('karsa-orlong', 'data:image/jpeg;base64,AAA');
    expect(dm.urlFor('karsa-orlong', 'portraits/karsa.jpg')).toBe('data:image/jpeg;base64,AAA');
    await dm.remove('karsa-orlong');
    expect(dm.urlFor('karsa-orlong')).toBeNull();
  });

  it('the other window picks up a new portrait at once', async () => {
    const tv = await tableWindow();
    await dm.set('uruk', 'data:image/jpeg;base64,UUU');
    await settle();
    await settle();
    expect(tv.urls()['uruk']).toBe('data:image/jpeg;base64,UUU');

    await dm.remove('uruk');
    await settle();
    await settle();
    expect(tv.urls()['uruk']).toBeUndefined();
  });

  it('replaces every portrait when a save is loaded', async () => {
    await dm.set('uruk', 'data:old');
    await dm.replaceAll({ korlat: 'data:new' });
    expect(dm.urls()).toEqual({ korlat: 'data:new' });
    expect((await tableWindow()).urls()).toEqual({ korlat: 'data:new' });
  });
});

describe('save files and portraits', () => {
  const state = newGame(SEED, RULES, 1);

  it('an exported save carries the portraits', () => {
    const file = deserialize(serialize(state, 'x', new Date(), { uruk: 'data:u' }));
    expect(file.ok && file.state.portraits).toEqual({ uruk: 'data:u' });
  });

  it('an autosave or snapshot does not', () => {
    expect(serialize(state, 'Autosave')).not.toContain('portraits');
    expect(serialize(state, 'x', new Date(), {})).not.toContain('portraits');
  });
});
