import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SessionService, SessionStatus } from '../data/session.service';
import { DmGate } from './dm-gate';

describe('DmGate', () => {
  const status = signal<SessionStatus>({ state: 'loading' });

  beforeEach(async () => {
    status.set({ state: 'loading' });
    await TestBed.configureTestingModule({
      imports: [DmGate],
      providers: [{ provide: SessionService, useValue: { status, boot: () => Promise.resolve() } }],
    }).compileComponents();
  });

  it('shows the loading screen while booting', async () => {
    const fixture = TestBed.createComponent(DmGate);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unrolling the map of Edar');
  });

  it('explains a failed boot and lists the problems', async () => {
    const fixture = TestBed.createComponent(DmGate);
    status.set({ state: 'failed', message: 'The seed data has problems.', details: ['uruk: morale 0 out of 1-5'] });
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('The seed data has problems.');
    expect(el.querySelector('[data-testid="boot-errors"]')?.textContent).toContain('uruk: morale 0 out of 1-5');
  });
});
