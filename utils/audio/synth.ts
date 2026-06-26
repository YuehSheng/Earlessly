
import { getAudioContext, resumeAudio } from './context';
import { midiToFreq } from '../math';

interface ActiveNote {
  osc: OscillatorNode;
  gain: GainNode;
  isStopped: boolean;
  safetyTimerId: number;
}

export class PolySynth {
  private ctx: AudioContext;
  private activeNotes: Map<number, ActiveNote> = new Map();
  private masterGain: GainNode;
  public decayMode: boolean = true;

  constructor() {
    this.ctx = getAudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);
  }

  public setVolume(volume: number) {
    resumeAudio();
    this.masterGain.gain.setTargetAtTime(Math.max(0.0001, volume), this.ctx.currentTime, 0.02);
  }

  public play(midi: number) {
    resumeAudio();

    if (this.activeNotes.has(midi)) {
      this.stop(midi, true);
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = midiToFreq(midi);
    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(this.masterGain);

    const now = this.ctx.currentTime;
    const pivot = 60;
    const sensitivity = 0.012;
    let noteGain = 0.3 * (1 - (midi - pivot) * sensitivity);
    noteGain = Math.max(0.1, Math.min(0.6, noteGain));

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(noteGain, now + 0.02);

    if (this.decayMode) {
      gain.gain.setTargetAtTime(0.0001, now + 0.02, 0.8);
    }

    osc.start(now);

    const noteObj: ActiveNote = { osc, gain, isStopped: false, safetyTimerId: 0 };
    this.activeNotes.set(midi, noteObj);

    // Safety timeout: prevent memory leak if caller never invokes stop().
    // decay 模式音量很快衰減，5 秒即可回收；sustain 模式給較長保護避免誤切。
    const safetyMs = this.decayMode ? 5000 : 10000;
    noteObj.safetyTimerId = window.setTimeout(() => {
      if (this.activeNotes.get(midi) === noteObj) {
        this.stop(midi, true);
      }
    }, safetyMs);
  }

  public stop(midi: number, immediate: boolean = false) {
    const active = this.activeNotes.get(midi);
    if (!active || active.isStopped) return;
    const { osc, gain } = active;
    const now = this.ctx.currentTime;
    active.isStopped = true;
    clearTimeout(active.safetyTimerId);

    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.0001, now, immediate ? 0.01 : 0.05);
      osc.stop(now + (immediate ? 0.05 : 0.3));
    } catch { /* InvalidStateError if already stopped */ }

    this.activeNotes.delete(midi);
  }

  public stopAll() {
    this.activeNotes.forEach((_, midi) => this.stop(midi, true));
    this.activeNotes.clear();
  }
}
