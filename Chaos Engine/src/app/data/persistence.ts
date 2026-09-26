import { InjectionToken, signal } from '@angular/core';
import type { TurnSnapshot } from './turn-snapshots';

export const AUTOSAVE_KEY = 'chaos-engine:autosave';
export const SNAPSHOTS_KEY = 'chaos-engine:turns';

/** Where portraits are kept. */
export interface PortraitBackend {
  getAll(): Promise<Record<string, string>>;
  put(id: string, dataUrl: string): Promise<void>;
  delete(id: string): Promise<void>;
  /** Replaces every portrait at once. */
  replaceAll(all: Record<string, string>): Promise<void>;
}

export type StorageKind = 'server' | 'browser' | 'memory';

/**
 * Where the game's data lives: the autosave, the turn snapshots and the portraits.
 * On the Umbrel that is the server's disk; anywhere else, this browser.
 */
export interface Persistence {
  readonly kind: StorageKind;
  readAutosave(): Promise<string | null>;
  writeAutosave(json: string): void;
  readSnapshots(): Promise<TurnSnapshot[]>;
  /** False when the list could not be stored whole (browser storage full). */
  writeSnapshots(list: TurnSnapshot[]): Promise<boolean>;
  readonly portraits: PortraitBackend;
}

// ---------------------------------------------------------------- this browser

const DB_NAME = 'chaos-engine-portraits';
const STORE = 'portraits';

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** IndexedDB: large enough for portraits, unlike localStorage's few megabytes. */
export function indexedDbPortraits(): PortraitBackend {
  let db: Promise<IDBDatabase> | null = null;
  const open = () =>
    (db ??= new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  const store = async (mode: IDBTransactionMode) => (await open()).transaction(STORE, mode).objectStore(STORE);

  return {
    async getAll() {
      const s = await store('readonly');
      const [keys, values] = await Promise.all([request(s.getAllKeys()), request(s.getAll())]);
      return Object.fromEntries(keys.map((k, i) => [String(k), values[i] as string]));
    },
    async put(id, dataUrl) {
      await request((await store('readwrite')).put(dataUrl, id));
    },
    async delete(id) {
      await request((await store('readwrite')).delete(id));
    },
    async replaceAll(all) {
      await request((await store('readwrite')).clear());
      for (const [id, url] of Object.entries(all)) await request((await store('readwrite')).put(url, id));
    },
  };
}

export function browserPersistence(): Persistence {
  const get = (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  return {
    kind: 'browser',
    readAutosave: async () => get(AUTOSAVE_KEY),
    writeAutosave: (json) => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, json);
      } catch {
        // Storage may be full or blocked; the session carries on without autosave.
      }
    },
    readSnapshots: async () => {
      try {
        return JSON.parse(get(SNAPSHOTS_KEY) ?? '[]') as TurnSnapshot[];
      } catch {
        return [];
      }
    },
    writeSnapshots: async (list) => {
      try {
        localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(list));
        return true;
      } catch {
        return false;
      }
    },
    portraits: indexedDbPortraits(),
  };
}

// ---------------------------------------------------------------- the Umbrel's disk

const AUTOSAVE_DEBOUNCE_MS = 400;

/** Status of writes to the server, for the DM to see. */
export const serverWriteError = signal<string | null>(null);

