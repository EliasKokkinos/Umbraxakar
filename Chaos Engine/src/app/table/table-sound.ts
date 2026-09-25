import { Injectable, signal } from '@angular/core';

/**
 * Sound for the TV, synthesised with Web Audio so the app ships no audio files. Browsers only
 * allow audio after a click in the window, so it starts off and the table offers a button.
 */
@Injectable({ providedIn: 'root' })
export class TableSound {
  private ctx: AudioContext | null = null;
  private readonly _enabled = signal(false);
  readonly enabled = this._enabled.asReadonly();

  /** Call from a click handler. */
  toggle(): void {
    if (this._enabled()) {
      this._enabled.set(false);
      return;
    }
    try {
      this.ctx ??= new AudioContext();
      void this.ctx.resume();
      this._enabled.set(true);
    } catch {
      this._enabled.set(false);
    }
  }

  /** One die striking the table: a short burst of filtered noise. */
  tick(): void {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx, 0.04);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1800 + Math.random() * 1400;
    const gain = this.envelope(ctx, t, 0.18, 0.002, 0.035);
    src.connect(band).connect(gain).connect(ctx.destination);
    src.start(t);
  }

  victory(): void {
    this.tone([392, 587.33], 'triangle', 0.22, 0.9);
  }

  defeat(): void {
    this.tone([146.83, 110], 'sawtooth', 0.12, 1.2, 600);
  }

  /** Something vast has come through: a low rumble under a falling tone. */
  legendary(): void {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx, 2.5);
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 140;
    src.connect(low).connect(this.envelope(ctx, t, 0.5, 0.4, 2)).connect(ctx.destination);
    src.start(t);
    this.tone([73.42, 55], 'sine', 0.3, 2.4);
  }

  command(): void {
    this.tone([261.63, 392], 'triangle', 0.16, 1.1);
  }

  private live(): AudioContext | null {
    return this._enabled() && this.ctx ? this.ctx : null;
  }

  /** Notes played in sequence, each gliding into the next. */
  private tone(freqs: number[], type: OscillatorType, peak: number, length: number, lowpass?: number): void {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    const step = length / freqs.length;
    freqs.forEach((f, i) => osc.frequency.setValueAtTime(f, t + i * step));
    let node: AudioNode = osc;
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      node = osc.connect(f);
    }
    node.connect(this.envelope(ctx, t, peak, 0.03, length)).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + length + 0.1);
  }

  private envelope(ctx: AudioContext, t: number, peak: number, attack: number, length: number): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    return g;
  }

  private noise(ctx: AudioContext, seconds: number): AudioBuffer {
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}
