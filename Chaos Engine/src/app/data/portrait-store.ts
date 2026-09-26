import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { CHANNEL_FACTORY } from './table-sync';

/** Where portraits are kept. IndexedDB in the browser; an in-memory stand-in in tests. */
export interface PortraitBackend {
  getAll(): Promise<Record<string, string>>;
  put(id: string, dataUrl: string): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

const DB_NAME = 'chaos-engine-portraits';
const STORE = 'portraits';
export const PORTRAIT_CHANNEL = 'chaos-engine-portraits';

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** IndexedDB: large enough for full-colour portraits, unlike localStorage's few megabytes. */
export function indexedDbBackend(): PortraitBackend {
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
    async clear() {
      await request((await store('readwrite')).clear());
    },
  };
}

export const PORTRAIT_BACKEND = new InjectionToken<PortraitBackend>('PortraitBackend', {
  providedIn: 'root',
  factory: indexedDbBackend,
});

/**
 * Portraits by resource id, kept apart from the game state so autosaves and turn snapshots stay
 * small. Both windows read the same store; a change in one tells the other to reload.
 */
@Injectable({ providedIn: 'root' })
export class PortraitStore {
  private readonly backend = inject(PORTRAIT_BACKEND);
  private readonly channel = inject(CHANNEL_FACTORY)(PORTRAIT_CHANNEL);
  private readonly _urls = signal<Record<string, string>>({});

  readonly urls = this._urls.asReadonly();
  /** Resolves once the first load has finished. */
  readonly ready: Promise<void>;

  constructor() {
    this.channel.onmessage = () => void this.reload();
    inject(DestroyRef).onDestroy(() => this.channel.close());
    this.ready = this.reload();
  }

  /** The uploaded portrait, else the seed's image path, else nothing. */
  urlFor(id: string, seedImage?: string): string | null {
    return this._urls()[id] ?? seedImage ?? null;
  }

  async set(id: string, dataUrl: string): Promise<void> {
    await this.backend.put(id, dataUrl);
    this._urls.update((u) => ({ ...u, [id]: dataUrl }));
    this.announce();
  }

  async remove(id: string): Promise<void> {
    await this.backend.delete(id);
    this._urls.update(({ [id]: _gone, ...rest }) => rest);
    this.announce();
  }

  /** Replaces every portrait, e.g. from a loaded save file. */
  async replaceAll(portraits: Record<string, string>): Promise<void> {
    await this.backend.clear();
    for (const [id, url] of Object.entries(portraits)) await this.backend.put(id, url);
    this._urls.set({ ...portraits });
    this.announce();
  }

  private async reload(): Promise<void> {
    try {
      this._urls.set(await this.backend.getAll());
    } catch {
      // No storage (a private window): cards fall back to their monograms.
    }
  }

  private announce(): void {
    this.channel.postMessage({ type: 'changed' });
  }
}
