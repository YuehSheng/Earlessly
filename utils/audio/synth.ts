
import { getAudioContext, resumeAudio } from './context';
import { midiToFreq } from '../math';

interface ActiveNote {
  osc: OscillatorNode;
  gain: GainNode;
  isStopped: boolean;
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
    // Perceptual loudness compensation. Low notes need more amplitude than high
    // notes to sound equally loud (equal-loudness contours), and the keyboard's
    // default range sits at/above MIDI 60, so the old pivot of 60 barely boosted
    // the low end. Centre the curve mid-range and roll ~3.5 dB/octave: quieter
    // going up, louder going down, clamped so very low notes don't clip.
    const pivot = 72; // ~C5, middle of the usable range
    const dbPerOctave = 3.5;
    const db = ((pivot - midi) / 12) * dbPerOctave;
    let noteGain = 0.27 * Math.pow(10, db / 20);
    noteGain = Math.max(0.12, Math.min(0.6, noteGain));

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(noteGain, now + 0.02);

    if (this.decayMode) {
      gain.gain.setTargetAtTime(0.0001, now + 0.02, 0.8);
    }

    osc.start(now);

    const noteObj: ActiveNote = { osc, gain, isStopped: false };
    this.activeNotes.set(midi, noteObj);

    // Safety timeout: prevent memory leak if caller never invokes stop()
    if (this.decayMode) {
      setTimeout(() => {
        if (this.activeNotes.get(midi) === noteObj) {
          this.stop(midi, true);
        }
      }, 5000);
    }
  }

  public stop(midi: number, immediate: boolean = false) {
    const active = this.activeNotes.get(midi);
    if (!active || active.isStopped) return;
    const { osc, gain } = active;
    const now = this.ctx.currentTime;
    active.isStopped = true;

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
