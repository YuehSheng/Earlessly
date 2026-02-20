
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

// Scale Training Types
export enum ScaleType {
  MAJOR = 'Major',
  NATURAL_MINOR = 'Natural Minor',
  HARMONIC_MINOR = 'Harmonic Minor',
  MELODIC_MINOR = 'Melodic Minor',
  DORIAN = 'Dorian',
  PHRYGIAN = 'Phrygian',
  LYDIAN = 'Lydian',
  MIXOLYDIAN = 'Mixolydian',
  PENTATONIC_MAJOR = 'Pentatonic Maj',
  PENTATONIC_MINOR = 'Pentatonic Min',
  BLUES = 'Blues',
  WHOLE_TONE = 'Whole Tone',
}

export const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  [ScaleType.MAJOR]:            [0, 2, 4, 5, 7, 9, 11, 12],
  [ScaleType.NATURAL_MINOR]:    [0, 2, 3, 5, 7, 8, 10, 12],
  [ScaleType.HARMONIC_MINOR]:   [0, 2, 3, 5, 7, 8, 11, 12],
  [ScaleType.MELODIC_MINOR]:    [0, 2, 3, 5, 7, 9, 11, 12],
  [ScaleType.DORIAN]:           [0, 2, 3, 5, 7, 9, 10, 12],
  [ScaleType.PHRYGIAN]:         [0, 1, 3, 5, 7, 8, 10, 12],
  [ScaleType.LYDIAN]:           [0, 2, 4, 6, 7, 9, 11, 12],
  [ScaleType.MIXOLYDIAN]:       [0, 2, 4, 5, 7, 9, 10, 12],
  [ScaleType.PENTATONIC_MAJOR]: [0, 2, 4, 7, 9, 12],
  [ScaleType.PENTATONIC_MINOR]: [0, 3, 5, 7, 10, 12],
  [ScaleType.BLUES]:            [0, 3, 5, 6, 7, 10, 12],
  [ScaleType.WHOLE_TONE]:       [0, 2, 4, 6, 8, 10, 12],
};

// Chord Progression Types
export interface ProgressionDef {
  id: string;
  label: string;
  degrees: number[][]; // each chord = array of semitone offsets from tonic
  romanNumerals: string[];
}

export const PROGRESSIONS: ProgressionDef[] = [
  { id: 'I_IV_V_I',     label: 'I - IV - V - I',        romanNumerals: ['I','IV','V','I'],       degrees: [[0,4,7],[5,9,12],[7,11,14],[12,16,19]] },
  { id: 'I_V_vi_IV',    label: 'I - V - vi - IV',       romanNumerals: ['I','V','vi','IV'],      degrees: [[0,4,7],[7,11,14],[9,12,16],[5,9,12]] },
  { id: 'ii_V_I',       label: 'ii - V - I',            romanNumerals: ['ii','V','I'],           degrees: [[2,5,9],[7,11,14],[12,16,19]] },
  { id: 'I_vi_IV_V',    label: 'I - vi - IV - V',       romanNumerals: ['I','vi','IV','V'],      degrees: [[0,4,7],[9,12,16],[5,9,12],[7,11,14]] },
  { id: 'vi_IV_I_V',    label: 'vi - IV - I - V',       romanNumerals: ['vi','IV','I','V'],      degrees: [[9,12,16],[5,9,12],[0,4,7],[7,11,14]] },
  { id: 'I_IV_vi_V',    label: 'I - IV - vi - V',       romanNumerals: ['I','IV','vi','V'],      degrees: [[0,4,7],[5,9,12],[9,12,16],[7,11,14]] },
  { id: 'I_V_IV_I',     label: 'I - V - IV - I',        romanNumerals: ['I','V','IV','I'],       degrees: [[0,4,7],[7,11,14],[5,9,12],[12,16,19]] },
  { id: 'i_bVI_bIII_bVII', label: 'i - bVI - bIII - bVII', romanNumerals: ['i','bVI','bIII','bVII'], degrees: [[0,3,7],[8,12,15],[3,7,10],[10,14,17]] },
  { id: 'i_iv_V_i',     label: 'i - iv - V - i',        romanNumerals: ['i','iv','V','i'],       degrees: [[0,3,7],[5,8,12],[7,11,14],[12,15,19]] },
  { id: 'I_ii_V_I',     label: 'I - ii - V - I',        romanNumerals: ['I','ii','V','I'],       degrees: [[0,4,7],[2,5,9],[7,11,14],[12,16,19]] },
  { id: 'ii_V_I_vi',    label: 'ii - V - I - vi',       romanNumerals: ['ii','V','I','vi'],      degrees: [[2,5,9],[7,11,14],[12,16,19],[9,12,16]] },
  { id: 'I_bVII_IV_I',  label: 'I - bVII - IV - I',     romanNumerals: ['I','bVII','IV','I'],    degrees: [[0,4,7],[10,14,17],[5,9,12],[12,16,19]] },
];

// Rhythm Training Types
export type RhythmDifficulty = 'easy' | 'medium' | 'hard';
export type RhythmMode = 'tap' | 'dictation';

export interface RhythmCell {
  id: string;     // 'q' | 'e' | 'dq' | 'h' | 'w' | 's' | 'qr' | 'er' | 'hr'
  label: string;  // display symbol
  value: number;  // fraction of a bar (quarter = 0.25)
  isRest?: boolean;
}

export interface RhythmPattern {
  beats: number[]; // normalized positions 0~1 within a bar
  label: string;
  cells?: string[]; // RhythmCell.id sequence for dictation answer
}
