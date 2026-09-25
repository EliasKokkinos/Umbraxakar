import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ResourceView } from '../engine/views';
import { RESOURCE_DRAG_TYPE } from '../shared/map-board';
import { MoraleMarks } from '../shared/morale-marks';

/** A stable, quiet hue per faction, so cards of one banner read as kin. */
function factionHue(faction: string): number {
  let h = 0;
  for (const ch of faction) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/**
 * A resource on the table: portrait on the left, standing on the right, attached heroes below.
 * Drag it to an event to send it; drop a hero on another card to attach them.
 */
@Component({
  selector: 'ce-resource-card',
  imports: [MoraleMarks],
  templateUrl: './resource-card.html',
  styleUrl: './resource-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourceCard {
  readonly resource = input.required<ResourceView>();
  readonly selected = input(false);
  readonly inspect = output<string>();
  readonly attachHere = output<{ heroId: string; hostId: string }>();

  protected readonly dropping = signal(false);

  protected readonly monogram = computed(() =>
    this.resource()
      .name.replace(/[^A-Za-z' ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w && !['The', 'of', 'Of'].includes(w))
      .slice(0, 2)
      .map((w) => w[0])
      .join(''),
  );
  protected readonly hue = computed(() => factionHue(this.resource().faction));
  /** Anything with a status (refusing, training, healing, grievously hurt) stays put. */
  protected readonly draggable = computed(() => !this.resource().status);
  protected readonly strength = computed(() => {
    const r = this.resource();
    return r.kind === 'group' ? `${r.number! - r.injured!} of ${r.maxNumber}${r.injured ? `, ${r.injured} injured` : ''}` : r.kind === 'avatar' ? 'Avatar' : 'Hero';
  });

  protected onDragStart(ev: DragEvent): void {
    ev.dataTransfer?.setData(RESOURCE_DRAG_TYPE, this.resource().id);
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
  }

  /** Heroes may be dropped onto a card to join it. */
  protected onDragOver(ev: DragEvent): void {
    if (!ev.dataTransfer?.types.includes(RESOURCE_DRAG_TYPE)) return;
    ev.preventDefault();
    this.dropping.set(true);
  }

  protected onDrop(ev: DragEvent): void {
    this.dropping.set(false);
    const heroId = ev.dataTransfer?.getData(RESOURCE_DRAG_TYPE);
    if (!heroId || heroId === this.resource().id) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.attachHere.emit({ heroId, hostId: this.resource().id });
  }
}
