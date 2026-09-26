import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { GameStore } from '../data/game-store';
import { appliedSway, commandImpact, hasCommanderThisTurn, isInfluenceEdited } from '../engine/commanders';
import { SwayEditor } from './sway-editor';

/**
 * The inspector's resting state. Until someone takes command of the turn it lists every
 * commander with the sway they would bring; afterwards, what the chosen commander did, with
 * the others below. The DM can rewrite any commander's sway from here.
 */
@Component({
  selector: 'ce-command-picker',
  imports: [SwayEditor, NgTemplateOutlet],
  templateUrl: './command-picker.html',
  styleUrl: './command-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandPicker {
  protected readonly store = inject(GameStore);
  readonly selectResource = output<string>();

  /** The commander whose sway is open for editing. */
  protected readonly editing = signal<string | null>(null);

  protected readonly turn = computed(() => this.store.state()!.events.turn);
  protected readonly chosen = computed(() => hasCommanderThisTurn(this.store.state()!));

  private readonly all = computed(() => {
    const s = this.store.state()!;
    const rules = this.store.rules;
    const chosen = this.chosen();
    return rules.commanders.map((c) => {
      const commands = chosen && c.id === s.commanderId;
      // Once chosen, the sway is already applied: show what was applied instead.
      const impact = commands
        ? appliedSway(s, rules).map((i) => ({
            resourceId: i.resourceId,
            name: s.resources.find((r) => r.id === i.resourceId)?.name ?? i.resourceId,
            delta: i.morale,
            reason: i.reason,
            locked: !!s.resources.find((r) => r.id === i.resourceId)?.locked,
            note: '',
          }))
        : commandImpact(s, c.id, rules).map((i) => ({
            ...i,
            note: chosen ? '' : i.from === i.to ? `already at ${i.to}` : `${i.from} to ${i.to}`,
          }));
      return { id: c.id, name: c.name, role: c.divineRole, player: c.player, impact, edited: isInfluenceEdited(s, c.id), commands };
    });
  });

  /** Before command: everyone. After: the commander of the turn. */
  protected readonly options = computed(() => (this.chosen() ? this.all().filter((c) => c.commands) : this.all()));
  protected readonly others = computed(() => (this.chosen() ? this.all().filter((c) => !c.commands) : []));

  protected take(id: string): void {
    this.editing.set(null);
    this.store.takeCommand(id);
  }

  protected toggleEdit(id: string): void {
    this.editing.set(this.editing() === id ? null : id);
  }
}
