import { Injectable, inject, signal } from '@angular/core';
import { Rules, rulesFromSeed } from '../engine/game-state';
import { inRect } from '../engine/geometry';
import { LandTest } from '../engine/land';
import { deserialize } from '../engine/save';
import { MapDef, Seed } from '../engine/seed-types';
import { GameStore } from './game-store';
import { PERSISTENCE } from './persistence';
import { PortraitStore } from './portrait-store';
import { TurnSnapshots } from './turn-snapshots';
import { LandService } from './land.service';
import { SeedService } from './seed.service';

export type SessionStatus = { state: 'loading' } | { state: 'ready' } | { state: 'failed'; message: string; details?: string[] };

/** Boots a session: seed data → land detection → rules → autosave or a new game. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly seeds = inject(SeedService);
  private readonly land = inject(LandService);
  private readonly store = inject(GameStore);
  private readonly portraits = inject(PortraitStore);
  private readonly persistence = inject(PERSISTENCE);
  private readonly snapshots = inject(TurnSnapshots);

  private readonly _status = signal<SessionStatus>({ state: 'loading' });
  readonly status = this._status.asReadonly();

  private seed: Seed | null = null;
  private rules: Rules | null = null;

  async boot(): Promise<void> {
    try {
      await this.start();
    } catch (e) {
      console.error(e);
      this.fail('The session could not start.', [e instanceof Error ? e.message : String(e)]);
    }
  }

  private async start(): Promise<void> {
    await this.seeds.load();
    const s = this.seeds.status();
    if (s.state === 'failed') return this.fail('The seed data could not be loaded.', [s.message]);
    if (s.state !== 'ready') return;
    if (s.errors.length) return this.fail('The seed data has problems. Fix these files in /data:', s.errors);

    const map = s.seed.map.maps.find((m) => m.id === s.seed.map.activeMapId)!;
    this.seed = s.seed;
    this.rules = rulesFromSeed(s.seed, { map, isLand: await this.landTest(map) });

    // Where the data lives (the Umbrel or this browser) is settled before anything is read.
    await this.persistence.ready;
    await this.snapshots.reload();
    const auto = await this.store.readAutosave();
    const saved = auto ? deserialize(auto) : null;
    if (saved?.ok) this.store.resume(saved.state.state, this.rules, 'Resumed from autosave');
    else this.store.start(this.seed, this.rules);
    this._status.set({ state: 'ready' });
  }

  /** Clears the table and seeds a new session. */
  newSession(): void {
    if (this.seed && this.rules) this.store.start(this.seed, this.rules);
  }

  loadSave(json: string): boolean {
    if (!this.rules || !this.store.importSave(json, this.rules)) return false;
    const file = deserialize(json);
    if (file.ok && file.state.portraits) void this.portraits.replaceAll(file.state.portraits);
    return true;
  }

  private async landTest(map: MapDef): Promise<LandTest> {
    try {
      return await this.land.landTestFor(map);
    } catch (e) {
      // Without the image, fall back to the named regions so portals still land on continents.
      console.warn('Map land detection unavailable; using regions instead.', e);
      return (p) => map.regions.some((r) => inRect(p, r));
    }
  }

  private fail(message: string, details?: string[]): void {
    this._status.set({ state: 'failed', message, details });
  }
}
