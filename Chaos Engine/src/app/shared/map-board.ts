import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { PortalState, TempleState } from '../engine/event-state';
import { MapDef, Point } from '../engine/seed-types';

const VIEW_W = 1000;

/** Drag-and-drop payload type for a resource card. */
export const RESOURCE_DRAG_TYPE = 'application/x-chaos-resource';
/** A hero being dragged: it can only join a group, never an event. */
export const HERO_DRAG_TYPE = 'application/x-chaos-hero';
const NOTCHES = 5;
const R = 9; // marker radius in view units

/** How far the map can be zoomed in, and how much one button press changes it. */
export const MAX_ZOOM = 5;
const ZOOM_STEP = 1.5;
/** Pointer travel, in pixels, before a press on the map becomes a pan rather than a click. */
const PAN_THRESHOLD = 5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The event icons can be shrunk to half or grown to double, a tenth at a time. */
export const ICON_SIZE_RANGE = [0.5, 2] as const;
const ICON_SIZE_STEP = 0.1;
const ICON_SIZE_KEY = 'chaos-engine.icon-size.';

/**
 * A temple in silhouette (pediment, four columns, two steps), drawn in a unit square
 * about the origin and scaled to fit inside a marker of radius `r`.
 */
export function templeGlyph(r: number): string {
  const k = r * 0.72;
  const p = (x: number, y: number) => `${+(x * k).toFixed(2)} ${+(y * k).toFixed(2)}`;
  const box = (x0: number, y0: number, x1: number, y1: number) => `M ${p(x0, y0)} L ${p(x1, y0)} L ${p(x1, y1)} L ${p(x0, y1)} Z`;
  const columns = [-0.78, -0.33, 0.12, 0.57].map((x) => box(x, -0.18, x + 0.21, 0.58));
  return [
    `M ${p(-1.05, -0.4)} L ${p(0, -1)} L ${p(1.05, -0.4)} Z`, // pediment
    box(-0.95, -0.34, 0.95, -0.2), // architrave
    ...columns,
    box(-0.98, 0.62, 0.98, 0.78), // stylobate
    box(-1.12, 0.82, 1.12, 0.98), // lower step
  ].join(' ');
}

/** One arc of the corruption ring, as an SVG path around (0, 0). */
function notch(i: number, radius: number): string {
  const gap = 0.14;
  const a0 = (i / NOTCHES) * 2 * Math.PI - Math.PI / 2 + gap;
  const a1 = ((i + 1) / NOTCHES) * 2 * Math.PI - Math.PI / 2 - gap;
  const p = (a: number) => `${(Math.cos(a) * radius).toFixed(2)} ${(Math.sin(a) * radius).toFixed(2)}`;
  return `M ${p(a0)} A ${radius} ${radius} 0 0 1 ${p(a1)}`;
}

/** The five arcs of a portal's corruption ring; the TV's event panel draws the same ring. */
export const NOTCH_PATHS = Array.from({ length: NOTCHES }, (_, i) => notch(i, R + 3.5));

/**
 * The map of Edar with its events. Shared by the DM and table screens; the DM view
 * also shows hidden events, drawn dashed.
 */
@Component({
  selector: 'ce-map-board',
  templateUrl: './map-board.html',
  styleUrl: './map-board.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.aspect-ratio]': 'map().width + " / " + map().height',
    '[class.zoomed]': 'zoom() > 1',
    '[class.panning]': 'panning()',
    '(wheel)': 'onWheel($event)',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'onPointerUp($event)',
  },
})
export class MapBoard {
  readonly map = input.required<MapDef>();
  readonly portals = input.required<PortalState[]>();
  readonly temples = input.required<TempleState[]>();
  readonly auraRadius = input(0);
  readonly selectedId = input<string | null>(null);
  readonly dmView = input(false);
  /** When true, a click on the map reports a position instead of selecting. */
  readonly placing = input(false);

  /** Marker size multiplier; the TV draws them larger to read across the room. */
  readonly markerScale = input(1);

  /** Accept resource cards dropped onto events (the table screen). */
  readonly droppable = input(false);

  /** Let the map be zoomed (wheel, pinch, buttons) and panned (drag). */
  readonly zoomable = input(false);

  /**
   * Shows the icon-size control and remembers the choice under this name, in this browser.
   * A display preference only: it is not part of the game, its saves or its undo.
   */
  readonly iconSizeKey = input<string | null>(null);

