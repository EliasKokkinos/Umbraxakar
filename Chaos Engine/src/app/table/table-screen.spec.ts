import { TestBed } from '@angular/core/testing';
import { PERSISTENCE, memoryChosen } from '../data/persistence';
import { signal } from '@angular/core';
import { chooseCommander } from '../engine/commanders';
import { assign } from '../engine/assignment';
import { GameState, Result, newGame } from '../engine/game-state';
import { NO_REVEAL, TableView, tableView } from '../engine/table-view';
import { resolveAll } from '../engine/turn';
import { RULES, SEED } from '../engine/testing';
import { TableClient } from '../data/table-sync';
import { TableScreen } from './table-screen';
import { TableSound } from './table-sound';

const unwrap = (r: Result): GameState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

describe('TableScreen', () => {
  const view = signal<TableView | null>(null);
  const sound = { enabled: signal(false), toggle: vi.fn(), tick: vi.fn(), victory: vi.fn(), defeat: vi.fn(), legendary: vi.fn(), command: vi.fn() };

  beforeEach(() => {
    view.set(null);
    Object.values(sound).forEach((v) => typeof v === 'function' && 'mockClear' in v && v.mockClear());
    TestBed.configureTestingModule({
      providers: [
        { provide: TableClient, useValue: { view, error: signal(null), send: vi.fn(), clearError: vi.fn() } },
        { provide: TableSound, useValue: sound },
        { provide: PERSISTENCE, useFactory: memoryChosen },
      ],
    });
  });

  const mount = () => {
    const f = TestBed.createComponent(TableScreen);
    f.detectChanges();
    return f;
  };
  const el = (f: { nativeElement: HTMLElement }) => f.nativeElement;

  it('waits for the DM until a view arrives', () => {
    const f = mount();
    expect(el(f).textContent).toContain("Waiting for the DM's laptop");
  });

  it('scales the whole page up for the TV, and restores it after', () => {
    const f = mount();
    expect(document.documentElement.style.fontSize).toBe('20px');
    f.destroy();
    expect(document.documentElement.style.fontSize).toBe('');
  });

  it('puts each newly revealed battle on the stage once', async () => {
    let s = unwrap(chooseCommander(newGame(SEED, RULES, 8), 'col', RULES));
    const [a, b] = s.events.portals;
    s = unwrap(assign(s, 'bridgeburners', a.id, RULES));
    s = unwrap(assign(s, 'malazan-legion-1', b.id, RULES));
    const pending = resolveAll(s, RULES);
    const f = mount();

    view.set(tableView(s, RULES, SEED.commanders, { pending, revealed: [], showReport: false }));
    await f.whenStable();
    expect(el(f).querySelector('ce-reveal-stage')).toBeNull();

    view.set(tableView(s, RULES, SEED.commanders, { pending, revealed: [a.id], showReport: false }));
    await f.whenStable();
    expect(el(f).querySelector('ce-reveal-stage')?.textContent).toContain(a.name);
    // While it is on the stage, the side list must not give the result away.
    expect(el(f).querySelector('.reckoning .battle')).toBeNull();

    // A second reveal replaces the first on the stage; the first never returns.
    view.set(tableView(s, RULES, SEED.commanders, { pending, revealed: [a.id, b.id], showReport: false }));
    await f.whenStable();
    expect(el(f).querySelector('ce-reveal-stage')?.textContent).toContain(b.name);
  });

  it('shows the odds while a card is held over an event', async () => {
    const s = newGame(SEED, RULES, 8);
    const f = mount();
    view.set(tableView(s, RULES, SEED.commanders, NO_REVEAL));
    await f.whenStable();
    const target = s.events.portals[0];
    const expected = view()!.odds.send[target.id]['bridgeburners'];

    const screen = f.componentInstance as unknown as { onHeld(id: string | null): void; hoverEventId: { set(v: string | null): void } };
    screen.onHeld('bridgeburners');
    screen.hoverEventId.set(target.id);
    await f.whenStable();
    const bar = el(f).querySelector('.odds-bar')!;
    expect(bar.textContent).toContain(`Bridgeburners at ${target.name}`);
    expect(expected.ok && bar.textContent).toContain(`${Math.round(expected.ok ? expected.chance * 100 : 0)}%`);

    screen.onHeld(null);
    await f.whenStable();
    expect(el(f).querySelector('.odds-bar')).toBeNull();
  });

  it('announces a commander taking command, but not on first load', async () => {
    const base = newGame(SEED, RULES, 8);
    const f = mount();
    view.set(tableView(unwrap(chooseCommander(base, 'imogen', RULES)), RULES, SEED.commanders, NO_REVEAL));
    await f.whenStable();
    expect(el(f).querySelector('.command-banner')).toBeNull();

    view.set(tableView(unwrap(chooseCommander({ ...base, events: { ...base.events, turn: 2 } }, 'col', RULES)), RULES, SEED.commanders, NO_REVEAL));
    await f.whenStable();
    expect(el(f).querySelector('.command-banner')?.textContent).toContain('Col (911) takes command');
    expect(sound.command).toHaveBeenCalledTimes(1);
  });
});
