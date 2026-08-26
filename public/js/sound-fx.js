/**
 * Synthesized sound effects via Web Audio API (no audio files needed).
 */
/* eslint-env browser */
window.SoundFX = {
  ctx: null,
  muted: window.localStorage.getItem('tt-muted') === 'true',

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  tone(freq, duration, type, volume, delay) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const start = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume || 0.15, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  },

  sweep(fromFreq, toFreq, duration, type, volume) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const start = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sawtooth';
    osc.frequency.setValueAtTime(fromFreq, start);
    osc.frequency.exponentialRampToValueAtTime(toFreq, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume || 0.12, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  },

  select() {
    this.tone(520, 0.09, 'triangle', 0.18);
    this.tone(780, 0.07, 'sine', 0.1, 0.03);
  },

  deselect() {
    this.tone(420, 0.08, 'triangle', 0.12);
  },

  correct() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone(f, 0.16, 'sine', 0.16, i * 0.07);
    });
  },

  wrong() {
    this.sweep(220, 110, 0.3, 'sawtooth', 0.12);
    this.tone(160, 0.22, 'square', 0.06, 0.05);
  },

  already() {
    this.tone(440, 0.1, 'square', 0.08);
    this.tone(440, 0.12, 'square', 0.08, 0.14);
  },

  shuffle() {
    this.sweep(300, 900, 0.18, 'triangle', 0.1);
  },

  join() {
    this.tone(659.25, 0.12, 'sine', 0.14);
    this.tone(987.77, 0.18, 'sine', 0.14, 0.1);
  },

  tick() {
    this.tone(1200, 0.05, 'square', 0.05);
  },

  win() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      this.tone(f, 0.28, 'triangle', 0.16, i * 0.11);
    });
  },

  lose() {
    [392, 349.23, 293.66, 261.63].forEach((f, i) => {
      this.tone(f, 0.3, 'triangle', 0.13, i * 0.16);
    });
  },
};
