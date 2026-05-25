import { useGameStore } from './GameStateManager';

type Wave = OscillatorType;
type Bus = 'ui' | 'fx';

interface BlipOpts {
  freq: number;
  dur: number;
  type?: Wave;
  vol?: number;
  slideTo?: number;
  bus?: Bus;
  pan?: number;
}

const FX_BUS_GAIN = 1.3;
const UI_BUS_GAIN = 1.1;
const MASTER_GAIN = 1.3;
const UNIFORM_VOL = 0.75;

class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private uiBus!: GainNode;
  private fxBus!: GainNode;

  private resuming: Promise<void> | null = null;
  private unlocked = false;
  private lastFiredAt: Record<string, number> = {};

  private adDucked = false;

  private getBusGain(bus: Bus): GainNode {
    if (bus === 'ui') return this.uiBus;
    return this.fxBus;
  }

  private busEnabled(_bus: Bus): boolean {
    return useGameStore.getState().sfxEnabled;
  }

  private createCtx(): boolean {
    if (typeof window === 'undefined') return false;
    if (this.ctx) return true;
    const Ctx =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return false;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = MASTER_GAIN;
    this.master.connect(this.ctx.destination);
    this.uiBus = this.ctx.createGain();
    this.uiBus.gain.value = UI_BUS_GAIN;
    this.uiBus.connect(this.master);
    this.fxBus = this.ctx.createGain();
    this.fxBus.gain.value = FX_BUS_GAIN;
    this.fxBus.connect(this.master);
    return true;
  }

  private ensure(): 'ready' | 'pending' | 'unsupported' {
    if (!this.createCtx() || !this.ctx) return 'unsupported';
    if (this.ctx.state === 'running') return 'ready';
    // Fire-and-forget resume. AudioContext.start() scheduled while suspended
    // will play once context resumes — no need to queue thunks.
    if (!this.resuming) {
      this.resuming = this.ctx
        .resume()
        .then(() => {
          this.unlocked = true;
        })
        .catch(() => {
          /* next gesture retries */
        })
        .finally(() => {
          this.resuming = null;
        });
    }
    return 'pending';
  }

  private enqueueOrPlay(thunk: () => void): void {
    const state = this.ensure();
    if (state === 'unsupported') return;
    // Always play synchronously. Web Audio scheduler tolerates osc.start while
    // ctx suspended; the sound fires once running. Avoids queue staleness.
    thunk();
  }

  // Safety throttle only blocks same-frame double-fires (10ms). User-facing
  // sounds always reach this threshold so they always play.
  private throttle(key: string, _minMs: number): boolean {
    const now = performance.now();
    const last = this.lastFiredAt[key] ?? 0;
    if (now - last < 10) return false;
    this.lastFiredAt[key] = now;
    return true;
  }

  /**
   * One-time unlock to be wired to first user gesture.
   * Primes iOS Safari + warms ctx so first SFX has zero latency.
   */
  public unlock(): void {
    if (!this.createCtx() || !this.ctx) return;
    if (this.unlocked) return;
    this.ensure();
    try {
      const buf = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
  }

  private blip(opts: BlipOpts): void {
    const bus = opts.bus ?? 'fx';
    if (!this.busEnabled(bus)) return;
    this.enqueueOrPlay(() => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = opts.type ?? 'sine';
      osc.frequency.setValueAtTime(opts.freq, now);
      if (opts.slideTo) {
        osc.frequency.exponentialRampToValueAtTime(opts.slideTo, now + opts.dur);
      }
      const vol = opts.vol ?? 0.4;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(vol, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + opts.dur);
      let tail: AudioNode = g;
      if (opts.pan !== undefined && this.ctx.createStereoPanner) {
        const p = this.ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, opts.pan));
        g.connect(p);
        tail = p;
      }
      osc.connect(g);
      tail.connect(this.getBusGain(bus));
      osc.start(now);
      osc.stop(now + opts.dur + 0.02);
    });
  }

  private noiseBurst(
    dur: number,
    cutoff: number,
    cutoffEnd: number,
    vol: number,
    bus: Bus = 'fx',
    pan?: number,
  ): void {
    if (!this.busEnabled(bus)) return;
    this.enqueueOrPlay(() => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const sampleRate = this.ctx.sampleRate;
      const len = Math.max(1, Math.floor(sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 2;
      filter.frequency.setValueAtTime(cutoff, now);
      filter.frequency.linearRampToValueAtTime(cutoffEnd, now + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(vol, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      let tail: AudioNode = g;
      if (pan !== undefined && this.ctx.createStereoPanner) {
        const p = this.ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        g.connect(p);
        tail = p;
      }
      src.connect(filter).connect(g);
      tail.connect(this.getBusGain(bus));
      src.start(now);
      src.stop(now + dur + 0.02);
    });
  }

  // ---------- Public API ----------

  public uiTap(): void {
    if (!this.throttle('uiTap', 0)) return;
    this.blip({ freq: 700, dur: 0.06, type: 'square', vol: UNIFORM_VOL, bus: 'ui' });
  }

  public click(): void {
    if (!this.throttle('click', 0)) return;
    this.blip({ freq: 900, dur: 0.07, type: 'square', vol: UNIFORM_VOL });
  }

  public pop(pan?: number): void {
    if (!this.throttle('pop', 0)) return;
    this.blip({ freq: 540, dur: 0.2, type: 'sine', vol: UNIFORM_VOL, slideTo: 1100, pan });
  }

  public thud(): void {
    if (!this.throttle('thud', 0)) return;
    this.blip({ freq: 180, dur: 0.25, type: 'sawtooth', vol: UNIFORM_VOL, slideTo: 80 });
  }

  public win(): void {
    if (!this.busEnabled('fx')) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      setTimeout(
        () => this.blip({ freq: f, dur: 0.24, type: 'triangle', vol: UNIFORM_VOL }),
        i * 110,
      );
    });
    setTimeout(
      () => this.blip({ freq: 1568, dur: 0.2, type: 'triangle', vol: UNIFORM_VOL }),
      4 * 110,
    );
  }

  public hover(): void {
    if (!this.throttle('hover', 0)) return;
    this.blip({ freq: 1200, dur: 0.05, type: 'sine', vol: UNIFORM_VOL, slideTo: 1400, bus: 'ui' });
  }

  public grab(): void {
    if (!this.throttle('grab', 0)) return;
    this.blip({ freq: 380, dur: 0.09, type: 'triangle', vol: UNIFORM_VOL });
  }

  public slideStart(distance: number, pan?: number): void {
    if (!this.throttle('slideStart', 0)) return;
    this.noiseBurst(0.12, 1400, 500, UNIFORM_VOL, 'fx', pan);
    this.blip({ freq: 130, dur: 0.06, type: 'triangle', vol: UNIFORM_VOL, pan });
    this.blip({ freq: 240, dur: 0.12, type: 'sine', vol: UNIFORM_VOL, slideTo: 150, pan });
  }

  public slideEnd(distance: number, pan?: number): void {
    if (distance <= 2) {
      if (!this.throttle('slideEndShort', 0)) return;
      this.blip({ freq: 700, dur: 0.08, type: 'square', vol: UNIFORM_VOL, pan });
    } else {
      if (!this.throttle('slideEndLong', 0)) return;
      this.blip({ freq: 880, dur: 0.12, type: 'square', vol: UNIFORM_VOL, slideTo: 500, pan });
    }
  }

  public bump(): void {
    if (!this.throttle('bump', 0)) return;
    this.blip({ freq: 220, dur: 0.12, type: 'sawtooth', vol: UNIFORM_VOL, slideTo: 140 });
  }

  public unlockChime(): void {
    [660, 990, 1320].forEach((f, i) => {
      setTimeout(
        () => this.blip({ freq: f, dur: 0.08, type: 'triangle', vol: UNIFORM_VOL }),
        i * 50,
      );
    });
  }

  public constraintReject(): void {
    if (!this.throttle('constraintReject', 0)) return;
    this.blip({ freq: 300, dur: 0.2, type: 'sawtooth', vol: UNIFORM_VOL, slideTo: 260 });
  }

  public combo(n: number): void {
    const freq = 600 * Math.pow(1.12, Math.min(n, 8));
    this.blip({ freq, dur: 0.08, type: 'sine', vol: UNIFORM_VOL });
  }

  public aiStep(): void {
    this.blip({ freq: 880, dur: 0.05, type: 'sine', vol: UNIFORM_VOL, bus: 'ui' });
  }

  public deadEnd(): void {
    this.blip({ freq: 300, dur: 0.6, type: 'sawtooth', vol: UNIFORM_VOL, slideTo: 120 });
    this.noiseBurst(0.5, 600, 200, UNIFORM_VOL);
  }

  public levelFail(): void {
    if (!this.busEnabled('fx')) return;
    [660, 523, 392, 294].forEach((f, i) => {
      setTimeout(
        () => this.blip({ freq: f, dur: 0.2, type: 'triangle', vol: UNIFORM_VOL }),
        i * 140,
      );
    });
  }

  public pauseSwoosh(): void {
    this.noiseBurst(0.25, 4000, 400, UNIFORM_VOL);
  }

  public resumeSwoosh(): void {
    this.noiseBurst(0.25, 400, 4000, UNIFORM_VOL);
  }

  public menuOpen(): void {
    this.blip({ freq: 440, dur: 0.2, type: 'triangle', vol: UNIFORM_VOL, slideTo: 880, bus: 'ui' });
  }

  public tick(): void {
    if (!this.throttle('tick', 0)) return;
    this.blip({ freq: 1500, dur: 0.04, type: 'square', vol: UNIFORM_VOL, bus: 'ui' });
  }

  // ---------- Mix control ----------

  public duckForAd(active: boolean): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (active && !this.adDucked) {
      this.adDucked = true;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0, now + 0.2);
    } else if (!active && this.adDucked) {
      this.adDucked = false;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(MASTER_GAIN, now + 0.2);
    }
  }

  // No-op kept for callers that previously toggled music. SFX state is the only
  // thing that matters now.
  public refreshEnabledBuses(): void {
    /* no-op */
  }

  public startAmbient(): void {
    /* no-op: music removed */
  }

  public stopAmbient(): void {
    /* no-op: music removed */
  }

  // ---------- Debug ----------

  public testAll(): void {
    const seq: Array<[string, () => void]> = [
      ['uiTap', () => this.uiTap()],
      ['click', () => this.click()],
      ['pop', () => this.pop()],
      ['thud', () => this.thud()],
      ['hover', () => this.hover()],
      ['grab', () => this.grab()],
      ['slideStart', () => this.slideStart(3)],
      ['slideEnd-short', () => this.slideEnd(2)],
      ['slideEnd-long', () => this.slideEnd(5)],
      ['bump', () => this.bump()],
      ['unlockChime', () => this.unlockChime()],
      ['constraintReject', () => this.constraintReject()],
      ['combo3', () => this.combo(3)],
      ['aiStep', () => this.aiStep()],
      ['deadEnd', () => this.deadEnd()],
      ['levelFail', () => this.levelFail()],
      ['pauseSwoosh', () => this.pauseSwoosh()],
      ['resumeSwoosh', () => this.resumeSwoosh()],
      ['menuOpen', () => this.menuOpen()],
      ['tick', () => this.tick()],
      ['win', () => this.win()],
    ];
    seq.forEach(([name, fn], i) => {
      setTimeout(() => {
        // eslint-disable-next-line no-console
        console.log(`[audio test] ${name} ctx=${this.ctx?.state}`);
        fn();
      }, i * 400);
    });
  }
}

export const AudioManager = new AudioManagerImpl();
