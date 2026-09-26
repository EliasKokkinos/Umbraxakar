import { TestBed } from '@angular/core/testing';
import { PERSISTENCE, memoryChosen } from './persistence';
import { Injector, runInInjectionContext } from '@angular/core';
import { RULES, SEED } from '../engine/testing';
import { eventOf } from '../engine/game-state';
import { GameStore } from './game-store';
import { SeedService } from './seed.service';
import { CHANNEL_FACTORY, Channel, TableClient, TableHost } from './table-sync';

/** An in-memory BroadcastChannel: every channel on a name hears every other, asynchronously. */
function channelHub() {
  const members = new Set<Channel>();
  return (_name: string): Channel => {
    const ch: Channel = {
      onmessage: null,
      postMessage: (message) => {
        const data = structuredClone(message);
        for (const other of members) if (other !== ch) queueMicrotask(() => other.onmessage?.({ data } as MessageEvent));
      },
      close: () => members.delete(ch),
    };
    members.add(ch);
    return ch;
  };
}

const settle = async () => {
  for (let i = 0; i < 5; i++) {
    TestBed.tick();
    await new Promise((r) => setTimeout(r));
  }
};

describe('table sync', () => {
  let store: GameStore;
  let host: TableHost;
  let client: TableClient;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: CHANNEL_FACTORY, useValue: channelHub() },
        { provide: SeedService, useValue: { seed: () => SEED } },
        { provide: PERSISTENCE, useFactory: memoryChosen },
      ],
    });
    store = TestBed.inject(GameStore);
    store.start(SEED, RULES, 4242);
    host = TestBed.inject(TableHost);
    // The table is a separate window: give it its own client instance on the same hub.
    client = runInInjectionContext(TestBed.inject(Injector), () => new TableClient());
  });

  it('the table receives the view as soon as it says hello', async () => {
    await settle();
    expect(host.connected()).toBe(true);
    expect(client.view()?.turn).toBe(1);
    expect(client.view()?.portals.length).toBe(store.state()!.events.portals.filter((p) => !p.hidden).length);
  });

  it('a DM window that starts after the table still finds it', async () => {
    await settle();
    const lateHost = runInInjectionContext(TestBed.inject(Injector), () => new TableHost());
    expect(lateHost.connected()).toBe(false);
    await settle();
    expect(lateHost.connected()).toBe(true);
  });

  it('pushes every change on the DM side to the table', async () => {
    await settle();
    const portal = store.state()!.events.portals[0].id;
    store.assign('bridgeburners', portal);
    await settle();
    expect(client.view()!.resources.find((r) => r.id === 'bridgeburners')!.location).toMatchObject({ kind: 'event', id: portal });
  });

  it('carries out the table’s requests as undoable DM actions', async () => {
    await settle();
    const portal = store.state()!.events.portals[0].id;
    client.send({ kind: 'assign', hostId: 'bridgeburners', eventId: portal });
    await settle();
    expect(eventOf(store.state()!, 'bridgeburners')?.id).toBe(portal);
    expect(store.undoLabel()).toMatch(/^Send Bridgeburners to/);
    expect(client.view()!.resources.find((r) => r.id === 'bridgeburners')!.location.kind).toBe('event');
  });

  it('tells the table when a request is refused', async () => {
    await settle();
    client.send({ kind: 'assign', hostId: 'karsa-orlong', eventId: store.state()!.events.portals[0].id });
    await settle();
    expect(client.error()).toBe('Karsa Orlong takes the field with a group: attach them to one first');
  });

  it('ignores anything that is not a known request', async () => {
    await settle();
    const before = store.state();
    client.send({ kind: 'set-treasury', amount: 1e9 } as never);
    await settle();
    expect(store.state()).toBe(before);
    expect(client.error()).toBe('Not allowed');
  });

  it('reveals battles one at a time, then the report', async () => {
    const portal = store.state()!.events.portals[0].id;
    store.takeCommand('col');
    store.assign('bridgeburners', portal);
    store.resolve();
    await settle();
    expect(client.view()!.reckoning).toEqual([]);

    host.reveal(portal);
    await settle();
    expect(client.view()!.reckoning!.map((b) => b.eventId)).toEqual([portal]);

    store.commit();
    host.endReckoning(true);
    await settle();
    expect(client.view()!.reckoning).toBeNull();
    expect(client.view()!.report?.turn).toBe(1);

    host.endReckoning(false);
    await settle();
    expect(client.view()!.report).toBeNull();
  });
});
