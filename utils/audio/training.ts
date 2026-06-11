
import { getAudioContext, resumeAudio } from './context';
import { NOTE_STRINGS } from './tuner';
import { midiToFreq } from '../math';
import {
  ChordQuality, IntervalQuality, EarTrainingSettings, Question,
  ClassicEarTrainingMode,
} from '../../types';

// Common triangle-wave note with attack + decay envelope, used by playNotes / playScale / playChordProgression.
// Replaces ~60 lines of identical osc/gain/envelope setup that used to be duplicated across those three functions.
function playToneAt(
  ctx: AudioContext,
  midi: number,
  startTime: number,
  duration: number,
  peakGain: number,
  destination: AudioNode = ctx.destination,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = midiToFreq(midi);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.1);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.05);
  gain.gain.setTargetAtTime(0.0001, startTime + 0.05, duration * 0.3);
}

export const playNotes = (
  midiNotes: number[],
  duration: number = 1.0,
  type: 'simultaneous' | 'arpeggio' = 'simultaneous',
) => {
  const ctx = getAudioContext();
  resumeAudio();
  const now = ctx.currentTime;
  const arpGap = duration * 0.25;
  midiNotes.forEach((note, index) => {
    const startTime = type === 'simultaneous' ? now : now + index * arpGap;
    playToneAt(ctx, note, startTime, duration, 0.2);
  });
};

export const playScale = (
  rootMidi: number,
  intervals: number[],
  speed: number = 1.0,
  direction: 'up' | 'down' | 'updown' = 'up',
) => {
  const ctx = getAudioContext();
  resumeAudio();
  const now = ctx.currentTime;
  const gap = 0.25 * speed;

  let sequence = intervals.map(i => rootMidi + i);
  if (direction === 'down') sequence = [...sequence].reverse();
  else if (direction === 'updown') sequence = [...sequence, ...[...sequence].reverse().slice(1)];

  sequence.forEach((midi, index) => {
    playToneAt(ctx, midi, now + index * gap, gap, 0.2);
  });
};

export const playChordProgression = (
  chords: number[][],
  rootMidi: number,
  bpm: number = 90,
) => {
  const ctx = getAudioContext();
  resumeAudio();
  const now = ctx.currentTime;
  const chordDur = 60 / bpm;

  chords.forEach((chord, ci) => {
    const t = now + ci * chordDur;
    chord.forEach(semitone => playToneAt(ctx, rootMidi + semitone, t, chordDur, 0.18));
  });
};

export const playRhythmClick = (beats: number[], bpm: number, countIn: number = 4): Promise<void> => {
  const ctx = getAudioContext();
  resumeAudio();
  const now = ctx.currentTime;
  const beatDur = 60 / bpm;
  const barDur = 4 * beatDur;

  const clickAt = (time: number, freq: number, peak: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = freq > 1000 ? 'triangle' : 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
    osc.start(time);
    osc.stop(time + 0.09);
  };

  for (let i = 0; i < countIn; i++) {
    clickAt(now + i * beatDur, i === 0 ? 1500 : 800, i === 0 ? 0.5 : 0.3);
  }
  const patternStart = now + countIn * beatDur;
  beats.forEach(pos => clickAt(patternStart + pos * barDur, 1200, 0.4));

  const totalDur = (countIn * beatDur + barDur) * 1000;
  return new Promise(resolve => setTimeout(resolve, totalDur));
};

export const playPitchTone = (freq: number, duration: number = 2.5, volume: number = 0.5): void => {
  const ctx = getAudioContext();
  resumeAudio();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.05);
  gain.gain.setValueAtTime(volume * 0.4, now + duration - 0.15);
  gain.gain.linearRampToValueAtTime(0.0001, now + duration);

  osc.start(now);
  osc.stop(now + duration + 0.05);
};

