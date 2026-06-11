
// Barrel file: maintains the existing `from '../utils/audioEngine'` import path
// so refactoring the internal layout under `utils/audio/` doesn't ripple through
// every component. New code should import directly from `utils/audio/*` instead.

export { getAudioContext, resumeAudio } from './audio/context';
export { NOTE_STRINGS, getNoteFromFrequency, autoCorrelate } from './audio/tuner';
export { PolySynth } from './audio/synth';
export { MetronomeEngine } from './audio/metronome';
export {
  playNotes,
  playScale,
  playChordProgression,
  playRhythmClick,
  playPitchTone,
  createPreviewOscillator,
  generateQuestion,
} from './audio/training';
