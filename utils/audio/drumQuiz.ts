
import { DrumVoice, DrumTrack, DrumMeter, meterSteps } from '../../types';
import { DRUM_VOICE_ORDER, DRUM_VOICE_LABELS } from './drums';

// ============================================================================
// Drum quiz (作答模式) — rhythm dictation on the step grid.
// The engine plays a target groove; the user reproduces it on the grid and
// submits to be scored. Difficulty scales by (a) how many voices are involved
// and (b) whether the pattern is a curated common groove or freshly randomised.
// Both 4/4 (16 steps) and 3/4 (12 steps, 三拍子) time signatures are supported.
// ============================================================================

export type QuizLevel = 1 | 2 | 3 | 4;

export interface QuizLevelDef {
  level: QuizLevel;
  label: string;
  hint: string;
  voices: DrumVoice[];
}

// Beginner → expert. Earlier levels use hand-picked real-world grooves so the
// ear has something familiar to latch onto; the top level goes random.
export const QUIZ_LEVELS: QuizLevelDef[] = [
  { level: 1, label: '入門', hint: '只有大鼓 · 常見節奏',  voices: ['kick'] },
  { level: 2, label: '基礎', hint: '大鼓 + 小鼓 · 基本鼓點', voices: ['kick', 'snare'] },
  { level: 3, label: '進階', hint: '加入 Hi-Hat · 完整律動', voices: ['kick', 'snare', 'closedHat'] },
  { level: 4, label: '挑戰', hint: '隨機切分 · 包含 Open Hat', voices: ['kick', 'snare', 'closedHat', 'openHat'] },
];

export const QUIZ_BPM = 96; // a comfortable, not-too-fast dictation tempo

// A user's (or target's) grid: every voice maps to a 12/16-step on/off array.
export type DrumAnswer = Record<DrumVoice, boolean[]>;

export interface DrumQuestion {
  level: QuizLevel;
  meter: DrumMeter;
  voices: DrumVoice[];          // the voices that actually matter this round
  pattern: DrumAnswer;          // the target groove
}

export interface QuizScore {
  correct: number;   // target cells the user got
  missed: number;    // target cells the user left empty
  wrong: number;     // cells the user added that aren't in the target
  total: number;     // total target cells
  accuracy: number;  // 0..100, intersection / union
  perfect: boolean;
}

export const emptyAnswer = (steps: number): DrumAnswer => {
  const a = {} as DrumAnswer;
  DRUM_VOICE_ORDER.forEach(v => { a[v] = new Array(steps).fill(false); });
  return a;
};

const fromIndices = (spec: Partial<Record<DrumVoice, number[]>>, steps: number): DrumAnswer => {
  const a = emptyAnswer(steps);
  (Object.keys(spec) as DrumVoice[]).forEach(v => {
    spec[v]!.forEach(i => { if (i < steps) a[v][i] = true; });
  });
  return a;
};

type GrooveSpec = Partial<Record<DrumVoice, number[]>>;

// --- Curated grooves --------------------------------------------------------
// Step 0 = beat 1. Levels 1–3 stay on the eighth-note grid so beginners can
// count without fighting sixteenth-note subdivisions.

// 4/4 hi-hat grids (16 steps).
const HAT8 = [0, 2, 4, 6, 8, 10, 12, 14];
const HAT4 = [0, 4, 8, 12];

const LEVEL1_44: GrooveSpec[] = [
  { kick: [0, 4, 8, 12] },   // four-on-the-floor
  { kick: [0, 8] },          // half notes
  { kick: [0, 4, 8] },       // three quarters
  { kick: [0, 8, 12] },
  { kick: [0, 4, 12] },
  { kick: [0, 2, 8, 10] },   // eighth pairs
  { kick: [0, 8, 14] },      // pickup into next bar
  { kick: [0, 6, 8] },       // "and" of beat 2
];

const LEVEL2_44: GrooveSpec[] = [
  { kick: [0, 8],        snare: [4, 12] },     // basic rock backbeat
  { kick: [0, 4, 8, 12], snare: [4, 12] },     // driving
  { kick: [0, 6, 8],     snare: [4, 12] },
  { kick: [0, 8, 10],    snare: [4, 12] },
  { kick: [0, 8, 14],    snare: [4, 12] },
  { kick: [0, 8],        snare: [4, 12, 14] }, // snare pickup
  { kick: [0, 2, 8],     snare: [4, 12] },
];

const LEVEL3_44: GrooveSpec[] = [
  { kick: [0, 8],        snare: [4, 12], closedHat: HAT8 }, // textbook rock beat
  { kick: [0, 4, 8, 12], snare: [4, 12], closedHat: HAT8 },
  { kick: [0, 6, 8],     snare: [4, 12], closedHat: HAT8 },
  { kick: [0, 8, 10],    snare: [4, 12], closedHat: HAT8 },
  { kick: [0, 8],        snare: [4, 12], closedHat: HAT4 }, // sparse hat
  { kick: [0, 8, 14],    snare: [4, 12], closedHat: HAT8 },
];

// 3/4 hi-hat grids (12 steps, 3 beats).
const HAT8_W = [0, 2, 4, 6, 8, 10];
const HAT4_W = [0, 4, 8];

// Waltz-flavoured grooves: kick on the downbeat, snare on beats 2 & 3.
const LEVEL1_34: GrooveSpec[] = [
  { kick: [0, 4, 8] },       // one per beat
  { kick: [0] },             // just beat 1
  { kick: [0, 8] },
  { kick: [0, 4] },
  { kick: [0, 6, 8] },
  { kick: [0, 2, 8, 10] },
];

