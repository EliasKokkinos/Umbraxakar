import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { SessionService } from '../data/session.service';
import { DmScreen } from './dm-screen';

/** Boots the session for the DM window. The table window never boots one: it only listens. */
@Component({
  selector: 'ce-dm-gate',
  imports: [DmScreen],
  template: `
    @let s = status();
    @switch (s.state) {
      @case ('loading') {
        <main class="boot">
          <h1>Chaos Engine</h1>
          <p>Unrolling the map of Edar…</p>
        </main>
      }
      @case ('failed') {
        @if (s.state === 'failed') {
          <main class="boot boot--failed" role="alert">
            <h1>Chaos Engine</h1>
            <p>{{ s.message }}</p>
            @if (s.details?.length) {
              <ul data-testid="boot-errors">
                @for (d of s.details; track d) {
                  <li>{{ d }}</li>
                }
              </ul>
            }
          </main>
        }
      }
      @case ('ready') {
        <ce-dm-screen />
      }
    }
  `,
  styleUrl: '../app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmGate implements OnInit {
  private readonly session = inject(SessionService);
  protected readonly status = this.session.status;

  ngOnInit(): void {
    if (this.session.status().state === 'loading') void this.session.boot();
  }
}
