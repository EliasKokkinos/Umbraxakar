import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStore } from '../data/game-store';
import { facilityLevel, facilityValue, healSlots, hireEntertainers, musterMilitia, upgradeFacility, facilityFlag } from '../engine/castle';
import { setTreasury, setTreasuryVisibility } from '../engine/dm-edits';
import { castleWork } from '../engine/views';
import { fmt } from '../shared/format';

/** The castle strip: treasury, facilities, slots and the castle-wide actions. */
@Component({
  selector: 'ce-castle-panel',
  templateUrl: './castle-panel.html',
  styleUrl: './castle-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CastlePanel {
  protected readonly store = inject(GameStore);
  protected readonly fmt = fmt;

  protected readonly castle = computed(() => this.store.state()!.castle);
  private readonly rules = computed(() => this.store.rules);

  protected readonly facilities = computed(() => {
    const s = this.store.state()!;
    const r = this.rules();
    return r.castle.facilities.map((f) => {
      const level = facilityLevel(s, f.id);
      const building = s.castle.projects.find((p) => p.kind === 'upgrade' && p.facilityId === f.id);
      return {
        id: f.id,
        name: f.name,
        level,
        building: building?.kind === 'upgrade' ? building.turnsLeft : null,
        cost: level < 3 ? r.castle.upgrade.costs[String(level + 1)] : null,
      };
    });
  });

  protected readonly slots = computed(() => {
    const s = this.store.state()!;
    const r = this.rules();
    return {
      healing: `${s.castle.treatments.length} of ${healSlots(s, r)}`,
      training: `${s.castle.training.length} of ${facilityValue(s, r, 'training-grounds', 'trainSlots')}`,
      casks: `${s.castle.casksServed} of ${facilityValue(s, r, 'winery', 'casksPerTurn')}`,
    };
  });

  protected readonly entertainerCost = computed(() => {
    const factor = facilityValue(this.store.state()!, this.rules(), 'great-hall', 'entertainerCostFactor') || 1;
    return Math.round(this.rules().castle.actions.entertainers.cost * factor);
  });
  protected readonly militiaReady = computed(() => facilityFlag(this.store.state()!, this.rules(), 'barracks', 'militia'));
  protected readonly militiaCost = computed(() => this.rules().castle.actions.militia.cost);

  /** Work in progress, in words. */
  protected readonly projects = computed(() => castleWork(this.store.state()!, this.rules()));

  protected upgrade(id: string, name: string): void {
    this.store.act(`Upgrade the ${name}`, (s, r) => upgradeFacility(s, id, r));
  }

  protected entertainers(): void {
    this.store.act('Hire entertainers', hireEntertainers);
  }

  protected militia(): void {
    this.store.act('Muster militia', musterMilitia);
  }

  protected setTreasury(ev: Event): void {
    const value = Number((ev.target as HTMLInputElement).value);
    this.store.act('Set the treasury', (s) => setTreasury(s, value));
  }

  protected setVisibility(ev: Event): void {
    const show = (ev.target as HTMLInputElement).checked;
    this.store.act(show ? 'Show the treasury on the table' : 'Hide the treasury from the table', (s) => setTreasuryVisibility(s, show));
  }

  protected setIncome(ev: Event): void {
    const value = Number((ev.target as HTMLInputElement).value);
    this.store.act('Set income per turn', (s) => setTreasury(s, s.castle.treasury, value));
  }
}
