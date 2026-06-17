
import { getAudioContext, resumeAudio } from './context';
import { DRUM_PLAYERS } from './drums';
import { DrumTrack, DRUM_STEPS } from '../../types';

// How many steps the current pattern spans (12 for 3/4, 16 for 4/4). Derived
// from the live tracks so the scheduler follows the active time signature.

// 16-step / 1-bar lookahead scheduler, mirrored on MetronomeEngine for accuracy.
export class DrumMachineEngine {
  private ctx: AudioContext;
  private isPlaying = false;
  private nextStepTime = 0;
  private timerID: number | undefined;
  private lookahead = 25; // ms between scheduler runs
  private scheduleAhead = 0.1; // seconds of audio scheduled in advance
  private currentStep = 0;
  private bpm = 120;
  private swing = 0;
  // Per-step subdivision lookup (cells-per-beat for the beat each step sits in),
  // so step duration follows mixed subdivisions across the bar.
  private stepSubdiv: number[] = [];
  private tracks: DrumTrack[] = [];
  private masterGain: GainNode;
  private onStep: (step: number) => void;
  // Snapshot whether anything is solo'd; muted tracks still play if solo is off elsewhere.
  private anySolo = false;
  private soloMask: boolean[] = [];

  constructor(onStep: (step: number) => void) {
    this.ctx = getAudioContext();
    this.onStep = onStep;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.ctx.destination);
  }

  public setVolume(v: number) {
    resumeAudio();
    this.masterGain.gain.setTargetAtTime(Math.max(0.0001, v), this.ctx.currentTime, 0.02);
  }

  public setParams(bpm: number, swing: number, tracks: DrumTrack[], soloMask: boolean[], subdivisions: number[] = []) {
    this.bpm = bpm;
    this.swing = Math.max(0, Math.min(0.5, swing));
    this.tracks = tracks;
    this.soloMask = soloMask;
    this.anySolo = soloMask.some(Boolean);
    this.stepSubdiv = this.buildStepSubdiv(subdivisions, tracks[0]?.steps.length ?? 16);
  }

  // Expand per-beat subdivisions into a per-step array. Falls back to a uniform
  // 4 (straight sixteenths) when no layout is supplied (e.g. the quiz engine).
  private buildStepSubdiv(subdivisions: number[], total: number): number[] {
    if (!subdivisions.length) return new Array(total).fill(4);
    const arr: number[] = [];
    subdivisions.forEach(s => { for (let k = 0; k < s; k++) arr.push(s); });
    return arr;
  }

  public start() {
    if (this.isPlaying) return;
    resumeAudio();
    this.isPlaying = true;
    this.currentStep = 0;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.scheduler();
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerID !== undefined) {
      window.clearTimeout(this.timerID);
      this.timerID = undefined;
    }
  }

  // Release the master GainNode so re-mounting the component doesn't pile them
  // onto ctx.destination forever.
  public destroy() {
    this.stop();
    try { this.masterGain.disconnect(); } catch { /* already disconnected */ }
  }

  private stepCount(): number {
    return this.tracks[0]?.steps.length || DRUM_STEPS;
  }

  private stepInterval(): number {
    // One beat = 60/bpm; the current step's beat is split into N cells.
    const sub = this.stepSubdiv[this.currentStep] ?? 4;
    return (60 / this.bpm) / sub;
  }

  private advance() {
    const base = this.stepInterval();
    if (this.swing > 0) {
      const factor = this.currentStep % 2 === 0 ? (1 + this.swing) : (1 - this.swing);
      this.nextStepTime += base * factor;
    } else {
      this.nextStepTime += base;
    }
    this.currentStep = (this.currentStep + 1) % this.stepCount();
  }

  private scheduler() {
    if (!this.isPlaying) return;
    if (this.nextStepTime < this.ctx.currentTime) this.nextStepTime = this.ctx.currentTime;

    let safety = 0;
    while (this.nextStepTime < this.ctx.currentTime + this.scheduleAhead && safety < 64) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advance();
      safety++;
    }
    this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
  }

  private scheduleStep(step: number, time: number) {
    const now = this.ctx.currentTime;
    const visualDelay = Math.max(0, (time - now) * 1000);
    setTimeout(() => { if (this.isPlaying) this.onStep(step); }, visualDelay);

    for (let i = 0; i < this.tracks.length; i++) {
      const tr = this.tracks[i];
      if (!tr.steps[step]) continue;
      // Solo gating: if any track is solo'd, only those play.
      if (this.anySolo) {
        if (!this.soloMask[i]) continue;
      } else if (tr.muted) {
        continue;
      }
      const player = DRUM_PLAYERS[tr.voice];
      player(this.ctx, time, this.masterGain, tr.volume);
    }
  }
}
