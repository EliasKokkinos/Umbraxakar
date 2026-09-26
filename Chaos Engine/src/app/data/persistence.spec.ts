import { choosePersistence, memoryPersistence, serverHasStorage, serverPersistence, serverWriteError } from './persistence';

const BASE = 'http://umbrel:7400/';

/** A scripted fetch that records every call. */
function fakeFetch(respond: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; method: string; body?: string }[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined });
    return respond(url, init);
  }) as typeof fetch;
  return { fn, calls };
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

describe('serverHasStorage', () => {
  it('is true only when the server says it keeps the data', async () => {
    expect(await serverHasStorage(BASE, fakeFetch(() => json({ ok: true, storage: 'server' })).fn)).toBe(true);
    expect(await serverHasStorage(BASE, fakeFetch(() => json({ error: 'No server storage' }, 404)).fn)).toBe(false);
    expect(await serverHasStorage(BASE, fakeFetch(() => Promise.reject(new TypeError('offline'))).fn)).toBe(false);
  });
});

describe('serverPersistence', () => {
  afterEach(() => {
    vi.useRealTimers();
    serverWriteError.set(null);
  });

  it('reads the autosave, or nothing when there is none', async () => {
    let stored: string | null = null;
    const f = fakeFetch(() => (stored ? new Response(stored) : json({}, 404)));
    const p = serverPersistence(BASE, f.fn);
    expect(await p.readAutosave()).toBeNull();
    stored = '{"format":"chaos-engine-save"}';
    expect(await p.readAutosave()).toBe(stored);
    expect(f.calls[0].url).toBe('http://umbrel:7400/api/autosave');
  });

  it('turns a burst of changes into one write', async () => {
    vi.useFakeTimers();
    const f = fakeFetch(() => new Response(null, { status: 204 }));
    const p = serverPersistence(BASE, f.fn);
    p.writeAutosave('{"n":1}');
    p.writeAutosave('{"n":2}');
    p.writeAutosave('{"n":3}');
    expect(f.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(f.calls).toEqual([{ url: 'http://umbrel:7400/api/autosave', method: 'PUT', body: '{"n":3}' }]);
  });

  it('reports a write the Umbrel refused, and clears it on the next success', async () => {
    let ok = false;
    const f = fakeFetch(() => new Response(null, { status: ok ? 204 : 500 }));
    const p = serverPersistence(BASE, f.fn);
    await p.writeSnapshots([]);
    expect(serverWriteError()).toMatch(/refused to store the snapshots/);
    ok = true;
    await p.writeSnapshots([]);
    expect(serverWriteError()).toBeNull();
  });

  it('stores and removes portraits one at a time, or all at once', async () => {
    const f = fakeFetch((url) => (url.endsWith('/api/portraits') ? json({ uruk: 'data:image/jpeg;base64,U' }) : new Response(null, { status: 204 })));
    const p = serverPersistence(BASE, f.fn);
    expect(await p.portraits.getAll()).toEqual({ uruk: 'data:image/jpeg;base64,U' });
    await p.portraits.put('karsa-orlong', 'data:image/jpeg;base64,K');
    await p.portraits.delete('uruk');
    await p.portraits.replaceAll({});
    expect(f.calls.slice(1).map((c) => `${c.method} ${c.url.replace(BASE, '/')}`)).toEqual([
      'PUT /api/portraits/karsa-orlong',
      'DELETE /api/portraits/uruk',
      'PUT /api/portraits',
    ]);
    expect(JSON.parse(f.calls[1].body!)).toEqual({ dataUrl: 'data:image/jpeg;base64,K' });
  });
});

describe('choosePersistence', () => {
  it('moves to the server when it answers, and reads only after choosing', async () => {
    const server = memoryPersistence();
    server.writeAutosave('from the Umbrel');
    const browser = memoryPersistence();
    browser.writeAutosave('from this browser');
    const chosen = choosePersistence(async () => true, () => server, () => browser);
    expect(await chosen.readAutosave()).toBe('from the Umbrel');
    expect(await chosen.ready).toBe('memory');
  });

  it('stays in the browser when there is no server storage', async () => {
    const browser = memoryPersistence();
    browser.writeAutosave('from this browser');
    const chosen = choosePersistence(async () => false, () => memoryPersistence(), () => browser);
    expect(await chosen.readAutosave()).toBe('from this browser');
  });
});