  readonly select = output<string>();
  readonly place = output<Point>();
  readonly dropped = output<{ eventId: string; resourceId: string }>();
  /** The event a dragged card is over, or null when it leaves. */
  readonly dragOver = output<string | null>();

  protected readonly dropTarget = signal<string | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** 1 shows the whole map. The pan is the map's offset, as a share of the board (1 - zoom to 0). */
  readonly zoom = signal(1);
  /** The DM's icon size, on top of `markerScale`. */
  readonly iconSize = signal(1);
  protected readonly iconSizeRange = ICON_SIZE_RANGE;
  protected readonly iconPct = computed(() => Math.round(this.iconSize() * 100));
  /** 1× is the whole map; closer views read to one decimal. */
  protected readonly zoomLabel = computed(() => `${+this.zoom().toFixed(1)}×`);
  readonly pan = signal({ x: 0, y: 0 });
  protected readonly panning = signal(false);
  protected readonly maxZoom = MAX_ZOOM;
  protected readonly stageTransform = computed(() => {
    const { x, y } = this.pan();
    return `translate(${x * 100}%, ${y * 100}%) scale(${this.zoom()})`;
  });

  private press: { id: number; x: number; y: number; pan: { x: number; y: number } } | null = null;
  private suppressClick = false;

  constructor() {
    // The click that ends a pan selects nothing: stop it before any marker sees it.
    this.host.addEventListener('click', (ev) => this.swallowPanClick(ev), { capture: true });
    // The remembered icon size for this screen.
    effect(() => {
      const key = this.iconSizeKey();
      if (!key) return;
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(ICON_SIZE_KEY + key);
      } catch {
        // Storage can be blocked; the default size will do.
      }
      const n = Number(stored);
      this.iconSize.set(stored !== null && Number.isFinite(n) ? clamp(n, ICON_SIZE_RANGE[0], ICON_SIZE_RANGE[1]) : 1);
    });
    // A new map starts whole.
    effect(() => {
      this.map();
      this.resetZoom();
    });
  }

  protected readonly viewH = computed(() => (VIEW_W * this.map().height) / this.map().width);
  protected readonly viewBox = computed(() => `0 0 ${VIEW_W} ${this.viewH()}`);
  protected readonly notches = NOTCH_PATHS;
  protected readonly r = R;
  protected readonly templePath = templeGlyph(R);

  protected readonly visiblePortals = computed(() =>
    this.portals().filter((p) => p.status === 'open' && (this.dmView() || !p.hidden)),
  );
  protected readonly visibleTemples = computed(() => this.temples().filter((t) => this.dmView() || !t.hidden));

  protected x(p: Point): number {
    return p.x * VIEW_W;
  }

  protected y(p: Point): number {
    return p.y * this.viewH();
  }

  /** Markers grow more gently than the land as the map zooms, so a close view is not all markers. */
  protected markerAt(p: Point): string {
    return `translate(${this.x(p)} ${this.y(p)}) scale(${(this.markerScale() * this.iconSize()) / Math.sqrt(this.zoom())})`;
  }

  // ---------------------------------------------------------------- icon size

  setIconSize(size: number): void {
    const next = clamp(Math.round(size * 10) / 10, ICON_SIZE_RANGE[0], ICON_SIZE_RANGE[1]);
    this.iconSize.set(next);
    const key = this.iconSizeKey();
    if (!key) return;
    try {
      localStorage.setItem(ICON_SIZE_KEY + key, String(next));
    } catch {
      // Not remembered, but still applied.
    }
  }

  protected smallerIcons(): void {
    this.setIconSize(this.iconSize() - ICON_SIZE_STEP);
  }

  protected largerIcons(): void {
    this.setIconSize(this.iconSize() + ICON_SIZE_STEP);
  }

  // ---------------------------------------------------------------- zoom and pan

  /** Zooms to `next`, keeping the map point under `at` (a share of the board) where it is. */
  zoomTo(next: number, at = { x: 0.5, y: 0.5 }): void {
    const z = this.zoom();
    const z2 = clamp(next, 1, MAX_ZOOM);
    const { x, y } = this.pan();
    this.zoom.set(z2);
    this.setPan({ x: at.x - ((at.x - x) / z) * z2, y: at.y - ((at.y - y) / z) * z2 });
  }

  zoomIn(): void {
    this.zoomTo(this.zoom() * ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoomTo(this.zoom() / ZOOM_STEP);
  }

  resetZoom(): void {
    this.zoom.set(1);
    this.pan.set({ x: 0, y: 0 });
  }

  /** The map always covers the board: no dragging it off into the void. */
  private setPan(p: { x: number; y: number }): void {
    const lo = 1 - this.zoom();
    this.pan.set({ x: clamp(p.x, lo, 0), y: clamp(p.y, lo, 0) });
  }

  private boardPoint(ev: { clientX: number; clientY: number }): { x: number; y: number } {
    const box = this.host.getBoundingClientRect();
    return { x: (ev.clientX - box.left) / (box.width || 1), y: (ev.clientY - box.top) / (box.height || 1) };
  }

  protected onWheel(ev: WheelEvent): void {
    if (!this.zoomable()) return;
    ev.preventDefault();
    // A trackpad pinch arrives as a wheel with ctrlKey and small deltas; a mouse notch as a large one.
    const factor = Math.exp(-clamp(ev.deltaY, -100, 100) / (ev.ctrlKey ? 60 : 250));
    this.zoomTo(this.zoom() * factor, this.boardPoint(ev));
  }

  protected onPointerDown(ev: PointerEvent): void {
    if (!this.zoomable() || this.zoom() === 1 || ev.button !== 0) return;
    if ((ev.target as Element).closest?.('.tools')) return;
    this.press = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, pan: this.pan() };
  }

  protected onPointerMove(ev: PointerEvent): void {
    const p = this.press;
    if (!p || p.id !== ev.pointerId) return;
    const dx = ev.clientX - p.x;
    const dy = ev.clientY - p.y;
    if (!this.panning()) {
      if (Math.hypot(dx, dy) < PAN_THRESHOLD) return;
      this.panning.set(true);
      this.host.setPointerCapture?.(ev.pointerId);
    }
    const box = this.host.getBoundingClientRect();
    this.setPan({ x: p.pan.x + dx / (box.width || 1), y: p.pan.y + dy / (box.height || 1) });
  }

  protected onPointerUp(ev: PointerEvent): void {
    if (!this.press || this.press.id !== ev.pointerId) return;
    this.press = null;
    if (this.panning()) {
      this.panning.set(false);
      this.suppressClick = true;
      this.host.releasePointerCapture?.(ev.pointerId);
    }
  }

  private swallowPanClick(ev: MouseEvent): void {
    if (!this.suppressClick) return;
    this.suppressClick = false;
    ev.stopPropagation();
    ev.preventDefault();
  }

  protected auraR(): number {
    return this.auraRadius() * VIEW_W;
  }

  protected onBoardClick(ev: MouseEvent): void {
    if (!this.placing()) return;
    const box = (ev.currentTarget as SVGSVGElement).getBoundingClientRect();
    this.place.emit({ x: (ev.clientX - box.left) / box.width, y: (ev.clientY - box.top) / box.height });
  }

  protected onMarker(ev: Event, id: string): void {
    if (this.placing()) return;
    ev.stopPropagation();
    this.select.emit(id);
  }

  protected onDragOver(ev: DragEvent, id: string): void {
    if (!this.droppable() || !ev.dataTransfer?.types.includes(RESOURCE_DRAG_TYPE)) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    if (this.dropTarget() !== id) {
      this.dropTarget.set(id);
      this.dragOver.emit(id);
    }
  }

  protected onDragLeave(id: string): void {
    if (this.dropTarget() === id) {
      this.dropTarget.set(null);
      this.dragOver.emit(null);
    }
  }

  protected onDrop(ev: DragEvent, eventId: string): void {
    const resourceId = ev.dataTransfer?.getData(RESOURCE_DRAG_TYPE);
    this.dropTarget.set(null);
    this.dragOver.emit(null);
    if (!this.droppable() || !resourceId) return;
    ev.preventDefault();
    this.dropped.emit({ eventId, resourceId });
  }

  /** The ember colour for a portal's corruption, 1 (amber) to 5 (red). */
  protected heat(corruption: number): string {
    return `var(--ce-chaos-${Math.min(5, Math.max(1, corruption))})`;
  }

  protected title(p: PortalState): string {
    return `${p.name}: difficulty ${p.difficulty}, corruption ${p.corruption}, impact ${p.impact}`;
  }
}
