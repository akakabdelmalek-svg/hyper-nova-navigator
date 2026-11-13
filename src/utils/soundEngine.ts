// Web Audio API Sound FX & Media Equalizer Engine for Hyper Nova Navigator

class NovaSoundEngine {
  private ctx: AudioContext | null = null;
  private sfxEnabled = true;
  private eqNodes: BiquadFilterNode[] = [];
  private masterGain: GainNode | null = null;
  private bassBoostNode: BiquadFilterNode | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;

  // Procedural synth loop state
  private synthTimer: number | null = null;
  private synthPlaying = false;
  private synthStep = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.setupEqualizerChain(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private setupEqualizerChain(ctx: AudioContext) {
    const freqs = [60, 230, 910, 3600, 14000];
    this.eqNodes = freqs.map((freq, idx) => {
      const filter = ctx.createBiquadFilter();
      filter.type = idx === 0 ? 'lowshelf' : idx === freqs.length - 1 ? 'highshelf' : 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.1;
      filter.gain.value = 0;
      return filter;
    });

    this.bassBoostNode = ctx.createBiquadFilter();
    this.bassBoostNode.type = 'lowshelf';
    this.bassBoostNode.frequency.value = 110;
    this.bassBoostNode.gain.value = 0;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.35;

    for (let i = 0; i < this.eqNodes.length - 1; i++) {
      this.eqNodes[i].connect(this.eqNodes[i + 1]);
    }
    this.eqNodes[this.eqNodes.length - 1].connect(this.bassBoostNode);
    this.bassBoostNode.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);
  }

  setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
  }

  isSfxEnabled() {
    return this.sfxEnabled;
  }

  setVolume(val: number) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, val)), ctx.currentTime, 0.03);
  }

  setEqBand(index: number, db: number) {
    const ctx = this.ensureContext();
    if (!ctx || !this.eqNodes[index]) return;
    this.eqNodes[index].gain.setTargetAtTime(db, ctx.currentTime, 0.04);
  }

  setBassBoost(enabled: boolean) {
    const ctx = this.ensureContext();
    if (!ctx || !this.bassBoostNode) return;
    this.bassBoostNode.gain.setTargetAtTime(enabled ? 8 : 0, ctx.currentTime, 0.05);
  }

  playStartup() {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [220, 329.63, 440, 659.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq * 0.85, now + i * 0.07);
      osc.frequency.exponentialRampToValueAtTime(freq, now + i * 0.07 + 0.18);
      gain.gain.setValueAtTime(0.0001, now + i * 0.07);
      gain.gain.linearRampToValueAtTime(0.07, now + i * 0.07 + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.6);
    });
  }

  playClick() {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.045);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  playTabSwitch() {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.07);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playAiAlert() {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [660, 880, 1174.66].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.065);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.065);
      gain.gain.linearRampToValueAtTime(0.06, now + idx * 0.065 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.065 + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.065);
      osc.stop(now + idx * 0.065 + 0.26);
    });
  }

  playHyperDrive(activating: boolean) {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sine';

    if (activating) {
      osc1.frequency.setValueAtTime(80, now);
      osc1.frequency.exponentialRampToValueAtTime(440, now + 0.55);
      osc2.frequency.setValueAtTime(160, now);
      osc2.frequency.exponentialRampToValueAtTime(880, now + 0.55);
    } else {
      osc1.frequency.setValueAtTime(320, now);
      osc1.frequency.exponentialRampToValueAtTime(90, now + 0.35);
      osc2.frequency.setValueAtTime(640, now);
      osc2.frequency.exponentialRampToValueAtTime(180, now + 0.35);
    }

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(activating ? 2400 : 1200, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.68);
    osc2.stop(now + 0.68);
  }

  attachAudioElement(el: HTMLAudioElement) {
    this.audioEl = el;
    const ctx = this.ensureContext();
    if (!ctx || !this.eqNodes[0] || this.mediaSource) return;
    try {
      this.mediaSource = ctx.createMediaElementSource(el);
      this.mediaSource.connect(this.eqNodes[0]);
    } catch {
      // Element already connected or unsupported
    }
  }

  startSynthTrack(baseFreq: number, bpm: number, nightcore: boolean, spatial: boolean) {
    this.stopSynthTrack();
    const ctx = this.ensureContext();
    if (!ctx || !this.eqNodes[0]) return;

    this.synthPlaying = true;
    const effectiveBpm = nightcore ? bpm * 1.25 : bpm;
    const intervalMs = (60 / effectiveBpm / 2) * 1000;
    const scale = [1, 1.189, 1.335, 1.498, 1.782, 2];

    const triggerNote = () => {
      if (!this.synthPlaying || !this.ctx || !this.eqNodes[0]) return;
      const now = this.ctx.currentTime;
      const noteMul = scale[this.synthStep % scale.length];
      const freq = baseFreq * noteMul * (nightcore ? 1.15 : 1);

      const osc = this.ctx.createOscillator();
      const sub = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      const lp = this.ctx.createBiquadFilter();

      osc.type = this.synthStep % 4 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      sub.type = 'sine';
      sub.frequency.setValueAtTime(baseFreq * 0.5, now);

      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(spatial ? 1900 : 1100, now);
      lp.frequency.exponentialRampToValueAtTime(420, now + 0.25);

      noteGain.gain.setValueAtTime(0.0001, now);
      noteGain.gain.linearRampToValueAtTime(0.14, now + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      osc.connect(lp);
      if (this.synthStep % 2 === 0) sub.connect(lp);
      lp.connect(noteGain);
      noteGain.connect(this.eqNodes[0]);

      osc.start(now);
      sub.start(now);
      osc.stop(now + 0.3);
      sub.stop(now + 0.3);

      this.synthStep++;
    };

    triggerNote();
    this.synthTimer = window.setInterval(triggerNote, intervalMs);
  }

  stopSynthTrack() {
    this.synthPlaying = false;
    if (this.synthTimer !== null) {
      window.clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
    if (this.audioEl && !this.audioEl.paused) {
      this.audioEl.pause();
    }
  }
}

export const soundEngine = new NovaSoundEngine();
