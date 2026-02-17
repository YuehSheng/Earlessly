
import { NoteName, TunerData, BeatIntensity, ChordQuality, IntervalQuality, EarTrainingSettings, Question } from '../types';

// --- Shared Context ---
let audioCtx: AudioContext | null = null;

export const getAudioContext = (): AudioContext => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

// --- Tuner Logic ---

export const NOTE_STRINGS = [
  NoteName.C, NoteName.CSharp, NoteName.D, NoteName.DSharp, NoteName.E,
  NoteName.F, NoteName.FSharp, NoteName.G, NoteName.GSharp, NoteName.A,
  NoteName.ASharp, NoteName.B
];

export const getNoteFromFrequency = (frequency: number): TunerData => {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return { note: NoteName.A, octave: 4, cents: 0, frequency: 440, isSilent: true };
  }
  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2)) + 69;
  const midi = Math.round(noteNum);
  const cents = Math.floor((noteNum - midi) * 100);
  
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  
  return {
    note: NOTE_STRINGS[noteIndex],
    octave,
    cents,
    frequency,
    isSilent: false
  };
};

export const autoCorrelate = (buf: Float32Array, sampleRate: number): number => {
  const SIZE = buf.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);
  let bestOffset = -1;
  let bestCorrelation = 0;
  let rms = 0;
  let foundGoodCorrelation = false;
  const correlations = new Float32Array(MAX_SAMPLES);

  for (let i = 0; i < SIZE; i++) {
    const val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  
  // Moderate threshold to filter noise while still detecting played notes
  if (rms < 0.01) return -1;

  let lastCorrelation = 1;
  
  for (let offset = 2; offset < MAX_SAMPLES - 1; offset++) {
    let correlation = 0;

    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs((buf[i]) - (buf[i + offset]));
    }
    correlation = 1 - (correlation / MAX_SAMPLES);
    correlations[offset] = correlation;

    if ((correlation > 0.9) && (correlation > lastCorrelation)) {
      foundGoodCorrelation = true;
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    } else if (foundGoodCorrelation) {
      const denom = (2 * correlations[bestOffset] - correlations[bestOffset + 1] - correlations[bestOffset - 1]);
      if (Math.abs(denom) < 0.0001) return sampleRate / (bestOffset || 1);
      const shift = (correlations[bestOffset + 1] - correlations[bestOffset - 1]) / (2 * denom);
      return sampleRate / (bestOffset + shift);
    }
    lastCorrelation = correlation;
  }
  if (bestCorrelation > 0.01 && bestOffset > 0) {
    return sampleRate / bestOffset;
  }
  return -1;
};

// --- Metronome Logic ---

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
  
  public setVolume(volume: number) {
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.masterGain.gain.setTargetAtTime(Math.max(0.0001, volume), this.ctx.currentTime, 0.02);
  }

  public start() {
    if (this.isPlaying) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
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
    this.nextNoteTime += this.stepInterval;
    this.currentStep++;
    if (this.currentStep >= this.grid.length) {
      this.currentStep = 0;
    }
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

// --- Keyboard / Synth Logic ---

export class PolySynth {
  private ctx: AudioContext;
  private activeNotes: Map<number, { osc: OscillatorNode, gain: GainNode, isStopped: boolean }> = new Map();
  private masterGain: GainNode;
  public decayMode: boolean = true;

  constructor() {
    this.ctx = getAudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);
  }

  public setVolume(volume: number) {
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.masterGain.gain.setTargetAtTime(Math.max(0.0001, volume), this.ctx.currentTime, 0.02);
  }

  public play(midi: number) {
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    
    // Clean up if already exists
    if (this.activeNotes.has(midi)) {
       this.stop(midi, true);
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    
    osc.frequency.value = freq;
    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(this.masterGain);

    const now = this.ctx.currentTime;
    
    const pivot = 60;
    const sensitivity = 0.012;
    let noteGain = 0.3 * (1 - (midi - pivot) * sensitivity);
    noteGain = Math.max(0.1, Math.min(0.6, noteGain));

    // Attack
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(noteGain, now + 0.02);

    if (this.decayMode) {
      // Natural Piano-like Decay
      gain.gain.setTargetAtTime(0.0001, now + 0.02, 0.8);
    }

    osc.start(now);
    
    const noteObj = { osc, gain, isStopped: false };
    this.activeNotes.set(midi, noteObj);

    // Safety timeout to prevent memory leak if stop is never called
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
      // Fast fade out
      gain.gain.setTargetAtTime(0.0001, now, immediate ? 0.01 : 0.05);
      
      const stopTime = immediate ? 0.05 : 0.3;
      osc.stop(now + stopTime);
    } catch (e) {
      // Catch potential InvalidStateErrors
    }

    this.activeNotes.delete(midi);
  }
  
  public stopAll() {
    this.activeNotes.forEach((_, midi) => this.stop(midi, true));
    this.activeNotes.clear();
  }
}

