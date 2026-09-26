import { TestBed } from '@angular/core/testing';
import { PERSISTENCE, memoryChosen } from '../data/persistence';
import { assign, attach } from '../engine/assignment';
import { GameState, Result, newGame } from '../engine/game-state';
import { RULES, SEED } from '../engine/testing';
import { resourceView } from '../engine/views';
import { HERO_DRAG_TYPE } from '../shared/map-board';
import { ResourceDetail } from './resource-detail';

const unwrap = (r: Result): GameState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const view = (s: GameState, id: string) => resourceView(s, s.resources.find((r) => r.id === id)!, RULES);
const heroesOf = (s: GameState, id: string) => s.resources.filter((r) => r.attachedTo === id).map((r) => view(s, r.id));

describe('ResourceDetail', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ResourceDetail], providers: [{ provide: PERSISTENCE, useFactory: memoryChosen }] });
  });

  const mount = async (inputs: Record<string, unknown>) => {
    const f = TestBed.createComponent(ResourceDetail);
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    await f.whenStable();
    return f;
  };
  const el = (f: { nativeElement: HTMLElement }) => f.nativeElement;
  const text = (f: { nativeElement: HTMLElement }) => el(f).textContent!.replace(/\s+/g, ' ');

  it('shows a group at home: power, morale in words, strength, and room for three heroes', async () => {
    const s = newGame(SEED, RULES, 1);
    const f = await mount({ resource: view(s, 'bridgeburners') });
    expect(text(f)).toContain('At the castle, ready to march');
    expect(el(f).querySelector('.power-tile .big')!.textContent!.trim()).toBe(String(view(s, 'bridgeburners').power.total));
    expect(text(f)).toContain('Ready to fight');
    expect(text(f)).toContain('Heroes with them 0 of 3');
    expect(el(f).querySelectorAll('.slot')).toHaveLength(3);
    expect(text(f)).toContain('Drag a hero here');
  });

  it('lists the heroes riding with a group, what each lends, and lets them part ways', async () => {
    let s = newGame(SEED, RULES, 1);
    s = unwrap(attach(s, 'karsa-orlong', 'bridgeburners'));
    s = unwrap(attach(s, 'trull-sengar', 'bridgeburners'));
    const f = await mount({ resource: view(s, 'bridgeburners'), heroes: heroesOf(s, 'bridgeburners') });

    const rows = el(f).querySelectorAll('.heroes li:not(.slot)');
    expect(rows).toHaveLength(2);
    expect([...rows].map((r) => r.querySelector('.lends')!.textContent!.trim())).toEqual(['+3', '+2']);
    expect(el(f).querySelector('.heroes-head .bonus')!.textContent).toContain('+5');
    expect(el(f).querySelectorAll('.slot')).toHaveLength(1);

    const parted: string[] = [];
    const looked: string[] = [];
    f.componentInstance.detach.subscribe((id) => parted.push(id));
    f.componentInstance.inspect.subscribe((id) => looked.push(id));
    rows[0].querySelector<HTMLButtonElement>('.part')!.click();
    rows[1].querySelector<HTMLButtonElement>('.who')!.click();
    expect(parted).toEqual(['karsa-orlong']);
    expect(looked).toEqual(['trull-sengar']);
  });

  it('says when the heroes lend more than a group can take', async () => {
    let s = newGame(SEED, RULES, 1);
    for (const h of ['karsa-orlong', 'silchas-ruin', 'uruk']) s = unwrap(attach(s, h, 'bridgeburners'));
    const f = await mount({ resource: view(s, 'bridgeburners'), heroes: heroesOf(s, 'bridgeburners') });
    expect(el(f).querySelector('.heroes-head .bonus')!.textContent).toContain('the most a group can take');
    expect(el(f).querySelectorAll('.slot')).toHaveLength(0);
  });

  it('in the field: no parting ways, and the group can be called home', async () => {
    let s = newGame(SEED, RULES, 1);
    s = unwrap(attach(s, 'karsa-orlong', 'bridgeburners'));
    const portal = s.events.portals[0];
    s = unwrap(assign(s, 'bridgeburners', portal.id, RULES));
    const f = await mount({ resource: view(s, 'bridgeburners'), heroes: heroesOf(s, 'bridgeburners') });
    expect(text(f)).toContain(`In the field at ${portal.name}`);
    expect(el(f).querySelector('.part')).toBeNull();
    expect(text(f)).toContain('Call them home to change who rides with them');

    const recalled: string[] = [];
    f.componentInstance.recall.subscribe((id) => recalled.push(id));
    el(f).querySelector<HTMLButtonElement>('.actions button')!.click();
    expect(recalled).toEqual(['bridgeburners']);
  });

  it('shows a hero with the group they ride with, and what they lend it', async () => {
    let s = newGame(SEED, RULES, 1);
    s = unwrap(attach(s, 'karsa-orlong', 'bridgeburners'));
    const f = await mount({ resource: view(s, 'karsa-orlong'), host: view(s, 'bridgeburners') });
    expect(text(f)).toContain('Rides with Bridgeburners at the castle');
    expect(el(f).querySelector('.power-tile')!.textContent).toContain('lends +3');
    expect(text(f)).toContain('Unhurt');
    expect(el(f).querySelector('.heroes')).toBeNull();

    const looked: string[] = [];
    f.componentInstance.inspect.subscribe((id) => looked.push(id));
    el(f).querySelector<HTMLButtonElement>('.actions .link')!.click();
    expect(looked).toEqual(['bridgeburners']);
  });

  it('tells a hero alone how to take the field, and names a refusal plainly', async () => {
    const s = newGame(SEED, RULES, 1);
    const f = await mount({ resource: view(s, 'uruk') });
    expect(text(f)).toContain('attach them to a group to take the field');

    const low = { ...s, resources: s.resources.map((r) => (r.id === 'uruk' ? { ...r, morale: 1 } : r)) };
    f.componentRef.setInput('resource', view(low, 'uruk'));
    await f.whenStable();
    expect(el(f).querySelector('.where')!.classList).toContain('held');
    expect(text(f)).toContain('Refuses to march');
    expect(text(f)).toContain('Broken');
  });

  it('takes a hero dropped on a group with room', async () => {
    const s = newGame(SEED, RULES, 1);
    const f = await mount({ resource: view(s, 'bridgeburners') });
    const got: { heroId: string; hostId: string }[] = [];
    f.componentInstance.attachHere.subscribe((a) => got.push(a));

    /** jsdom has no DragEvent or DataTransfer: an ordinary event carrying a stand-in. */
    const drag = (type: string) => {
      const ev = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(ev, { dataTransfer: { types: [HERO_DRAG_TYPE], getData: () => 'uruk', dropEffect: 'none' } });
      el(f).dispatchEvent(ev);
      return ev;
    };
    expect(drag('dragover').defaultPrevented).toBe(true);
    await f.whenStable();
    expect(el(f).classList).toContain('dropping');
    expect(text(f)).toContain('Release to join them');
    drag('drop');
    expect(got).toEqual([{ heroId: 'uruk', hostId: 'bridgeburners' }]);
  });
});
