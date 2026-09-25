import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { GameStore } from '../data/game-store';
import { commandImpact, hasCommanderThisTurn } from '../engine/commanders';

/**
 * The inspector's resting state. Until someone takes command of the turn it lists every
 * commander with the sway they would bring; afterwards, what the chosen commander did.
 */
@Component({
  selector: 'ce-command-picker',
  templateUrl: './command-picker.html',
  styleUrl: './command-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandPicker {
  protected readonly store = inject(GameStore);
  readonly selectResource = output<string>();

  protected readonly turn = computed(() => this.store.state()!.events.turn);
  protected readonly chosen = computed(() => hasCommanderThisTurn(this.store.state()!));

  protected readonly options = computed(() => {
    const s = this.store.state()!;
    const rules = this.store.rules;
    const ids = this.chosen() ? [s.commanderId!] : rules.commanders.map((c) => c.id);
    return ids.map((id) => {
      const c = rules.commanders.find((x) => x.id === id)!;
      // Once chosen, the sway is already applied: show it from the recorded influence instead.
      const impact = this.chosen()
        ? (c.influence ?? []).map((i) => ({
            resourceId: i.resourceId,
            name: s.resources.find((r) => r.id === i.resourceId)?.name ?? i.resourceId,
            delta: i.morale,
            reason: i.reason,
            locked: !!s.resources.find((r) => r.id === i.resourceId)?.locked,
            note: '',
          }))
        : commandImpact(s, id, rules).map((i) => ({
            ...i,
            note: i.from === i.to ? `already at ${i.to}` : `${i.from} to ${i.to}`,
          }));
      return { id, name: c.name, role: c.divineRole, player: c.player, impact };
    });
  });

  protected take(id: string): void {
    this.store.takeCommand(id);
  }
}
