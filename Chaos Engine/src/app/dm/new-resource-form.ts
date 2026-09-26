import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { GameStore } from '../data/game-store';
import { NewResourceSpec, createResource, newResourceId } from '../engine/dm-edits';

/** The inspector's form for bringing a new hero, avatar or group into the game. */
@Component({
  selector: 'ce-new-resource-form',
  imports: [ReactiveFormsModule],
  templateUrl: './new-resource-form.html',
  styleUrl: './inspector.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewResourceForm {
  private readonly store = inject(GameStore);
  private readonly fb = inject(FormBuilder).nonNullable;

  /** The new resource's id, once it is in play. */
  readonly created = output<string>();
  readonly cancelled = output<void>();

  protected readonly form = this.fb.group({
    kind: this.fb.control<NewResourceSpec['kind']>('hero'),
    name: this.fb.control('', [Validators.required, Validators.pattern(/\S/)]),
    faction: this.fb.control('Iron Company'),
    power: this.fb.control(5, [Validators.required, Validators.min(1), Validators.max(10)]),
    morale: this.fb.control(4, [Validators.required, Validators.min(1), Validators.max(5)]),
    injuryResistance: this.fb.control(3, [Validators.min(1), Validators.max(5)]),
    number: this.fb.control(100, [Validators.min(1)]),
    decimationResistance: this.fb.control(3, [Validators.min(1), Validators.max(5)]),
    replenishable: this.fb.control(true),
    canCleanse: this.fb.control(false),
    tisteAndii: this.fb.control(false),
    healer: this.fb.control(false),
    hidden: this.fb.control(false),
    notes: this.fb.control(''),
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly isGroup = computed(() => this.value().kind === 'group');

  /** Factions already in play, offered as suggestions. */
  protected readonly factions = computed(() => [...new Set(this.store.state()!.resources.map((r) => r.faction))].sort());

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const spec = this.form.getRawValue();
    const id = newResourceId(this.store.state()!, spec.name, this.store.rules);
    if (this.store.act(`Bring ${spec.name.trim()} into play`, (s, r) => createResource(s, spec, r))) this.created.emit(id);
  }
}
