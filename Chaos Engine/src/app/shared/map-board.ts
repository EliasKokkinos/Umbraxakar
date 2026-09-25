import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { PortalState, TempleState } from '../engine/event-state';
import { MapDef, Point } from '../engine/seed-types';

const VIEW_W = 1000;

/** Drag-and-drop payload type for a resource card. */
export const RESOURCE_DRAG_TYPE = 'application/x-chaos-resource';
const NOTCHES = 5;
const R = 9; // marker radius in view units

/** One arc of the corruption ring, as an SVG path around (0, 0). */
function notch(i: number, radius: number): string {
  const gap = 0.14;
  const a0 = (i / NOTCHES) * 2 * Math.PI - Math.PI / 2 + gap;
  const a1 = ((i + 1) / NOTCHES) * 2 * Math.PI - Math.PI / 2 - gap;
  const p = (a: number) => `${(Math.cos(a) * radius).toFixed(2)} ${(Math.sin(a) * radius).toFixed(2)}`;
  return `M ${p(a0)} A ${radius} ${radius} 0 0 1 ${p(a1)}`;
}

const NOTCH_PATHS = Array.from({ length: NOTCHES }, (_, i) => notch(i, R + 3.5));

/**
 * The map of Edar with its events. Shared by the DM and table screens; the DM view
 * also shows hidden events, drawn dashed.
 */
@Component({
  selector: 'ce-map-board',
  templateUrl: './map-board.html',
  styleUrl: './map-board.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.aspect-ratio]': 'map().width + " / " + map().height' },
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

  /** Accept resource cards dropped onto events (the table screen). */
  readonly droppable = input(false);

  readonly select = output<string>();
  readonly place = output<Point>();
  readonly dropped = output<{ eventId: string; resourceId: string }>();

  protected readonly dropTarget = signal<string | null>(null);

  protected readonly viewH = computed(() => (VIEW_W * this.map().height) / this.map().width);
  protected readonly viewBox = computed(() => `0 0 ${VIEW_W} ${this.viewH()}`);
  protected readonly notches = NOTCH_PATHS;
  protected readonly r = R;

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
    this.dropTarget.set(id);
  }

  protected onDragLeave(id: string): void {
    if (this.dropTarget() === id) this.dropTarget.set(null);
  }

  protected onDrop(ev: DragEvent, eventId: string): void {
    const resourceId = ev.dataTransfer?.getData(RESOURCE_DRAG_TYPE);
    this.dropTarget.set(null);
    if (!this.droppable() || !resourceId) return;
    ev.preventDefault();
    this.dropped.emit({ eventId, resourceId });
  }

  protected title(p: PortalState): string {
    return `${p.name}: difficulty ${p.difficulty}, corruption ${p.corruption}, impact ${p.impact}`;
  }
}
