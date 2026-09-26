import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { GameStore } from '../data/game-store';
import { SWAY_RANGE, hasCommanderThisTurn, influenceOf, isInfluenceEdited } from '../engine/commanders';
import { CommanderInfluence } from '../engine/seed-types';

const KIND_ORDER = [
  { kind: 'group', label: 'Groups' },
  { kind: 'hero', label: 'Heroes' },
  { kind: 'avatar', label: 'Avatars' },
] as const;

/**
 * The DM rewrites whom a commander sways, by how much, and why. Each change is an undoable
 * action; it takes effect the next time the commander takes command.
 */
@Component({
  selector: 'ce-sway-editor',
  imports: [ReactiveFormsModule],
  templateUrl: './sway-editor.html',
  styleUrl: './sway-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwayEditor {
  private readonly store = inject(GameStore);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly commanderId = input.required<string>();
  readonly done = output<void>();

  protected readonly range = SWAY_RANGE;
  protected readonly signed = (n: number) => (n > 0 ? `+${n}` : String(n));

  protected readonly rows = computed(() => {
    const s = this.store.state()!;
    return influenceOf(s, this.commanderId(), this.store.rules).map((i) => {
      const r = s.resources.find((x) => x.id === i.resourceId);
      return { ...i, name: r?.name ?? i.resourceId, locked: !!r?.locked };
    });
  });

  protected readonly edited = computed(() => isInfluenceEdited(this.store.state()!, this.commanderId()));

  /** The sway already applied this turn stands; edits wait for their next command. */
  protected readonly commandsNow = computed(() => {
    const s = this.store.state()!;
    return hasCommanderThisTurn(s) && s.commanderId === this.commanderId();
  });

  /** Everyone they do not yet sway, grouped by kind. */
  protected readonly choices = computed(() => {
    const swayed = new Set(this.rows().map((r) => r.resourceId));
    const free = this.store.state()!.resources.filter((r) => !swayed.has(r.id));
    return KIND_ORDER.map((k) => ({
      label: k.label,
      options: free
        .filter((r) => r.kind === k.kind)
        .map((r) => ({ id: r.id, name: r.locked ? `${r.name} (not yet in play)` : r.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })).filter((g) => g.options.length);
  });

  protected readonly form = this.fb.group({
    resourceId: this.fb.control('', Validators.required),
    morale: this.fb.control(1),
    reason: this.fb.control('', [Validators.required, Validators.pattern(/\S/)]),
  });
  private readonly status = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  protected readonly canAdd = computed(() => this.status() === 'VALID');

  protected change(row: CommanderInfluence, patch: Partial<CommanderInfluence>): void {
    const next = { resourceId: row.resourceId, morale: row.morale, reason: row.reason, ...patch };
    if (next.morale === row.morale && next.reason.trim() === row.reason) return;
    this.store.setSway(this.commanderId(), next);
  }

  protected changeMorale(row: CommanderInfluence, value: string): void {
    this.change(row, { morale: Number(value) });
  }

  protected remove(resourceId: string): void {
    this.store.removeSway(this.commanderId(), resourceId);
  }

  protected add(): void {
    if (!this.canAdd()) return;
    const v = this.form.getRawValue();
    if (this.store.setSway(this.commanderId(), { resourceId: v.resourceId, morale: Number(v.morale), reason: v.reason })) {
      this.form.reset({ resourceId: '', morale: 1, reason: '' });
    }
  }

  protected reset(): void {
    this.store.resetSway(this.commanderId());
  }
}
