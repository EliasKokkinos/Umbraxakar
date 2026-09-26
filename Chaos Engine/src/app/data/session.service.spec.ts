import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SEED_FILES } from '../engine/seed-types';
import { SEED } from '../engine/testing';
import { serialize } from '../engine/save';
import { AUTOSAVE_KEY, GameStore } from './game-store';
import { LandService } from './land.service';
import { PERSISTENCE, choosePersistence } from './persistence';
import { SessionService } from './session.service';

/** Serves the real seed files, optionally with one of them altered. */
function flushSeed(http: HttpTestingController, alter: Partial<Record<keyof typeof SEED_FILES, unknown>> = {}): void {
  for (const [key, file] of Object.entries(SEED_FILES)) {
    const body = (alter as Record<string, unknown>)[key] ?? (SEED as unknown as Record<string, unknown>)[key];
    http.expectOne(`data/${file}`).flush(body as object);
  }
}

const settleBoot = () => new Promise((r) => setTimeout(r, 0));

describe('SessionService', () => {
  let session: SessionService;
  let store: GameStore;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // No canvas in tests: treat the named regions as land.
        { provide: LandService, useValue: { landTestFor: () => Promise.reject(new Error('no canvas')) } },
        { provide: PERSISTENCE, useFactory: () => choosePersistence(async () => false) },
      ],
    });
    session = TestBed.inject(SessionService);
    store = TestBed.inject(GameStore);
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('boots a new session from the seed, falling back to regions for land', async () => {
    const booting = session.boot();
    await settleBoot();
    flushSeed(http);
    await booting;
    expect(session.status()).toEqual({ state: 'ready' });
    expect(store.lastAction()).toBe('New session');
    expect(store.state()!.events.portals.length).toBeGreaterThanOrEqual(13); // twelve groups + 1d6
  });

  it('resumes from the autosave when there is one', async () => {
    const booting = session.boot();
    await settleBoot();
    flushSeed(http);
    await booting;
    const saved = store.state()!;
    // Let the first session's own autosave land first, then plant the one to resume.
    TestBed.tick();
    localStorage.setItem(AUTOSAVE_KEY, serialize({ ...saved, commanderId: 'imogen' }, 'Autosave'));

    const again = TestBed.inject(SessionService);
    const reboot = again.boot();
    await settleBoot();
    flushSeed(http);
    await reboot;
    expect(store.lastAction()).toBe('Resumed from autosave');
    expect(store.state()!.commanderId).toBe('imogen');
  });

  it('refuses to start on invalid seed data, listing the problems', async () => {
    const broken = structuredClone(SEED.resources);
    broken.heroes[0].power = 12;
    const booting = session.boot();
    await settleBoot();
    flushSeed(http, { resources: broken });
    await booting;
    const s = session.status();
    expect(s.state).toBe('failed');
    expect(s.state === 'failed' && s.details).toContain('silchas-ruin: power 12 out of 1-10');
  });
});
