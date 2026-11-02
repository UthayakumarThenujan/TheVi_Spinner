"use client";

import type { SpinnerSettings } from "@/types/spinner";

/**
 * Browser sound engine. Uses uploaded audio files when configured, otherwise
 * synthesizes short sounds with the Web Audio API (no binary assets needed).
 * Audio can only start after a user gesture — call `unlock()` from a click handler.
 */
const MUTE_KEY = "tvs_muted";

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private bgEl: HTMLAudioElement | null = null;
  private bgTimer: ReturnType<typeof setInterval> | null = null;
  private muted = false;

  constructor(private settings: SpinnerSettings) {
    try {
      this.muted = typeof window !== "undefined" && window.localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      this.muted = false;
    }
  }

  get isMuted() {
    return this.muted;
  }

  get enabled() {
    return this.settings.soundEnabled && !this.muted;
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      window.localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (m) this.stopBackground();
  }

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctor) this.ctx = new Ctor();
    }
    void this.ctx?.resume();
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.15) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur + 0.02);
  }

  private playUrl(url: string, volume = 0.8) {
    const a = new Audio(url);
    a.volume = volume;
    void a.play().catch(() => undefined);
    return a;
  }

  /** Short click as the pointer passes a segment boundary. */
  tick() {
    if (!this.enabled || !this.settings.spinSound) return;
    if (this.settings.spinSoundUrl) return; // custom spin sound plays once in spinStart()
    this.tone(1400 + Math.random() * 200, 0, 0.035, "square", 0.05);
  }

  spinStart() {
    if (!this.enabled || !this.settings.spinSound || !this.settings.spinSoundUrl) return;
    this.playUrl(this.settings.spinSoundUrl, 0.7);
  }

  win(isWin = true) {
    if (!this.enabled || !this.settings.winSound) return;
    if (this.settings.winSoundUrl) {
      this.playUrl(this.settings.winSoundUrl);
      return;
    }
    if (!isWin) {
      [392, 330, 262].forEach((f, i) => this.tone(f, i * 0.16, 0.22, "triangle", 0.12));
      return;
    }
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.tone(f, i * 0.11, 0.25, "triangle", 0.16));
    [1046.5, 1318.5, 1568].forEach((f) => this.tone(f, 0.5, 0.7, "sine", 0.08));
  }

  startBackground() {
    if (!this.enabled || !this.settings.backgroundMusic || this.bgEl || this.bgTimer) return;
    if (this.settings.backgroundMusicUrl) {
      this.bgEl = this.playUrl(this.settings.backgroundMusicUrl, 0.25);
      this.bgEl.loop = true;
      return;
    }
    // Gentle synthesized arpeggio loop
    const seq = [261.63, 329.63, 392, 523.25, 392, 329.63];
    let i = 0;
    this.bgTimer = setInterval(() => {
      this.tone(seq[i % seq.length], 0, 0.35, "sine", 0.035);
      i++;
    }, 380);
  }

  stopBackground() {
    if (this.bgEl) {
      this.bgEl.pause();
      this.bgEl = null;
    }
    if (this.bgTimer) {
      clearInterval(this.bgTimer);
      this.bgTimer = null;
    }
  }

  dispose() {
    this.stopBackground();
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