const LEVEL2_34: GrooveSpec[] = [
  { kick: [0],     snare: [4, 8] },     // classic waltz "oom-pah-pah"
  { kick: [0, 4, 8], snare: [4, 8] },
  { kick: [0, 6],  snare: [4, 8] },
  { kick: [0, 8],  snare: [4] },
  { kick: [0],     snare: [4, 8, 10] }, // snare pickup
  { kick: [0, 2],  snare: [4, 8] },
];

const LEVEL3_34: GrooveSpec[] = [
  { kick: [0],     snare: [4, 8], closedHat: HAT8_W }, // waltz with eighth hats
  { kick: [0, 4, 8], snare: [4, 8], closedHat: HAT8_W },
  { kick: [0],     snare: [4, 8], closedHat: HAT4_W }, // hat on each beat
  { kick: [0, 6],  snare: [4, 8], closedHat: HAT8_W },
  { kick: [0, 8],  snare: [4],   closedHat: HAT8_W },
];

const BANKS: Record<DrumMeter, Record<1 | 2 | 3, GrooveSpec[]>> = {
  '4/4': { 1: LEVEL1_44, 2: LEVEL2_44, 3: LEVEL3_44 },
  '3/4': { 1: LEVEL1_34, 2: LEVEL2_34, 3: LEVEL3_34 },
};

const rand = (n: number) => Math.floor(Math.random() * n);

const pickN = (pool: number[], n: number): number[] => {
  const copy = [...pool];
  const out: number[] = [];
  for (let i = 0; i < n && copy.length; i++) out.push(copy.splice(rand(copy.length), 1)[0]);
  return out;
};

// Level 4: semi-structured randomness. Snare keeps a recognisable backbeat,
// kick gets a few extra hits (incl. sixteenths), hat thins out and an open-hat
// accent may land off-beat. Hit counts are capped so it stays transcribable.
const genRandom = (meter: DrumMeter): DrumAnswer => {
  const steps = meterSteps(meter);
  const a = emptyAnswer(steps);

  if (meter === '4/4') {
    a.snare[4] = true;
    a.snare[12] = true;
    if (Math.random() < 0.3) a.snare[Math.random() < 0.5 ? 7 : 15] = true;
    a.kick[0] = true;
    pickN([2, 3, 6, 8, 10, 11, 14], 2 + rand(3)).forEach(i => { a.kick[i] = true; });
    HAT8.forEach(i => { if (Math.random() < 0.8) a.closedHat[i] = true; });
    if (Math.random() < 0.6) a.openHat[[2, 6, 10, 14][rand(4)]] = true;
  } else {
    // 3/4: snare on beats 2 & 3, kick on the downbeat plus a couple of moves.
    a.snare[4] = true;
    a.snare[8] = true;
    if (Math.random() < 0.3) a.snare[Math.random() < 0.5 ? 6 : 11] = true;
    a.kick[0] = true;
    pickN([2, 3, 6, 9, 10], 1 + rand(2)).forEach(i => { a.kick[i] = true; });
    HAT8_W.forEach(i => { if (Math.random() < 0.8) a.closedHat[i] = true; });
    if (Math.random() < 0.6) a.openHat[[2, 6, 10][rand(3)]] = true;
  }
  return a;
};

const patternKey = (a: DrumAnswer, voices: DrumVoice[]) =>
  voices.map(v => a[v].map(s => (s ? '1' : '0')).join('')).join('|');

export const generateQuestion = (level: QuizLevel, meter: DrumMeter, prev?: DrumQuestion | null): DrumQuestion => {
  const def = QUIZ_LEVELS.find(l => l.level === level)!;
  const steps = meterSteps(meter);
  const make = (): DrumAnswer => {
    if (level === 4) return genRandom(meter);
    return fromIndices(BANKS[meter][level][rand(BANKS[meter][level].length)], steps);
  };

  // Avoid handing back the exact same groove twice in a row.
  let pattern = make();
  if (prev && prev.level === level && prev.meter === meter) {
    for (let tries = 0; tries < 6 && patternKey(pattern, def.voices) === patternKey(prev.pattern, def.voices); tries++) {
      pattern = make();
    }
  }
  return { level, meter, voices: def.voices, pattern };
};

export const scoreAnswer = (q: DrumQuestion, ans: DrumAnswer): QuizScore => {
  let correct = 0, missed = 0, wrong = 0, total = 0;
  const steps = q.pattern[q.voices[0]].length;
  q.voices.forEach(v => {
    for (let i = 0; i < steps; i++) {
      const t = q.pattern[v][i];
      const u = ans[v][i];
      if (t) total++;
      if (t && u) correct++;
      else if (t && !u) missed++;
      else if (!t && u) wrong++;
    }
  });
  const union = correct + missed + wrong;
  const accuracy = union === 0 ? 100 : Math.round((correct / union) * 100);
  return { correct, missed, wrong, total, accuracy, perfect: missed === 0 && wrong === 0 };
};

// Build engine-ready tracks from a grid (the target groove or the user's answer).
export const toTracks = (grid: DrumAnswer, voices: DrumVoice[]): DrumTrack[] =>
  voices.map(v => ({
    voice: v,
    label: DRUM_VOICE_LABELS[v],
    volume: 0.85,
    muted: false,
    steps: grid[v],
  }));
