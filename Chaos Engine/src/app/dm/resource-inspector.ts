import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { GameStore } from '../data/game-store';
import { PortraitStore } from '../data/portrait-store';
import { makePortrait } from '../shared/portrait';
import { forgeArms, heal, recruit, recruitCapacity, serveWine, train } from '../engine/castle';
import { ResourcePatch, removeResource, updateResource } from '../engine/dm-edits';
import { isAtCastle, resourceById } from '../engine/game-state';
import { eventOptionsFor, resourceView } from '../engine/views';
import { fmt, signed } from '../shared/format';
import { MoraleMarks } from '../shared/morale-marks';

@Component({
  selector: 'ce-resource-inspector',
  imports: [MoraleMarks],
  templateUrl: './resource-inspector.html',
  styleUrl: './inspector.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourceInspector {
  protected readonly store = inject(GameStore);
  protected readonly portraits = inject(PortraitStore);
  protected readonly portraitError = signal<string | null>(null);
  protected readonly confirmingRemove = signal(false);
  readonly resourceId = input.required<string>();
  readonly selectEvent = output<string>();
  readonly selectResource = output<string>();

  protected readonly fmt = fmt;
  protected readonly signed = signed;
  protected readonly target = signal('');
  protected readonly hostTarget = signal('');

  protected readonly resource = computed(() => resourceById(this.store.state()!, this.resourceId()));
  protected readonly view = computed(() => {
    const r = this.resource();
    return r ? resourceView(this.store.state()!, r, this.store.rules) : null;
  });
  protected readonly home = computed(() => isAtCastle(this.store.state()!, this.resourceId()));
  protected readonly eventOptions = computed(() => eventOptionsFor(this.store.state()!, this.resourceId(), this.store.rules));

  /** Cards this hero could join: at the castle, not attached themselves, and not this hero. */
  /** Groups at the castle this hero could join, with how many heroes each already has. */
  protected readonly hostOptions = computed(() => {
    const s = this.store.state()!;
    return s.resources
      .filter((r) => r.kind === 'group' && !r.locked && isAtCastle(s, r.id))
      .map((g) => {
        const heroes = s.resources.filter((h) => h.attachedTo === g.id).length;
        return { id: g.id, name: g.name, heroes, full: heroes >= 3 };
      });
  });

  protected readonly recruitRoom = computed(() => {
    const r = this.resource();
    return r?.kind === 'group' ? recruitCapacity(this.store.state()!, r, this.store.rules) : 0;
  });

  protected readonly costs = computed(() => this.store.rules.castle.actions);

  private get name(): string {
    return this.resource()?.name ?? this.resourceId();
  }

  protected send(): void {
    const id = this.target() || this.eventOptions().find((o) => o.ok)?.id;
    if (id && this.store.assign(this.resourceId(), id)) this.target.set('');
  }

  protected attachTo(): void {
    if (this.hostTarget() && this.store.attach(this.resourceId(), this.hostTarget())) this.hostTarget.set('');
  }

  protected train(): void {
    this.store.act(`Train ${this.name}`, (s, r) => train(s, this.resourceId(), r));
  }

  protected heal(): void {
    this.store.act(`Heal ${this.name}`, (s, r) => heal(s, this.resourceId(), r));
  }

  protected wine(): void {
    this.store.act(`Serve Tom's wine to ${this.name}`, (s, r) => serveWine(s, this.resourceId(), r));
  }

  protected recruit(): void {
    this.store.act(`Recruit for ${this.name}`, (s, r) => recruit(s, this.resourceId(), this.recruitRoom(), r));
  }

  protected forge(): void {
    this.store.act(`Forge arms for ${this.name}`, (s, r) => forgeArms(s, this.resourceId(), r));
  }

  protected edit(patch: ResourcePatch, what: string): void {
    this.store.act(`${what}: ${this.name}`, (s) => updateResource(s, this.resourceId(), patch));
  }

  protected readonly portrait = computed(() => {
    const r = this.resource();
    return r ? this.portraits.urlFor(r.id, r.image) : null;
  });
  protected readonly uploaded = computed(() => !!this.portraits.urls()[this.resourceId()]);

  protected async choosePortrait(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.portraitError.set(null);
    try {
      await this.portraits.set(this.resourceId(), await makePortrait(file));
    } catch (e) {
      this.portraitError.set(e instanceof Error ? e.message : 'That image could not be used.');
    }
  }

  protected removePortrait(): void {
    void this.portraits.remove(this.resourceId());
  }

  protected remove(): void {
    const id = this.resourceId();
    if (this.store.act(`Remove ${this.name} from the game`, (s) => removeResource(s, id))) {
      void this.portraits.remove(id);
      this.confirmingRemove.set(false);
    }
  }

  protected nameOf(id: string): string {
    return resourceById(this.store.state()!, id)?.name ?? id;
  }

  protected num(ev: Event): number {
    return Number((ev.target as HTMLInputElement).value);
  }
}
