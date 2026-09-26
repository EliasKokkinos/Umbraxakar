import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { PERSISTENCE } from './persistence';
import { CHANNEL_FACTORY } from './table-sync';

export const PORTRAIT_CHANNEL = 'chaos-engine-portraits';

/**
 * Portraits by resource id, kept apart from the game state so autosaves and turn snapshots stay
 * small. Both windows read the same store; a change in one tells the other to reload.
 */
@Injectable({ providedIn: 'root' })
export class PortraitStore {
  private readonly backend = inject(PERSISTENCE).portraits;
  private readonly channel = inject(CHANNEL_FACTORY)(PORTRAIT_CHANNEL);
  private readonly _urls = signal<Record<string, string>>({});
  /** Counts local changes, so a slow load never overwrites a portrait added after it began. */
  private changes = 0;

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
    this.changes++;
    await this.backend.put(id, dataUrl);
    this._urls.update((u) => ({ ...u, [id]: dataUrl }));
    this.announce();
  }

  async remove(id: string): Promise<void> {
    this.changes++;
    await this.backend.delete(id);
    this._urls.update(({ [id]: _gone, ...rest }) => rest);
    this.announce();
  }

  /** Replaces every portrait, e.g. from a loaded save file. */
  async replaceAll(portraits: Record<string, string>): Promise<void> {
    this.changes++;
    await this.backend.replaceAll(portraits);
    this._urls.set({ ...portraits });
    this.announce();
  }

  private async reload(): Promise<void> {
    const before = this.changes;
    try {
      const all = await this.backend.getAll();
      if (before === this.changes) this._urls.set(all);
    } catch {
      // No storage (a private window): cards fall back to their monograms.
    }
  }

  private announce(): void {
    this.channel.postMessage({ type: 'changed' });
  }
}
