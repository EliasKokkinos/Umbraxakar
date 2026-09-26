import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { PortraitStore } from '../data/portrait-store';
import { MAX_ATTACHED } from '../engine/assignment';
import { ResourceView } from '../engine/views';
import { signed } from '../shared/format';
import { HERO_DRAG_TYPE } from '../shared/map-board';
import { MoraleMarks } from '../shared/morale-marks';
import { factionHue, monogram } from './resource-card';

/** A word for each morale step; at 1 the resource will not march. */
const MORALE_WORDS = ['', 'Broken', 'Shaken', 'Steady', 'Resolute', 'Fervent'];

/** Where a resource stands and why, as one line the table can read at a glance. */
const STATUS_LINES: Record<string, string> = {
  Refuses: 'Refuses to march: their morale is broken',
  Training: 'In the training grounds this turn',
  Healing: 'In the healers’ care',
  'Grievously injured': 'Grievously wounded: they need a healer',
};

/**
 * A hero or group on the TV: who they are, how strong, how willing, and who rides with them.
 * A group at the castle takes heroes dropped onto the panel.
 */
@Component({
  selector: 'ce-resource-detail',
  imports: [MoraleMarks],
  templateUrl: './resource-detail.html',
  styleUrl: './resource-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--hue]': 'hue()',
    '[class.dropping]': 'dropping()',
    '(dragover)': 'onDragOver($event)',
    '(dragleave)': 'onDragLeave($event)',
    '(drop)': 'onDrop($event)',
  },
})
export class ResourceDetail {
  private readonly portraits = inject(PortraitStore);

  readonly resource = input.required<ResourceView>();
  /** The heroes riding with a group. */
  readonly heroes = input<ResourceView[]>([]);
  /** The group a hero rides with. */
  readonly host = input<ResourceView | null>(null);

  readonly close = output<void>();
  readonly recall = output<string>();
  readonly detach = output<string>();
  readonly inspect = output<string>();
  readonly attachHere = output<{ heroId: string; hostId: string }>();

  protected readonly dropping = signal(false);
  protected readonly signed = signed;

  protected readonly hue = computed(() => factionHue(this.resource().faction));
  protected readonly portrait = computed(() => this.portraits.urlFor(this.resource().id, this.resource().image));
  protected readonly monogram = computed(() => monogram(this.resource().name));
  protected readonly isGroup = computed(() => this.resource().kind === 'group');
  protected readonly atCastle = computed(() => this.resource().location.kind === 'castle');

  protected readonly subtitle = computed(() => {
    const r = this.resource();
    if (r.kind === 'group') return `${r.faction}, ${r.maxNumber === 1 ? 'a lone company' : 'a company of ' + r.maxNumber}`;
    if (r.kind === 'avatar') return `An avatar of ${r.faction}`;
    return r.faction;
  });

  /** Where they are, in words, and the tone of it. */
  protected readonly where = computed((): { text: string; tone: 'ready' | 'field' | 'held' } => {
    const r = this.resource();
    const host = this.host();
    if (host) {
      const place = host.location.kind === 'event' ? ` at ${host.location.name}` : ' at the castle';
      return { text: `Rides with ${host.name}${place}`, tone: host.location.kind === 'event' ? 'field' : 'ready' };
    }
    if (r.status) return { text: STATUS_LINES[r.status] ?? r.status, tone: 'held' };
    if (r.location.kind === 'event') return { text: `In the field at ${r.location.name}`, tone: 'field' };
    if (r.kind === 'group') return { text: 'At the castle, ready to march', tone: 'ready' };
    return { text: 'At the castle: attach them to a group to take the field', tone: 'ready' };
  });

  protected readonly moraleWord = computed(() => MORALE_WORDS[this.resource().morale] ?? '');

  /** Every part after the base, as signed modifiers. */
  protected readonly modifiers = computed(() => this.resource().power.parts.slice(1));
  protected readonly base = computed(() => this.resource().power.parts[0]?.value ?? 0);

  protected readonly strength = computed(() => {
    const r = this.resource();
    if (r.kind !== 'group') return null;
    const max = Math.max(1, r.maxNumber!);
    const fighting = r.number! - r.injured!;
    return {
      fighting,
      injured: r.injured!,
      dead: r.maxNumber! - r.number!,
      max: r.maxNumber!,
      fightingPct: (fighting / max) * 100,
      injuredPct: (r.injured! / max) * 100,
    };
  });

  protected readonly wounds = computed(() => {
    const counts = new Map<string, number>();
    for (const w of this.resource().injuries) counts.set(w, (counts.get(w) ?? 0) + 1);
    return [...counts].map(([severity, n]) => ({ severity, n }));
  });

  protected readonly heroRows = computed(() =>
    this.heroes().map((h) => ({
      ...h,
      portrait: this.portraits.urlFor(h.id, h.image),
      monogram: monogram(h.name),
      hue: factionHue(h.faction),
    })),
  );

  /** What the heroes lend together, and whether the group's cap trims it. */
  protected readonly heroBonus = computed(() => {
    const lent = this.heroes().reduce((acc, h) => acc + (h.lends ?? 0), 0);
    const counted = this.resource().power.parts.find((p) => p.label === 'Attached heroes')?.value ?? 0;
    return { lent, counted, capped: lent > counted };
  });

  protected readonly openSlots = computed(() =>
    this.isGroup() ? Array.from({ length: Math.max(0, MAX_ATTACHED - this.heroes().length) }, (_, i) => i) : [],
  );
  protected readonly maxHeroes = MAX_ATTACHED;

  /** Heroes join a group only while it is home and has room. */
  protected readonly canTakeHeroes = computed(() => this.isGroup() && this.atCastle() && this.openSlots().length > 0);

  protected onDragOver(ev: DragEvent): void {
    if (!this.canTakeHeroes() || !ev.dataTransfer?.types.includes(HERO_DRAG_TYPE)) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    this.dropping.set(true);
  }

  /** Leaving a child element is not leaving the panel. */
  protected onDragLeave(ev: DragEvent): void {
    const to = ev.relatedTarget as Node | null;
    if (to && (ev.currentTarget as Node).contains(to)) return;
    this.dropping.set(false);
  }

  protected onDrop(ev: DragEvent): void {
    this.dropping.set(false);
    const heroId = ev.dataTransfer?.getData(HERO_DRAG_TYPE);
    if (!heroId || !this.canTakeHeroes()) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.attachHere.emit({ heroId, hostId: this.resource().id });
  }
}