// --- Ear Training Logic ---

export const playNotes = (midiNotes: number[], duration: number = 1.0, type: 'simultaneous' | 'arpeggio' = 'simultaneous') => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  const arpGap = duration * 0.25;

  midiNotes.forEach((note, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const freq = 440 * Math.pow(2, (note - 69) / 12);
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const startTime = type === 'simultaneous' ? now : now + (index * arpGap);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.1);
    
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
    gain.gain.setTargetAtTime(0.0001, startTime + 0.05, duration * 0.3);
  });
};

export const generateQuestion = (settings: EarTrainingSettings): Question => {
  const candidates: number[] = [];
  const minMidi = (settings.octaveRange[0] + 1) * 12;
  const maxMidi = (settings.octaveRange[1] + 1) * 12 + 11;

  for (let m = minMidi; m <= maxMidi; m++) {
    const noteName = NOTE_STRINGS[((m % 12) + 12) % 12];
    if (settings.selectedNotes.includes(noteName)) {
      candidates.push(m);
    }
  }

  if (candidates.length === 0) candidates.push(60);

  if (settings.mode === 'interval') {
    const rootMidi = candidates[Math.floor(Math.random() * candidates.length)];
    const intervalList = settings.intervalQualities && settings.intervalQualities.length > 0 ? settings.intervalQualities : [IntervalQuality.P5];
    const quality = intervalList[Math.floor(Math.random() * intervalList.length)];
    
    let semitones = 7;
    switch (quality) {
      case IntervalQuality.m2: semitones = 1; break;
      case IntervalQuality.M2: semitones = 2; break;
      case IntervalQuality.m3: semitones = 3; break;
      case IntervalQuality.M3: semitones = 4; break;
      case IntervalQuality.P4: semitones = 5; break;
      case IntervalQuality.TT: semitones = 6; break;
      case IntervalQuality.P5: semitones = 7; break;
      case IntervalQuality.m6: semitones = 8; break;
      case IntervalQuality.M6: semitones = 9; break;
      case IntervalQuality.m7: semitones = 10; break;
      case IntervalQuality.M7: semitones = 11; break;
      case IntervalQuality.P8: semitones = 12; break;
    }
    
    const secondMidi = rootMidi + semitones;
    return {
      notes: [rootMidi, secondMidi],
      answerLabel: `${quality}`,
      answerNames: [quality]
    };
  }
  else if (settings.mode === 'note') {
    const numNotes = settings.polyphony || 1;
    const notes: number[] = [];
    const answerNames: string[] = [];
    const pool = [...candidates];
    for (let i = 0; i < numNotes; i++) {
      if (pool.length === 0) break;
      const idx = Math.floor(Math.random() * pool.length);
      const note = pool[idx];
      notes.push(note);
      pool.splice(idx, 1);
      const name = NOTE_STRINGS[((note % 12) + 12) % 12];
      if(!answerNames.includes(name)) answerNames.push(name);
    }
    notes.sort((a, b) => a - b);
    return {
      notes,
      answerLabel: notes.map(n => `${NOTE_STRINGS[((n%12)+12)%12]}${Math.floor(n/12)-1}`).join(', '),
      answerNames
    };
  }
  else {
    const rootMidi = candidates[Math.floor(Math.random() * candidates.length)];
    const chordList = settings.chordQualities && settings.chordQualities.length > 0 ? settings.chordQualities : [ChordQuality.MAJOR];
    const quality = chordList[Math.floor(Math.random() * chordList.length)];
    let intervals: number[] = [0, 4, 7];
    switch (quality) {
      case ChordQuality.MAJOR: intervals = [0, 4, 7]; break;
      case ChordQuality.MINOR: intervals = [0, 3, 7]; break;
      case ChordQuality.DIMINISHED: intervals = [0, 3, 6]; break;
      case ChordQuality.AUGMENTED: intervals = [0, 4, 8]; break;
      case ChordQuality.MAJOR_7: intervals = [0, 4, 7, 11]; break;
      case ChordQuality.MINOR_7: intervals = [0, 3, 7, 10]; break;
      case ChordQuality.DOMINANT_7: intervals = [0, 4, 7, 10]; break;
      case ChordQuality.HALF_DIM: intervals = [0, 3, 6, 10]; break;
      case ChordQuality.DIMINISHED_7: intervals = [0, 3, 6, 9]; break;
    }
    const notes = intervals.map(i => rootMidi + i);
    return {
      notes,
      answerLabel: `${NOTE_STRINGS[((rootMidi%12)+12)%12]} ${quality}`,
      answerNames: [quality]
    };
  }
};
