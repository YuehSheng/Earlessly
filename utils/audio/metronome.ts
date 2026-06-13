
import { getAudioContext, resumeAudio } from './context';
import { BeatIntensity } from '../../types';

export class MetronomeEngine {
  private ctx: AudioContext;
  private isPlaying: boolean = false;
  private nextNoteTime: number = 0.0;
  private timerID: number | undefined;
  private lookahead: number = 25.0;
  private scheduleAheadTime: number = 0.1;
  private currentStep: number = 0;
  private bpm: number = 120;
  private grid: BeatIntensity[] = [];
  private onStep: (step: number) => void;
  public stepInterval: number = 0.5;
  private masterGain: GainNode;
  // Swing in [0, 0.5]. Lengthens even step intervals by (1+swing), shortens
  // odd ones by (1-swing). 0 = straight, 1/3 ≈ triplet feel, 0.5 = dotted.
  private swing: number = 0;

  constructor(onStepCallback: (step: number) => void) {
    this.ctx = getAudioContext();
    this.onStep = onStepCallback;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);
  }

  public setParams(bpm: number, grid: BeatIntensity[]) {
    this.bpm = bpm;
    this.grid = grid;
  }

  public setStepInterval(seconds: number) {
    this.stepInterval = Math.max(0.001, seconds);
  }

  public setSwing(swing: number) {
    this.swing = Math.max(0, Math.min(0.5, swing));
  }

  public setVolume(volume: number) {
    resumeAudio();
    this.masterGain.gain.setTargetAtTime(Math.max(0.0001, volume), this.ctx.currentTime, 0.02);
  }

  public start() {
    if (this.isPlaying) return;
    resumeAudio();
    this.isPlaying = true;
    this.currentStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.scheduler();
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerID) {
      window.clearTimeout(this.timerID);
      this.timerID = undefined;
    }
  }

  private scheduler() {
    if (!this.isPlaying) return;
    if (this.nextNoteTime < this.ctx.currentTime) {
      this.nextNoteTime = this.ctx.currentTime;
    }
    let iterations = 0;
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime && iterations < 100) {
      this.scheduleNote(this.currentStep, this.nextNoteTime);
      this.nextNote();
      iterations++;
    }
    this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
  }

  private nextNote() {
    if (this.swing > 0) {
      // Pair adjacent steps: even index gets the long half, odd gets the short.
      const factor = this.currentStep % 2 === 0 ? (1 + this.swing) : (1 - this.swing);
      this.nextNoteTime += this.stepInterval * factor;
    } else {
      this.nextNoteTime += this.stepInterval;
    }
    this.currentStep++;
    if (this.currentStep >= this.grid.length) this.currentStep = 0;
  }

  private scheduleNote(beatNumber: number, time: number) {
    const now = this.ctx.currentTime;
    const schedTime = Math.max(now, time);
    const drawTime = (schedTime - now) * 1000;

    setTimeout(() => {
      if (this.isPlaying) this.onStep(beatNumber);
    }, Math.max(0, drawTime));

    const intensity = this.grid[beatNumber];
    if (intensity === BeatIntensity.MUTE || !this.isPlaying) return;

    let freqs: number[] = [];
    let gainVal = 0.4;
    switch (intensity) {
      case BeatIntensity.STRONG: freqs = [1500]; gainVal = 1.0; break;
      case BeatIntensity.WEAK: freqs = [800]; gainVal = 0.4; break;
      case BeatIntensity.POLY_A: freqs = [600]; gainVal = 0.6; break;
      case BeatIntensity.POLY_B: freqs = [1200]; gainVal = 0.6; break;
      case BeatIntensity.POLY_BOTH: freqs = [600, 1200]; gainVal = 0.8; break;
      default: freqs = [800];
    }

    freqs.forEach(f => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.frequency.value = f;
      osc.type = f > 1000 ? 'triangle' : 'sine';
      gain.gain.setValueAtTime(0.0001, schedTime);
      gain.gain.linearRampToValueAtTime(gainVal, schedTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, schedTime + 0.05);
      osc.start(schedTime);
      osc.stop(schedTime + 0.06);
    });
  }
}
