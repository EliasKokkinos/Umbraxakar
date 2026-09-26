import { TestBed } from '@angular/core/testing';
import { PERSISTENCE, memoryChosen } from '../data/persistence';
import { eventsState, portal } from '../engine/testing';
import { RESOURCE_DRAG_TYPE } from '../shared/map-board';
import { EventDetail } from './event-detail';

describe('EventDetail', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EventDetail], providers: [{ provide: PERSISTENCE, useFactory: memoryChosen }] });
  });

  const mount = async (inputs: Record<string, unknown>) => {
    const f = TestBed.createComponent(EventDetail);
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    await f.whenStable();
    return f;
  };
  const el = (f: { nativeElement: HTMLElement }) => f.nativeElement;

  it('shows the breach as tiles, in its own ember', async () => {
    const f = await mount({ event: portal({ difficulty: 7, corruption: 4, impact: 8 }), region: 'Seven Cities' });
    expect(el(f).textContent).toContain('A breach of Chaos in Seven Cities');
    expect(el(f).querySelectorAll('.ring path.lit')).toHaveLength(4);
    expect(el(f).querySelector('.threat')!.classList).toContain('high');
    expect(el(f).querySelectorAll('.meter i.on')).toHaveLength(8);
    expect((el(f) as HTMLElement).style.getPropertyValue('--heat')).toBe('var(--ce-chaos-4)');
    expect(el(f).textContent).toContain('only one who can cleanse corruption will close it');
  });

  it('makes the chance the focus, coloured by how good it is', async () => {
    const f = await mount({ event: portal(), odds: { eventPower: 9, target: 6, chance: 0.75 } });
    const chance = el(f).querySelector('.chance')!;
    expect(chance.classList).toContain('good');
    expect(chance.textContent).toContain('75%');
    expect(chance.textContent).toContain('needs 6 or more');

    f.componentRef.setInput('odds', { eventPower: 3, target: 14, chance: 0.35 });
    await f.whenStable();
    expect(el(f).querySelector('.chance')!.classList).toContain('poor');
  });

  it('invites a drag when no one is there, and calls a card home', async () => {
    const f = await mount({ event: portal() });
    expect(el(f).textContent).toContain('No one stands here yet');

    const card = { id: 'karsa-orlong', name: 'Karsa Orlong', faction: 'Iron Company', power: { total: 8, parts: [] }, attached: [] };
    f.componentRef.setInput('cards', [card]);
    await f.whenStable();
    const recalled: string[] = [];
    f.componentInstance.recall.subscribe((id) => recalled.push(id));
    el(f).querySelector<HTMLButtonElement>('.home')!.click();
    expect(recalled).toEqual(['karsa-orlong']);
    expect(el(f).querySelector('.portrait')!.textContent!.trim()).toBe('KO');
  });

  describe('as a drop target', () => {
    /** jsdom has no DragEvent or DataTransfer: an ordinary event carrying a stand-in. */
    const drag = (type: string, id = 'karsa-orlong', relatedTarget: EventTarget | null = null) => {
      const ev = new Event(type, { bubbles: true, cancelable: true });
      const dataTransfer = { types: [RESOURCE_DRAG_TYPE], getData: () => id, dropEffect: 'none' };
      Object.defineProperties(ev, { dataTransfer: { value: dataTransfer }, relatedTarget: { value: relatedTarget } });
      return ev;
    };

    it('lights up and reports the hover while a card is held over it, and sends it on drop', async () => {
      const f = await mount({ event: portal({ id: 'p1' }) });
      const hovers: (string | null)[] = [];
      const dropped: string[] = [];
      f.componentInstance.hover.subscribe((h) => hovers.push(h));
      f.componentInstance.dropped.subscribe((id) => dropped.push(id));

      const over = drag('dragover');
      el(f).dispatchEvent(over);
      await f.whenStable();
      expect(over.defaultPrevented).toBe(true);
      expect(el(f).classList).toContain('dropping');
      expect(el(f).textContent).toContain('Release to send them');

      el(f).dispatchEvent(drag('drop'));
      await f.whenStable();
      expect(dropped).toEqual(['karsa-orlong']);
      expect(hovers).toEqual(['p1', null]);
      expect(el(f).classList).not.toContain('dropping');
    });

    it('leaving a child element is not leaving the panel', async () => {
      const f = await mount({ event: portal() });
      el(f).dispatchEvent(drag('dragover'));
      await f.whenStable();
      const inner = el(f).querySelector('.tiles')!;
      el(f).dispatchEvent(drag('dragleave', 'karsa-orlong', inner));
      await f.whenStable();
      expect(el(f).classList).toContain('dropping');
    });

    it('an awakened temple takes no cards', async () => {
      const temple = eventsState().temples.find((t) => t.active)!;
      const f = await mount({ event: temple });
      const over = drag('dragover');
      el(f).dispatchEvent(over);
      expect(over.defaultPrevented).toBe(false);
    });
  });
});
