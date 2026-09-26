import { TestBed } from '@angular/core/testing';
import { GameStore } from '../data/game-store';
import { PERSISTENCE, memoryChosen } from '../data/persistence';
import { influenceOf } from '../engine/commanders';
import { RULES, SEED } from '../engine/testing';
import { CommandPicker } from './command-picker';
import { SwayEditor } from './sway-editor';

describe('SwayEditor', () => {
  let store: GameStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SwayEditor, CommandPicker],
      providers: [{ provide: PERSISTENCE, useFactory: memoryChosen }],
    });
    store = TestBed.inject(GameStore);
    store.start(SEED, RULES, 5);
  });

  const mount = async (commanderId = 'imogen') => {
    const f = TestBed.createComponent(SwayEditor);
    f.componentRef.setInput('commanderId', commanderId);
    await f.whenStable();
    return f;
  };
  const el = (f: { nativeElement: HTMLElement }) => f.nativeElement;
  const sway = () => influenceOf(store.state()!, 'imogen', RULES).map((i) => [i.resourceId, i.morale, i.reason]);
  const set = (input: HTMLInputElement | HTMLSelectElement, value: string, event = 'input') => {
    input.value = value;
    input.dispatchEvent(new Event(event));
  };

  it('lists the commander’s sway, editable in place, each change undoable', async () => {
    const f = await mount();
    const rows = el(f).querySelectorAll('.rows li');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Cowl');

    set(rows[1].querySelector('select')!, '-2', 'change');
    await f.whenStable();
    expect(sway()[1]).toEqual(['kazz-davore', -2, expect.any(String)]);
    expect(store.undoLabel()).toBe("Set Imogen Ashborn's sway on Kazz D'avore");

    set(el(f).querySelectorAll<HTMLInputElement>('.rows .reason')[0], 'Hood’s priest owes her a debt.', 'change');
    await f.whenStable();
    expect(sway()[0]).toEqual(['cowl', 1, 'Hood’s priest owes her a debt.']);

    el(f).querySelector<HTMLButtonElement>('.rows .remove')!.click();
    await f.whenStable();
    expect(sway().map((s) => s[0])).toEqual(['kazz-davore']);
    store.undo();
    expect(sway().map((s) => s[0])).toEqual(['cowl', 'kazz-davore']);
  });

  it('adds a new sway once whom and why are given', async () => {
    const f = await mount();
    const add = el(f).querySelector<HTMLButtonElement>('.add button[type="submit"]')!;
    expect(add.disabled).toBe(true);
    const who = el(f).querySelector<HTMLSelectElement>('[formcontrolname="resourceId"]')!;
    // Those already swayed are not offered again.
    expect([...who.options].map((o) => o.value)).not.toContain('cowl');
    set(who, 'bridgeburners', 'change');
    set(el(f).querySelector<HTMLInputElement>('.add .reason')!, 'She marched with them from Goss.');
    await f.whenStable();
    expect(add.disabled).toBe(false);
    add.click();
    await f.whenStable();
    expect(sway().at(-1)).toEqual(['bridgeburners', 1, 'She marched with them from Goss.']);
    expect(who.value).toBe('');
  });

  it('restores the archive’s sway', async () => {
    const f = await mount();
    expect(el(f).querySelector('.foot .link')).toBeNull();
    store.removeSway('imogen', 'cowl');
    await f.whenStable();
    el(f).querySelector<HTMLButtonElement>('.foot .link')!.click();
    await f.whenStable();
    expect(sway().map((s) => s[0])).toEqual(['cowl', 'kazz-davore']);
  });

  it('opens from the command picker, and stays reachable for everyone after command is taken', async () => {
    const f = TestBed.createComponent(CommandPicker);
    await f.whenStable();
    const edit = [...el(f).querySelectorAll<HTMLButtonElement>('button')].filter((b) => b.textContent!.includes('Edit sway'));
    expect(edit).toHaveLength(RULES.commanders.length);
    edit[0].click();
    await f.whenStable();
    expect(el(f).querySelectorAll('ce-sway-editor')).toHaveLength(1);

    store.takeCommand('imogen');
    await f.whenStable();
    expect(el(f).querySelector('h2')!.textContent).toContain('Imogen Ashborn commands');
    expect(el(f).querySelector('details.others')!.querySelectorAll('.commander')).toHaveLength(RULES.commanders.length - 1);
    // The commander of the turn is warned that edits count from their next command.
    const own = el(f).querySelector<HTMLButtonElement>('.commander .quiet')!;
    own.click();
    await f.whenStable();
    expect(el(f).querySelector('ce-sway-editor')!.textContent).toContain('Changes here count from their next command');
  });
});
