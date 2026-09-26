import { TestBed } from '@angular/core/testing';
import { MAP, portal } from '../engine/testing';
import { MAX_ZOOM, MapBoard } from './map-board';

describe('MapBoard zoom', () => {
  const mount = async (zoomable = true) => {
    const f = TestBed.createComponent(MapBoard);
    f.componentRef.setInput('map', MAP);
    f.componentRef.setInput('portals', [portal({ id: 'p', position: { x: 0.5, y: 0.5 } })]);
    f.componentRef.setInput('temples', []);
    f.componentRef.setInput('zoomable', zoomable);
    const host = f.nativeElement as HTMLElement;
    // jsdom lays nothing out: give the board a size.
    host.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500, x: 0, y: 0, toJSON: () => ({}) });
    await f.whenStable();
    return { f, host, board: f.componentInstance };
  };
  /** jsdom has no WheelEvent deltas or PointerEvent: ordinary events carrying the fields. */
  const fire = (el: Element, type: string, fields: Record<string, unknown>) => {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(ev, fields);
    el.dispatchEvent(ev);
    return ev;
  };
  const stage = (host: HTMLElement) => host.querySelector<HTMLElement>('.stage')!;

  beforeEach(() => TestBed.configureTestingModule({ imports: [MapBoard] }));

  it('starts whole, and zooms in and out with the buttons, never past its limits', async () => {
    const { f, host, board } = await mount();
    expect(board.zoom()).toBe(1);
    const [zoomOut, whole, zoomIn] = host.querySelectorAll<HTMLButtonElement>('.zoom button');
    expect(zoomOut.disabled).toBe(true);
    expect(whole.disabled).toBe(true);
    expect(whole.textContent!.trim()).toBe('1×');

    zoomIn.click();
    await f.whenStable();
    expect(board.zoom()).toBe(1.5);
    // Zooming on the centre keeps the centre in place.
    expect(board.pan()).toEqual({ x: -0.25, y: -0.25 });
    expect(stage(host).style.transform).toBe('translate(-25%, -25%) scale(1.5)');
    expect(whole.textContent!.trim()).toBe('1.5×');
    expect(whole.classList).toContain('changed');

    for (let i = 0; i < 10; i++) board.zoomIn();
    expect(board.zoom()).toBe(MAX_ZOOM);
    await f.whenStable();
    whole.click();
    expect(board.zoom()).toBe(1);
    expect(board.pan()).toEqual({ x: 0, y: 0 });
  });

  it('zooms with the wheel around the pointer, and ignores it when not zoomable', async () => {
    const { board, host } = await mount();
    const ev = fire(host, 'wheel', { deltaY: -100, clientX: 0, clientY: 0, ctrlKey: false });
    expect(ev.defaultPrevented).toBe(true);
    expect(board.zoom()).toBeGreaterThan(1);
    // The top-left corner stays under the pointer.
    expect(board.pan()).toEqual({ x: 0, y: 0 });

    const still = await mount(false);
    fire(still.host, 'wheel', { deltaY: -100, clientX: 0, clientY: 0 });
    expect(still.board.zoom()).toBe(1);
    expect(still.host.querySelector('.zoom')).toBeNull();
  });

  it('pans by dragging, keeps the map on the board, and the release selects nothing', async () => {
    const { f, host, board } = await mount();
    board.zoomTo(2);
    const selected: string[] = [];
    board.select.subscribe((id) => selected.push(id));

    const marker = host.querySelector('g.portal')!;
    fire(marker, 'pointerdown', { pointerId: 1, button: 0, clientX: 500, clientY: 250 });
    fire(marker, 'pointermove', { pointerId: 1, clientX: 600, clientY: 300 });
    expect(board.pan()).toEqual({ x: -0.4, y: -0.4 });
    fire(marker, 'pointermove', { pointerId: 1, clientX: 5000, clientY: 5000 });
    expect(board.pan()).toEqual({ x: 0, y: 0 });
    fire(marker, 'pointerup', { pointerId: 1 });
    marker.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selected).toEqual([]);

    // A plain click, without a drag, still selects.
    fire(marker, 'pointerdown', { pointerId: 2, button: 0, clientX: 500, clientY: 250 });
    fire(marker, 'pointerup', { pointerId: 2 });
    marker.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await f.whenStable();
    expect(selected).toEqual(['p']);
  });

  it('sizes the icons from half to double, remembered per screen in this browser', async () => {
    localStorage.clear();
    const f = TestBed.createComponent(MapBoard);
    f.componentRef.setInput('map', MAP);
    f.componentRef.setInput('portals', [portal({ id: 'p', position: { x: 0.5, y: 0.5 } })]);
    f.componentRef.setInput('temples', []);
    f.componentRef.setInput('iconSizeKey', 'table');
    await f.whenStable();
    const host = f.nativeElement as HTMLElement;
    const board = f.componentInstance;
    const scale = () => host.querySelector('g.portal')!.getAttribute('transform')!.match(/scale\(([\d.]+)\)/)![1];
    const [smaller, pct, larger] = host.querySelectorAll<HTMLButtonElement>('[aria-label="Icon size"] button');
    expect(pct.textContent!.trim()).toBe('100%');
    // Without zoom, no zoom buttons.
    expect(host.querySelector('.zoom')).toBeNull();

    larger.click();
    larger.click();
    await f.whenStable();
    expect(pct.textContent!.trim()).toBe('120%');
    expect(scale()).toBe('1.2');
    expect(localStorage.getItem('chaos-engine.icon-size.table')).toBe('1.2');

    for (let i = 0; i < 20; i++) board.setIconSize(board.iconSize() - 0.1);
    await f.whenStable();
    expect(board.iconSize()).toBe(0.5);
    expect(smaller.disabled).toBe(true);
    pct.click();
    expect(board.iconSize()).toBe(1);

    // Another board under the same name picks the choice up; another name does not.
    board.setIconSize(1.5);
    const again = TestBed.createComponent(MapBoard);
    again.componentRef.setInput('map', MAP);
    again.componentRef.setInput('portals', []);
    again.componentRef.setInput('temples', []);
    again.componentRef.setInput('iconSizeKey', 'table');
    await again.whenStable();
    expect(again.componentInstance.iconSize()).toBe(1.5);
    again.componentRef.setInput('iconSizeKey', 'dm');
    await again.whenStable();
    expect(again.componentInstance.iconSize()).toBe(1);
  });

  it('lets markers grow more gently than the land', async () => {
    const { f, host, board } = await mount();
    board.zoomTo(4);
    await f.whenStable();
    expect(host.querySelector('g.portal')!.getAttribute('transform')).toContain('scale(0.5)');
  });
});
