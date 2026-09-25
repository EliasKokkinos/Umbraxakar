import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { GameStore } from '../data/game-store';
import { TurnSnapshots } from '../data/turn-snapshots';

const clock = new Intl.DateTimeFormat('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

/** "Earlier turns": the start of each of the last ten turns, any of which can be restored. */
@Component({
  selector: 'ce-turn-history',
  template: `
    <div class="history">
      <button type="button" [attr.aria-expanded]="open()" (click)="open.set(!open())">
        Earlier turns <span class="num">{{ snapshots.list().length }}</span>
      </button>
      @if (open()) {
        <div class="panel" role="dialog" aria-label="Earlier turns">
          <p class="sub">The start of each of the last ten turns. Restoring one keeps the rest, so you can come back.</p>
          <ul>
            @for (s of snapshots.list(); track s.id) {
              <li [class.current]="s.turn === store.state()?.events.turn">
                <div>
                  <strong>{{ s.label }}</strong>
                  <span class="when">{{ when(s.savedAt) }}</span>
                </div>
                @if (confirming() === s.id) {
                  <span class="confirm">
                    <button type="button" class="danger" (click)="restore(s.id)">Restore it</button>
                    <button type="button" (click)="confirming.set(null)">Keep playing</button>
                  </span>
                } @else {
                  <button type="button" (click)="confirming.set(s.id)">Restore</button>
                }
              </li>
            } @empty {
              <li class="sub">Nothing yet. The start of each turn is kept here as it begins.</li>
            }
          </ul>
        </div>
      }
    </div>
  `,
  styles: `
    .history {
      position: relative;
    }
    .num {
      color: var(--ce-ash);
    }
    .panel {
      position: absolute;
      z-index: 20;
      top: calc(100% + 0.4rem);
      right: 0;
      width: 24rem;
      padding: 0.8rem;
      background: var(--ce-iron);
      border: 1px solid var(--ce-rule);
      border-radius: var(--ce-radius);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    }
    .sub {
      margin: 0 0 0.5rem;
      color: var(--ce-ash);
      font-size: var(--ce-small);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 22rem;
      overflow-y: auto;
    }
    li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.6rem;
      padding: 0.4rem 0;
      border-top: 1px solid var(--ce-rule);
    }
    li.current strong {
      color: var(--ce-brass);
    }
    li div {
      display: grid;
    }
    .when {
      color: var(--ce-ash);
      font-size: var(--ce-small);
    }
    .confirm {
      display: flex;
      gap: 0.3rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TurnHistory {
  protected readonly store = inject(GameStore);
  protected readonly snapshots = inject(TurnSnapshots);
  protected readonly open = signal(false);
  protected readonly confirming = signal<string | null>(null);

  protected when(iso: string): string {
    return clock.format(new Date(iso));
  }

  protected restore(id: string): void {
    if (this.store.restoreSnapshot(id)) {
      this.confirming.set(null);
      this.open.set(false);
    }
  }
}
