import { TestBed } from '@angular/core/testing';
import { GameStore } from '../data/game-store';
import { PERSISTENCE, memoryChosen } from '../data/persistence';
import { resourceById } from '../engine/game-state';
import { RULES, SEED } from '../engine/testing';
import { NewResourceForm } from './new-resource-form';

describe('NewResourceForm', () => {
  let store: GameStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NewResourceForm], providers: [{ provide: PERSISTENCE, useFactory: memoryChosen }] });
    store = TestBed.inject(GameStore);
    store.start(SEED, RULES, 5);
  });

  const mount = async () => {
    const f = TestBed.createComponent(NewResourceForm);
    await f.whenStable();
    return f;
  };
  const el = (f: { nativeElement: HTMLElement }) => f.nativeElement;
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const field = (f: { nativeElement: HTMLElement }, name: string) => el(f).querySelector<HTMLInputElement>(`[formcontrolname="${name}"]`)!;

  it('brings a new hero into play as one undoable action, and reports its id', async () => {
    const f = await mount();
    const created: string[] = [];
    f.componentInstance.created.subscribe((id) => created.push(id));
    type(field(f, 'name'), 'Captain Luke');
    type(field(f, 'faction'), 'Letheri Empire');
    type(field(f, 'power'), '6');
    el(f).querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await f.whenStable();

    expect(created).toEqual(['captain-luke']);
    expect(resourceById(store.state()!, 'captain-luke')).toMatchObject({ kind: 'hero', faction: 'Letheri Empire', power: 6 });
    expect(store.undoLabel()).toBe('Bring Captain Luke into play');
  });

  it('asks for group numbers only for a group', async () => {
    const f = await mount();
    expect(field(f, 'number')).toBeNull();
    const group = el(f).querySelector<HTMLInputElement>('input[type="radio"][value="group"]')!;
    group.click();
    await f.whenStable();
    expect(field(f, 'number')).not.toBeNull();
    expect(field(f, 'injuryResistance')).toBeNull();

    type(field(f, 'name'), 'Moranth Blacks');
    type(field(f, 'number'), '120');
    el(f).querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await f.whenStable();
    expect(resourceById(store.state()!, 'moranth-blacks')).toMatchObject({ kind: 'group', number: 120, maxNumber: 120 });
  });

  it('refuses a nameless ally and says why', async () => {
    const f = await mount();
    const before = store.state();
    type(field(f, 'name'), '   ');
    el(f).querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await f.whenStable();
    expect(store.state()).toBe(before);
    expect(el(f).textContent).toContain('Give them a name.');
  });
});
