
export enum Tab {
  TUNER = 'TUNER',
  METRONOME = 'METRONOME',
  EAR_TRAINING = 'EAR_TRAINING',
  KEYBOARD = 'KEYBOARD'
}

export enum NoteName {
  C = 'C',
  CSharp = 'C#',
  D = 'D',
  DSharp = 'D#',
  E = 'E',
  F = 'F',
  FSharp = 'F#',
  G = 'G',
  GSharp = 'G#',
  A = 'A',
  ASharp = 'A#',
  B = 'B'
}

export interface TunerData {
  note: NoteName;
  octave: number;
  cents: number;
  frequency: number;
  isSilent: boolean;
}

// Metronome Types
export enum BeatIntensity {
  MUTE = 0,
  WEAK = 1,
  STRONG = 2,
  POLY_A = 3,     // Rhythm A only
  POLY_B = 4,     // Rhythm B only
  POLY_BOTH = 5   // Both Rhythms coincide
}

export interface MetronomeState {
  bpm: number;
  isPlaying: boolean;
  beatsPerBar: number; // Numerator
  noteValue: number;   // Denominator
  subdivision: number; // 1 = quarter, 2 = 8th, 4 = 16th
  grid: BeatIntensity[];
}

export interface SpeedTrainerSettings {
  enabled: boolean;
  barCount: number;      // How many bars before increasing
  increment: number;     // How much BPM to add
  currentBarTracker: number; // Internal counter
}

// Ear Training Types
export enum ChordQuality {
  MAJOR = 'Major',
  MINOR = 'Minor',
  DIMINISHED = 'Diminished',
  AUGMENTED = 'Augmented',
  MAJOR_7 = 'Major 7',
  MINOR_7 = 'Minor 7',
  DOMINANT_7 = 'Dominant 7',
  HALF_DIM = 'm7b5',
  DIMINISHED_7 = 'Diminished 7'
}

export enum IntervalQuality {
  m2 = 'Minor 2nd',
  M2 = 'Major 2nd',
  m3 = 'Minor 3rd',
  M3 = 'Major 3rd',
  P4 = 'Perfect 4th',
  TT = 'Tritone',
  P5 = 'Perfect 5th',
  m6 = 'Minor 6th',
  M6 = 'Major 6th',
  m7 = 'Minor 7th',
  M7 = 'Major 7th',
  P8 = 'Octave'
}

export interface EarTrainingSettings {
  mode: 'note' | 'chord' | 'interval' | 'vocal'; 
  selectedNotes: NoteName[];
  octaveRange: [number, number]; // e.g., [3, 5]
  polyphony: number; // 1, 2, 3 for notes
  chordQualities: ChordQuality[];
  intervalQualities: IntervalQuality[]; 
}

export interface Question {
  notes: number[]; // MIDI numbers
  answerLabel: string; // "C Major" or "C4, E4"
  answerNames: string[]; // ["C", "E"] for checking multi-note answers
}
