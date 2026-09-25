import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, forkJoin } from 'rxjs';
import { SEED_FILES, Seed } from '../engine/seed-types';
import { validateSeed } from '../engine/seed-validation';

export type SeedStatus =
  | { state: 'loading' }
  | { state: 'ready'; seed: Seed; errors: string[] }
  | { state: 'failed'; message: string };

/** Loads the /data JSON files served as assets. */
@Injectable({ providedIn: 'root' })
export class SeedService {
  private readonly http = inject(HttpClient);
  private readonly _status = signal<SeedStatus>({ state: 'loading' });

  readonly status = this._status.asReadonly();
  readonly seed = computed(() => {
    const s = this._status();
    return s.state === 'ready' ? s.seed : null;
  });

  async load(): Promise<void> {
    this._status.set({ state: 'loading' });
    try {
      const requests = Object.fromEntries(
        Object.entries(SEED_FILES).map(([key, file]) => [key, this.http.get(`data/${file}`)]),
      );
      const seed = (await firstValueFrom(forkJoin(requests))) as unknown as Seed;
      this._status.set({ state: 'ready', seed, errors: validateSeed(seed) });
    } catch (e) {
      this._status.set({ state: 'failed', message: e instanceof Error ? e.message : String(e) });
    }
  }
}