export const createPreviewOscillator = (volume: number = 0.5) => {
  const ctx = getAudioContext();
  resumeAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 440;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume * 0.3, ctx.currentTime + 0.03);
  osc.start();

  return {
    setFrequency: (freq: number) => {
      osc.frequency.setTargetAtTime(
        Math.max(20, Math.min(20000, freq)),
        ctx.currentTime,
        0.015,
      );
    },
    stop: () => {
      const now = ctx.currentTime;
      gain.gain.setTargetAtTime(0.0001, now, 0.02);
      try { osc.stop(now + 0.08); } catch { /* already stopped */ }
    },
  };
};

const INTERVAL_SEMITONES: Record<IntervalQuality, number> = {
  [IntervalQuality.m2]: 1,
  [IntervalQuality.M2]: 2,
  [IntervalQuality.m3]: 3,
  [IntervalQuality.M3]: 4,
  [IntervalQuality.P4]: 5,
  [IntervalQuality.TT]: 6,
  [IntervalQuality.P5]: 7,
  [IntervalQuality.m6]: 8,
  [IntervalQuality.M6]: 9,
  [IntervalQuality.m7]: 10,
  [IntervalQuality.M7]: 11,
  [IntervalQuality.P8]: 12,
};

const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  [ChordQuality.MAJOR]: [0, 4, 7],
  [ChordQuality.MINOR]: [0, 3, 7],
  [ChordQuality.DIMINISHED]: [0, 3, 6],
  [ChordQuality.AUGMENTED]: [0, 4, 8],
  [ChordQuality.MAJOR_7]: [0, 4, 7, 11],
  [ChordQuality.MINOR_7]: [0, 3, 7, 10],
  [ChordQuality.DOMINANT_7]: [0, 4, 7, 10],
  [ChordQuality.HALF_DIM]: [0, 3, 6, 10],
  [ChordQuality.DIMINISHED_7]: [0, 3, 6, 9],
};

type GenerateSettings = Omit<EarTrainingSettings, 'mode'> & { mode: ClassicEarTrainingMode };

export const generateQuestion = (settings: GenerateSettings): Question => {
  const candidates: number[] = [];
  const minMidi = (settings.octaveRange[0] + 1) * 12;
  const maxMidi = (settings.octaveRange[1] + 1) * 12 + 11;

  for (let m = minMidi; m <= maxMidi; m++) {
    const noteName = NOTE_STRINGS[((m % 12) + 12) % 12];
    if (settings.selectedNotes.includes(noteName)) candidates.push(m);
  }
  if (candidates.length === 0) candidates.push(60);

  if (settings.mode === 'interval') {
    const rootMidi = candidates[Math.floor(Math.random() * candidates.length)];
    const intervalList = settings.intervalQualities.length > 0
      ? settings.intervalQualities
      : [IntervalQuality.P5];
    const quality = intervalList[Math.floor(Math.random() * intervalList.length)];
    const semitones = INTERVAL_SEMITONES[quality];
    const secondMidi = rootMidi + semitones;
    return {
      notes: [rootMidi, secondMidi],
      answerLabel: quality,
      answerNames: [quality],
    };
  }

  if (settings.mode === 'note' || settings.mode === 'vocal') {
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
      if (!answerNames.includes(name)) answerNames.push(name);
    }
    notes.sort((a, b) => a - b);
    return {
      notes,
      answerLabel: notes.map(n => `${NOTE_STRINGS[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`).join(', '),
      answerNames,
    };
  }

  // chord
  const rootMidi = candidates[Math.floor(Math.random() * candidates.length)];
  const chordList = settings.chordQualities.length > 0
    ? settings.chordQualities
    : [ChordQuality.MAJOR];
  const quality = chordList[Math.floor(Math.random() * chordList.length)];
  const intervals = CHORD_INTERVALS[quality];
  const notes = intervals.map(i => rootMidi + i);
  return {
    notes,
    answerLabel: `${NOTE_STRINGS[((rootMidi % 12) + 12) % 12]} ${quality}`,
    answerNames: [quality],
  };
};
