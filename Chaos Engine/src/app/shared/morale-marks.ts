import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Morale as five marks; at 1 the resource refuses to deploy. */
@Component({
  selector: 'ce-morale-marks',
  template: `
    @for (lit of marks(); track $index) {
      <i [class.lit]="lit"></i>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      gap: 2px;
    }
    i {
      width: 6px;
      height: 10px;
      border-radius: 1px;
      background: var(--ce-rule);
    }
    i.lit {
      background: var(--ce-bone);
    }
    :host(.low) i.lit {
      background: var(--ce-oxblood);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'img',
    '[attr.aria-label]': '"Morale " + morale() + " of 5"',
    '[class.low]': 'morale() <= 1',
  },
})
export class MoraleMarks {
  readonly morale = input.required<number>();
  protected readonly marks = computed(() => Array.from({ length: 5 }, (_, i) => i < this.morale()));
}