export function serverPersistence(base = document.baseURI, fetchFn: typeof fetch = (...a) => fetch(...a)): Persistence {
  const url = (path: string) => new URL(`api/${path}`, base).href;
  const call = async (path: string, init?: RequestInit) => {
    const r = await fetchFn(url(path), init);
    if (!r.ok && r.status !== 404) throw new Error(`The Umbrel refused to store the ${path.split('/')[0]} (${r.status}).`);
    return r;
  };
  const putJson = (path: string, value: unknown) =>
    call(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: typeof value === 'string' ? value : JSON.stringify(value) });
  const report = (e: unknown) => serverWriteError.set(e instanceof Error ? e.message : 'The Umbrel could not be reached.');
  const done = () => serverWriteError.set(null);

  // A burst of drags makes one write, not twenty.
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    if (pending === null) return;
    const json = pending;
    pending = null;
    putJson('autosave', json).then(done, report);
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  }

  return {
    kind: 'server',
    readAutosave: async () => {
      const r = await call('autosave');
      return r.status === 404 ? null : r.text();
    },
    writeAutosave: (json) => {
      pending = json;
      clearTimeout(timer);
      timer = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
    },
    readSnapshots: async () => (await (await call('snapshots')).json()) as TurnSnapshot[],
    writeSnapshots: async (list) => {
      try {
        await putJson('snapshots', list);
        done();
        return true;
      } catch (e) {
        report(e);
        // The server does not run out of room like a browser does: keep the list, report the fault.
        return true;
      }
    },
    portraits: {
      getAll: async () => (await (await call('portraits')).json()) as Record<string, string>,
      put: async (id, dataUrl) => void (await putJson(`portraits/${encodeURIComponent(id)}`, { dataUrl })),
      delete: async (id) => void (await call(`portraits/${encodeURIComponent(id)}`, { method: 'DELETE' })),
      replaceAll: async (all) => void (await putJson('portraits', all)),
    },
  };
}

// ---------------------------------------------------------------- tests

export function memoryPersistence(): Persistence {
  let autosave: string | null = null;
  let snapshots: TurnSnapshot[] = [];
  const portraits = new Map<string, string>();
  return {
    kind: 'memory',
    readAutosave: async () => autosave,
    writeAutosave: (json) => void (autosave = json),
    readSnapshots: async () => structuredClone(snapshots),
    writeSnapshots: async (list) => ((snapshots = structuredClone(list)), true),
    portraits: {
      getAll: async () => Object.fromEntries(portraits),
      put: async (id, url) => void portraits.set(id, url),
      delete: async (id) => void portraits.delete(id),
      replaceAll: async (all) => {
        portraits.clear();
        for (const [k, v] of Object.entries(all)) portraits.set(k, v);
      },
    },
  };
}

// ---------------------------------------------------------------- choosing at boot

const HEALTH_TIMEOUT_MS = 2500;

/** True when the page was served by the Umbrel's server with storage switched on. */
export async function serverHasStorage(base = document.baseURI, fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
    const r = await fetchFn(new URL('api/health', base).href, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok && (await r.json())?.storage === 'server';
  } catch {
    return false;
  }
}

/** Persistence that starts in this browser and moves to the server once it answers. */
export interface ChosenPersistence extends Persistence {
  /** Resolves once the choice is made. Read nothing before this. */
  readonly ready: Promise<StorageKind>;
}

export function choosePersistence(
  detect: () => Promise<boolean> = () => serverHasStorage(),
  server: () => Persistence = () => serverPersistence(),
  browser: () => Persistence = browserPersistence,
): ChosenPersistence {
  let current = browser();
  const ready = detect().then((yes) => {
    if (yes) current = server();
    return current.kind;
  });
  const after = async <T>(fn: (p: Persistence) => Promise<T>) => {
    await ready;
    return fn(current);
  };
  return {
    get kind() {
      return current.kind;
    },
    ready,
    readAutosave: () => after((p) => p.readAutosave()),
    writeAutosave: (json) => current.writeAutosave(json),
    readSnapshots: () => after((p) => p.readSnapshots()),
    writeSnapshots: (list) => after((p) => p.writeSnapshots(list)),
    portraits: {
      getAll: () => after((p) => p.portraits.getAll()),
      put: (id, url) => after((p) => p.portraits.put(id, url)),
      delete: (id) => after((p) => p.portraits.delete(id)),
      replaceAll: (all) => after((p) => p.portraits.replaceAll(all)),
    },
  };
}

export const PERSISTENCE = new InjectionToken<ChosenPersistence>('Persistence', {
  providedIn: 'root',
  factory: () => choosePersistence(),
});

/** An in-memory persistence, already chosen: for specs. */
export function memoryChosen(): ChosenPersistence {
  const p = memoryPersistence();
  return Object.assign(p, { ready: Promise.resolve<StorageKind>('memory') });
}
