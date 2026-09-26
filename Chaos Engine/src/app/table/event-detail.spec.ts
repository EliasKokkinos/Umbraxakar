import { TestBed } from '@angular/core/testing';
import { PERSISTENCE, memoryChosen } from '../data/persistence';
import { portal } from '../engine/testing';
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
});
