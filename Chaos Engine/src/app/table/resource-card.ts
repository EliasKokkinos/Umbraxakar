import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ResourceView } from '../engine/views';
import { RESOURCE_DRAG_TYPE } from '../shared/map-board';
import { MoraleMarks } from '../shared/morale-marks';

/** Banner colours with meaning in the story; any other faction gets a stable hashed hue. */
const FACTION_HUES: Record<string, number> = {
  Bluerose: 212, // steel blue
  Avowed: 356, // the Crimson Guard
  'Malazan Empire': 278, // imperial purple
  'Iron Company': 32, // forge bronze
  'Letheri Empire': 46, // debt-gold
  Umbraxakar: 176, // deep teal
  Githyanki: 88, // olive
  'Kurald Galain': 262, // Mother Dark's dusk
  Eleint: 10, // dragon red
};

/** A stable, quiet hue per faction, so cards of one banner read as kin. */
export function factionHue(faction: string): number {
  if (faction in FACTION_HUES) return FACTION_HUES[faction];
  let h = 0;
  for (const ch of faction) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/** Initials for the portrait: the first letters of the first two meaningful words. */
export function monogram(name: string): string {
  return name
    .replace(/[^A-Za-z' ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !['The', 'of', 'Of'].includes(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
}

/**
 * A resource on the table: portrait and standing, attached heroes below. Groups also show
 * their strength as a bar. Drag it to an event to send it; drop a hero on a card to attach them.
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
  /** The card's id when picked up, null when put down. */
  readonly held = output<string | null>();

  protected readonly dropping = signal(false);
  protected readonly dragging = signal(false);

  protected readonly monogram = computed(() => monogram(this.resource().name));
  protected readonly hue = computed(() => factionHue(this.resource().faction));
  /** Anything with a status (refusing, training, healing, grievously hurt) stays put. */
  protected readonly draggable = computed(() => !this.resource().status);

  /** For groups: fighting strength, injured and dead, as shares of full strength. */
  protected readonly strength = computed(() => {
    const r = this.resource();
    if (r.kind !== 'group') return null;
    const max = Math.max(1, r.maxNumber!);
    const fighting = r.number! - r.injured!;
    return {
      fighting,
      injured: r.injured!,
      max: r.maxNumber!,
      fightingPct: (fighting / max) * 100,
      injuredPct: (r.injured! / max) * 100,
    };
  });

  protected readonly kindLabel = computed(() => {
    const r = this.resource();
    return r.kind === 'avatar' ? 'Avatar' : r.kind === 'hero' ? r.faction : null;
  });

  protected onDragStart(ev: DragEvent): void {
    ev.dataTransfer?.setData(RESOURCE_DRAG_TYPE, this.resource().id);
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
    this.dragging.set(true);
    this.held.emit(this.resource().id);
  }

  protected onDragEnd(): void {
    this.dragging.set(false);
    this.held.emit(null);
  }

  /** Heroes may be dropped onto a card to join it. */
  protected onDragOver(ev: DragEvent): void {
    if (this.dragging() || !ev.dataTransfer?.types.includes(RESOURCE_DRAG_TYPE)) return;
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
