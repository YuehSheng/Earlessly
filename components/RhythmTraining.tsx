
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Settings, Play, RotateCcw, Disc, CheckCircle, SkipForward, Volume2, Trash2, PenLine } from 'lucide-react';
import { getAudioContext } from '../utils/audioEngine';
import { RhythmDifficulty, RhythmPattern, RhythmCell, RhythmMode } from '../types';

// ── Rhythm Cell Library ─────────────────────────────────────────────────────

const RHYTHM_CELLS: RhythmCell[] = [
  { id: 'w',  label: '𝅝',  value: 1.0 },
  { id: 'h',  label: '𝅗𝅥',  value: 0.5 },
  { id: 'dq', label: '♩.', value: 0.375 },
  { id: 'q',  label: '♩',  value: 0.25 },
  { id: 'e',  label: '♪',  value: 0.125 },
  { id: 's',  label: '♬',  value: 0.0625 },
  { id: 'hr', label: '𝄻',  value: 0.5, isRest: true },
  { id: 'qr', label: '𝄾',  value: 0.25, isRest: true },
  { id: 'er', label: '𝄿',  value: 0.125, isRest: true },
];

const CELL_MAP = Object.fromEntries(RHYTHM_CELLS.map(c => [c.id, c]));

// ── Rhythm Pattern Library ──────────────────────────────────────────────────

const PATTERNS: Record<RhythmDifficulty, RhythmPattern[]> = {
  easy: [
    { beats: [0, 0.25, 0.5, 0.75], label: '♩♩♩♩',   cells: ['q','q','q','q'] },
    { beats: [0, 0.5],             label: '𝅗𝅥 𝅗𝅥',    cells: ['h','h'] },
    { beats: [0, 0.25, 0.5],       label: '♩♩𝅗𝅥',     cells: ['q','q','h'] },
    { beats: [0, 0.5, 0.75],       label: '𝅗𝅥 ♩♩',    cells: ['h','q','q'] },
    { beats: [0, 0.25, 0.75],      label: '♩𝅗𝅥 ♩',    cells: ['q','h','q'] },
    { beats: [0],                   label: '𝅝',        cells: ['w'] },
  ],
  medium: [
    { beats: [0, 0.125, 0.25, 0.5, 0.75],       label: '♪♪♩♩♩',     cells: ['e','e','q','q','q'] },
    { beats: [0, 0.25, 0.375, 0.5, 0.75],        label: '♩♪♪♩♩',     cells: ['q','e','e','q','q'] },
    { beats: [0, 0.25, 0.5, 0.625, 0.75],        label: '♩♩♪♪♩',     cells: ['q','q','e','e','q'] },
    { beats: [0, 0.375, 0.5, 0.75],              label: '♩.♪♩♩',     cells: ['dq','e','q','q'] },
    { beats: [0, 0.25, 0.5, 0.875],              label: '♩♩♩.♪',     cells: ['q','q','dq','e'] },
    { beats: [0, 0.125, 0.25, 0.375, 0.5, 0.75], label: '♪♪♪♪♩♩',   cells: ['e','e','e','e','q','q'] },
    { beats: [0, 0.25, 0.5, 0.625, 0.875],       label: '♩♩♪♩♪',     cells: ['q','q','e','q','e'] },
  ],
  hard: [
    { beats: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875], label: '♪♪♪♪♪♪♪♪',  cells: ['e','e','e','e','e','e','e','e'] },
    { beats: [0, 0.125, 0.375, 0.5, 0.75],                       label: '♪♩♪♩♩',      cells: ['e','q','e','q','q'] },
    { beats: [0, 0.25, 0.375, 0.625, 0.75],                      label: '♩♪♩♪♩',      cells: ['q','e','q','e','q'] },
    { beats: [0, 0.125, 0.25, 0.5, 0.625, 0.875],                label: '♪♪♩♪♩♪',     cells: ['e','e','q','e','q','e'] },
    { beats: [0.125, 0.375, 0.5, 0.75],                          label: '𝄿♩♪♩♩',      cells: ['er','q','e','q','q'] },
  ],
};

const DIFF_CFG: Record<RhythmDifficulty, { label: string; desc: string; tolerance: number }> = {
  easy:   { label: '簡單', desc: '四分 / 二分音符', tolerance: 100 },
  medium: { label: '中等', desc: '加入八分 / 附點', tolerance: 80 },
  hard:   { label: '困難', desc: '十六分 / 切分 / 休止', tolerance: 65 },
};

// Cells available per difficulty
const DIFF_CELLS: Record<RhythmDifficulty, string[]> = {
  easy:   ['w', 'h', 'q'],
  medium: ['w', 'h', 'dq', 'q', 'e', 'qr', 'er'],
  hard:   ['w', 'h', 'dq', 'q', 'e', 's', 'hr', 'qr', 'er'],
};

type Phase = 'idle' | 'countIn' | 'playing' | 'recording' | 'dictation' | 'result';

interface Props { onBack: () => void; volume?: number; }

// ── Component ───────────────────────────────────────────────────────────────

const RhythmTraining: React.FC<Props> = ({ onBack, volume = 0.5 }) => {
  const [rhythmMode, setRhythmMode] = useState<RhythmMode>('tap');
  const [difficulty, setDifficulty] = useState<RhythmDifficulty>('easy');
  const [bpm, setBpm] = useState(90);
  const [phase, setPhase] = useState<Phase>('idle');
  const [pattern, setPattern] = useState<RhythmPattern | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [tapResults, setTapResults] = useState<{ offset: number; hit: boolean }[]>([]);

  // Dictation state
  const [userCells, setUserCells] = useState<string[]>([]);
  const [dictationResult, setDictationResult] = useState<boolean[] | null>(null);

  // Replay state: normalized beat positions for user's answer
  const [userBeatsNorm, setUserBeatsNorm] = useState<number[]>([]);
  const [isReplaying, setIsReplaying] = useState(false);
  const isReplayingRef = useRef(false);

  const userTapsRef = useRef<number[]>([]);
  const patternStartRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerListRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const beatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>('idle');

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const cleanup = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); }
    timerListRef.current.forEach(t => clearTimeout(t));
    timerListRef.current = [];
    if (beatTimerRef.current) { clearInterval(beatTimerRef.current); }
    isReplayingRef.current = false;
    setIsReplaying(false);
  }, []);

  useEffect(() => () => { cleanup(); }, [cleanup]);

  const playClick = useCallback((freq: number, gain: number) => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = freq > 1000 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      osc.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(Math.min(0.5, gain * volume), now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {
      console.error('playClick error:', e);
    }
  }, [volume]);

  // Play pattern audio (shared between tap & dictation)
  const playPatternAudio = useCallback((pat: RhythmPattern) => {
    cleanup();
    const ctx = getAudioContext();
    ctx.resume().catch(() => {});

    const beatDur = 60 / bpm;
    const countInBeats = 4;
    const barDur = 4 * beatDur;

    setPhase('countIn');
    setCurrentBeat(-1);

    // Schedule count-in
    for (let i = 0; i < countInBeats; i++) {
      const timer = setTimeout(() => {
        playClick(i === 0 ? 1500 : 800, i === 0 ? 0.5 : 0.3);
        setCurrentBeat(i);
      }, i * beatDur * 1000);
      timerListRef.current.push(timer);
    }

    // After count-in, play pattern
    const patternStartTime = countInBeats * beatDur * 1000;
    timerRef.current = setTimeout(() => {
      setPhase('playing');
      setCurrentBeat(-1);

      pat.beats.forEach((pos, idx) => {
        const delayMs = pos * barDur * 1000;
        const timer = setTimeout(() => {
          if (phaseRef.current === 'playing' || phaseRef.current === 'recording') {
            playClick(1200, 0.4);
            setCurrentBeat(idx);
          }
        }, Math.max(50, delayMs));
        timerListRef.current.push(timer);
      });

      return barDur * 1000;
    }, patternStartTime);

    return { beatDur, barDur, patternStartTime };
  }, [bpm, playClick, cleanup]);

  const start = useCallback(() => {
    cleanup();
    const ctx = getAudioContext();
    ctx.resume().catch(() => {});

    const pool = PATTERNS[difficulty].filter(p => rhythmMode === 'tap' || p.cells);
    const pat = pool[Math.floor(Math.random() * pool.length)];
    setPattern(pat);
    setScore(null);
    setTapResults([]);
    setDictationResult(null);
    setUserCells([]);
    userTapsRef.current = [];
    setCurrentBeat(-1);

    const beatDur = 60 / bpm;
    const countInBeats = 4;
    const barDur = 4 * beatDur;

    setPhase('countIn');

    // Schedule count-in
    for (let i = 0; i < countInBeats; i++) {
      const timer = setTimeout(() => {
        playClick(i === 0 ? 1500 : 800, i === 0 ? 0.5 : 0.3);
        setCurrentBeat(i);
      }, i * beatDur * 1000);
      timerListRef.current.push(timer);
    }

    // After count-in, play pattern
    const patternStartTime = countInBeats * beatDur * 1000;
    timerRef.current = setTimeout(() => {
      setPhase('playing');
      setCurrentBeat(-1);

      pat.beats.forEach((pos, idx) => {
        const delayMs = pos * barDur * 1000;
        const timer = setTimeout(() => {
          if (phaseRef.current === 'playing' || phaseRef.current === 'recording') {
            playClick(1200, 0.4);
            setCurrentBeat(idx);
          }
        }, Math.max(50, delayMs));
        timerListRef.current.push(timer);
      });

      const patternDur = barDur * 1000;

      if (rhythmMode === 'tap') {
        // Tap mode: switch to recording after pattern
        timerRef.current = setTimeout(() => {
          setPhase('recording');
          setCurrentBeat(-1);

          // Calculate recording start time NOW (mathematically), don't rely on setTimeout precision
          const countInDurationMs = countInBeats * beatDur * 1000;
          patternStartRef.current = performance.now() + countInDurationMs;
          userTapsRef.current = [];

          for (let i = 0; i < countInBeats; i++) {
            const timer = setTimeout(() => {
              playClick(i === 0 ? 1500 : 800, i === 0 ? 0.4 : 0.2);
              setCurrentBeat(i);
            }, i * beatDur * 1000);
            timerListRef.current.push(timer);
          }

          // After count-in: just reset beat indicator & schedule end
          const timer = setTimeout(() => {
            setCurrentBeat(-1);

            const recordingTimer = setTimeout(() => {
              setPhase('result');
              evaluateTaps(pat);
            }, barDur * 1000 + 200);
            timerListRef.current.push(recordingTimer);
          }, countInDurationMs);
          timerListRef.current.push(timer);
        }, patternDur);
      } else {
        // Dictation mode: switch to dictation after pattern finishes
        timerRef.current = setTimeout(() => {
          setPhase('dictation');
          setCurrentBeat(-1);
        }, patternDur);
      }

    }, patternStartTime);

  }, [difficulty, bpm, playClick, rhythmMode, cleanup]);

  // Replay pattern during dictation
  const replay = useCallback(() => {
    if (!pattern || (phase !== 'dictation' && phase !== 'idle')) return;
    cleanup();
    const ctx = getAudioContext();
    ctx.resume().catch(() => {});

    const beatDur = 60 / bpm;
    const barDur = 4 * beatDur;
    const countInBeats = 4;

    setPhase('countIn');
    setCurrentBeat(-1);

    for (let i = 0; i < countInBeats; i++) {
      const timer = setTimeout(() => {
        playClick(i === 0 ? 1500 : 800, i === 0 ? 0.5 : 0.3);
        setCurrentBeat(i);
      }, i * beatDur * 1000);
      timerListRef.current.push(timer);
    }

    const patternStartTime = countInBeats * beatDur * 1000;
    timerRef.current = setTimeout(() => {
      setPhase('playing');
      setCurrentBeat(-1);

      pattern.beats.forEach((pos, idx) => {
        const delayMs = pos * barDur * 1000;
        const timer = setTimeout(() => {
          if (phaseRef.current === 'playing') {
            playClick(1200, 0.4);
            setCurrentBeat(idx);
          }
        }, Math.max(50, delayMs));
        timerListRef.current.push(timer);
      });

      const patternDur = barDur * 1000;
      timerRef.current = setTimeout(() => {
        setPhase('dictation');
        setCurrentBeat(-1);
      }, patternDur);
    }, patternStartTime);
  }, [pattern, phase, bpm, playClick, cleanup]);

  const handleTap = useCallback(() => {
    if (phaseRef.current !== 'recording') return;
    const now = performance.now();
    // Allow taps up to 1 tolerance-window early, ignore anything earlier (count-in taps)
    const tolerance = DIFF_CFG[difficulty].tolerance;
    if (now < patternStartRef.current - tolerance) return;
    userTapsRef.current.push(now);
    playClick(1000, 0.25);
  }, [playClick, difficulty]);

  const evaluateTaps = useCallback((pat: RhythmPattern) => {
    const barDur = 4 * (60 / bpm) * 1000;
    const tolerance = DIFF_CFG[difficulty].tolerance;
    const taps = userTapsRef.current;
    const startTime = patternStartRef.current;

    const targetTimes = pat.beats.map(pos => pos * barDur);
    const tapTimes = taps.map(t => t - startTime);

    const results: { offset: number; hit: boolean }[] = [];
    const usedTaps = new Set<number>();

    targetTimes.forEach(target => {
      let bestIdx = -1;
      let bestDist = Infinity;
      tapTimes.forEach((tap, i) => {
        if (usedTaps.has(i)) return;
        const dist = Math.abs(tap - target);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      });
      if (bestIdx >= 0 && bestDist <= tolerance) {
        usedTaps.add(bestIdx);
        results.push({ offset: tapTimes[bestIdx] - target, hit: true });
      } else {
        results.push({ offset: 0, hit: false });
      }
    });

    const hitCount = results.filter(r => r.hit).length;
    const extraTaps = Math.max(0, taps.length - hitCount);
    const hitRatio = targetTimes.length > 0 ? hitCount / targetTimes.length : 0;
    const penalty = Math.min(0.3, extraTaps * 0.1);
    const s = Math.max(0, Math.min(100, Math.round((hitRatio - penalty) * 100)));

    // Store user's normalized tap positions for replay
    const userNorm = tapTimes.map(t => Math.max(0, Math.min(1, t / barDur)));
    setUserBeatsNorm(userNorm);

    setTapResults(results);
    setScore(s);
    setTotal(t => t + 1);
    if (s >= 80) setCorrect(c => c + 1);
    setPhase('result');
  }, [bpm, difficulty]);

  // Convert cells to normalized beat positions (for replay)
  const cellsToBeats = useCallback((cells: string[]): number[] => {
    const beats: number[] = [];
    let pos = 0;
    for (const id of cells) {
      const cell = CELL_MAP[id];
      if (!cell) continue;
      if (!cell.isRest) beats.push(pos);
      pos += cell.value;
    }
    return beats;
  }, []);

  // Replay a set of normalized beat positions as clicks
  const replayBeats = useCallback((beats: number[], freq = 1200, gain = 0.4) => {
    if (isReplayingRef.current) return;
    // Don't call cleanup() here — it would clear the endTimer that resets isReplaying
    // Instead, just clear existing replay timers manually
    timerListRef.current.forEach(t => clearTimeout(t));
    timerListRef.current = [];

    const ctx = getAudioContext();
    ctx.resume().catch(() => {});

    const beatDur = 60 / bpm;
    const barDur = 4 * beatDur;
    const leadIn = 150; // ms lead-in so first beat (pos=0) doesn't get swallowed
    isReplayingRef.current = true;
    setIsReplaying(true);

    beats.forEach((pos) => {
      const delayMs = leadIn + pos * barDur * 1000;
      const timer = setTimeout(() => {
        playClick(freq, gain);
      }, delayMs);
      timerListRef.current.push(timer);
    });

    // Reset replaying state after bar ends
    const endTimer = setTimeout(() => {
      isReplayingRef.current = false;
      setIsReplaying(false);
    }, leadIn + barDur * 1000 + 100);
    timerListRef.current.push(endTimer);
  }, [bpm, playClick]);

  // Replay correct answer
  const replayCorrectAnswer = useCallback(() => {
    if (!pattern) return;
    replayBeats(pattern.beats, 1200, 0.4);
  }, [pattern, replayBeats]);

  // Replay user's answer
  const replayUserAnswer = useCallback(() => {
    if (rhythmMode === 'tap') {
      replayBeats(userBeatsNorm, 1000, 0.35);
    } else {
      const beats = cellsToBeats(userCells);
      replayBeats(beats, 1000, 0.35);
    }
  }, [rhythmMode, userBeatsNorm, userCells, replayBeats, cellsToBeats]);

  // Dictation: add a cell
  const addCell = useCallback((cellId: string) => {
    const cell = CELL_MAP[cellId];
    if (!cell) return;
    const currentTotal = userCells.reduce((sum, id) => sum + (CELL_MAP[id]?.value ?? 0), 0);
    if (currentTotal + cell.value > 1.0 + 0.001) return; // don't exceed 1 bar
    setUserCells(prev => [...prev, cellId]);
  }, [userCells]);

  // Dictation: remove last cell
  const removeLastCell = useCallback(() => {
    setUserCells(prev => prev.slice(0, -1));
  }, []);

  // Dictation: submit answer — compare by beat positions, not cell IDs
  const submitDictation = useCallback(() => {
    if (!pattern) return;
    const correctBeats = pattern.beats;
    const userBeats = cellsToBeats(userCells);

    // Match each correct beat to closest user beat
    const usedUserIdx = new Set<number>();
    const correctMatched = new Array(correctBeats.length).fill(false);
    const eps = 0.015; // tolerance for floating point

    for (let ci = 0; ci < correctBeats.length; ci++) {
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let ui = 0; ui < userBeats.length; ui++) {
        if (usedUserIdx.has(ui)) continue;
        const dist = Math.abs(correctBeats[ci] - userBeats[ui]);
        if (dist < bestDist) { bestDist = dist; bestIdx = ui; }
      }
      if (bestIdx >= 0 && bestDist <= eps) {
        usedUserIdx.add(bestIdx);
        correctMatched[ci] = true;
      }
    }

    const hits = correctMatched.filter(Boolean).length;
    const extraBeats = Math.max(0, userBeats.length - hits);
    const penalty = Math.min(0.3, extraBeats * 0.1);
    const s = correctBeats.length > 0
      ? Math.max(0, Math.round(((hits / correctBeats.length) - penalty) * 100))
      : 0;

    // Build per-cell visual result: map each user cell to whether its beat was matched
    const cellResults: boolean[] = [];
    let beatIdx = 0;
    for (const id of userCells) {
      const cell = CELL_MAP[id];
      if (!cell) { cellResults.push(false); continue; }
      if (cell.isRest) {
        cellResults.push(true); // rests are neutral — show as OK
      } else {
        cellResults.push(usedUserIdx.has(beatIdx));
        beatIdx++;
      }
    }

    setDictationResult(cellResults);
    setScore(s);
    setTotal(t => t + 1);
    if (s >= 80) setCorrect(c => c + 1);
    setPhase('result');
  }, [pattern, userCells, cellsToBeats]);

  // Keyboard tap support
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && phaseRef.current === 'recording') {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleTap]);

  const scoreColor = score !== null
    ? score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
    : '#8b5cf6';

  const userCellsTotal = userCells.reduce((sum, id) => sum + (CELL_MAP[id]?.value ?? 0), 0);
  const barFull = userCellsTotal >= 1.0 - 0.001;

  const availableCells = RHYTHM_CELLS.filter(c => DIFF_CELLS[difficulty].includes(c.id));

  return (
    <div className="flex flex-col max-w-xl mx-auto w-full px-4 py-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="btn-ghost p-2 cursor-pointer" aria-label="返回設定">
          <Settings size={18} />
        </button>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
            {([['tap', '拍打'], ['dictation', '聽寫']] as [RhythmMode, string][]).map(([m, label]) => (
              <button
                key={m}
                disabled={phase !== 'idle' && phase !== 'result'}
                onClick={() => { setRhythmMode(m); setPhase('idle'); setScore(null); setDictationResult(null); setUserCells([]); }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:cursor-default"
                style={rhythmMode === m
                  ? { background: 'var(--primary-bg)', border: '1px solid var(--primary)', color: 'var(--primary-sub)' }
                  : { color: 'var(--tx-muted)' }}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Difficulty */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
            {(['easy', 'medium', 'hard'] as RhythmDifficulty[]).map(d => (
              <button
                key={d}
                disabled={phase !== 'idle' && phase !== 'result'}
                onClick={() => { setDifficulty(d); setPhase('idle'); setScore(null); setUserCells([]); setDictationResult(null); }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:cursor-default"
                style={difficulty === d
                  ? { background: 'var(--primary-bg)', border: '1px solid var(--primary)', color: 'var(--primary-sub)' }
                  : { color: 'var(--tx-muted)' }}
              >
                {DIFF_CFG[d].label}
              </button>
            ))}
          </div>
          {/* BPM */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
            <button onClick={() => setBpm(b => Math.max(50, b - 10))} className="text-tx-muted hover:text-tx text-xs font-bold cursor-pointer">−</button>
            <span className="text-xs font-bold w-8 text-center" style={{ color: 'var(--primary-sub)' }}>{bpm}</span>
            <button onClick={() => setBpm(b => Math.min(180, b + 10))} className="text-tx-muted hover:text-tx text-xs font-bold cursor-pointer">+</button>
          </div>
          {/* Score */}
          {total > 0 && (
            <div className="text-right">
              <span className="text-lg font-black" style={{ color: 'var(--primary)' }}>{correct}</span>
              <span className="text-tx-muted mx-1 font-bold">/</span>
              <span className="text-tx-sub font-bold">{total}</span>
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="mb-5 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm min-h-10"
        style={{ background: 'var(--primary-bg)', border: '1px solid rgba(139,92,246,0.18)' }}>
        {phase === 'idle' && (
          <><Disc size={13} style={{ color: 'var(--primary)' }} className="shrink-0" />
            <span style={{ color: 'var(--primary-sub)' }}>
              {DIFF_CFG[difficulty].desc} · {bpm} BPM · {rhythmMode === 'tap' ? '按「開始」聆聽並拍打節奏' : '按「開始」聆聽並譜寫節奏'}
            </span></>
        )}
        {phase === 'countIn' && (
          <><div className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: 'var(--primary)' }} />
            <span style={{ color: 'var(--primary-sub)' }}>預備拍…</span></>
        )}
        {phase === 'playing' && (
          <><div className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: '#f59e0b' }} />
            <span style={{ color: 'var(--primary-sub)' }}>仔細聆聽節奏型態…</span></>
        )}
        {phase === 'recording' && (
          <><div className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: '#ef4444' }} />
            <span style={{ color: 'var(--primary-sub)' }}>現在輪到你！點擊下方按鈕或按空白鍵打出節奏</span></>
        )}
        {phase === 'dictation' && (
          <><PenLine size={13} style={{ color: '#f59e0b' }} className="shrink-0" />
            <span style={{ color: 'var(--primary-sub)' }}>選擇音符拼出你聽到的節奏，填滿一小節後送出</span></>
        )}
        {phase === 'result' && score !== null && (
          <><CheckCircle size={13} style={{ color: scoreColor }} className="shrink-0" />
            <span style={{ color: scoreColor }}>
              {rhythmMode === 'tap'
                ? (score >= 80 ? '節奏感十足！' : score >= 50 ? '接近了，再聽一次試試' : '節奏偏差較大，多練習幾次')
                : (score >= 80 ? '譜寫正確！' : score >= 50 ? '接近了，對照正確答案再試試' : '仔細聆聽每個音符的時值')}
            </span></>
        )}
      </div>

      {/* Tap mode: Beat Visualization */}
      {rhythmMode === 'tap' && pattern && phase !== 'idle' && (
        <div className="mb-5 card p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="label">節奏型態</span>
            <span className="text-xs font-mono" style={{ color: 'var(--tx-muted)' }}>{pattern.label}</span>
          </div>
          <div className="flex gap-1.5 justify-center flex-wrap">
            {pattern.beats.map((pos, i) => {
              const result = tapResults[i];
              let bg = 'var(--input-bg)';
              let border = '1px solid var(--bd)';
              if (result) {
                if (result.hit) { bg = 'rgba(16,185,129,0.15)'; border = '1px solid rgba(16,185,129,0.4)'; }
                else { bg = 'rgba(239,68,68,0.15)'; border = '1px solid rgba(239,68,68,0.4)'; }
              }
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold"
                    style={{ background: bg, border }}>
                    {result ? (result.hit ? '✓' : '✗') : (Math.round(pos * 4 * 100) / 100).toFixed(1)}
                  </div>
                  {result && result.hit && (
                    <span className="text-[9px] font-mono" style={{ color: Math.abs(result.offset) < 30 ? '#10b981' : '#f59e0b' }}>
                      {result.offset > 0 ? '+' : ''}{Math.round(result.offset)}ms
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dictation mode: User notation area */}
      {rhythmMode === 'dictation' && (phase === 'dictation' || phase === 'result') && (
        <div className="mb-5 card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="label">你的譜寫</span>
            <div className="flex items-center gap-2">
              {/* Bar fill progress */}
              <div className="flex items-center gap-1.5">
                <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, userCellsTotal * 100)}%`,
                      background: barFull ? '#10b981' : 'var(--primary)',
                    }} />
                </div>
                <span className="text-[10px] font-mono" style={{ color: barFull ? '#10b981' : 'var(--tx-muted)' }}>
                  {Math.round(userCellsTotal * 4)}/4
                </span>
              </div>
              {phase === 'dictation' && userCells.length > 0 && (
                <button onClick={removeLastCell} className="btn-ghost p-1 cursor-pointer" aria-label="刪除最後一個">
                  <Trash2 size={14} style={{ color: 'var(--tx-muted)' }} />
                </button>
              )}
            </div>
          </div>

          {/* User's notation display */}
          <div className="flex gap-1.5 justify-center flex-wrap min-h-12 items-center py-2 px-2 rounded-xl"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
            {userCells.length === 0 && phase === 'dictation' && (
              <span className="text-xs" style={{ color: 'var(--tx-muted)' }}>點選下方音符開始譜寫…</span>
            )}
            {userCells.map((cellId, i) => {
              const cell = CELL_MAP[cellId];
              if (!cell) return null;
              const isCorrect = dictationResult ? dictationResult[i] : undefined;
              let bg = cell.isRest ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.12)';
              let borderStyle = '1px solid rgba(139,92,246,0.2)';
              if (isCorrect === true) { bg = 'rgba(16,185,129,0.15)'; borderStyle = '1px solid rgba(16,185,129,0.4)'; }
              if (isCorrect === false) { bg = 'rgba(239,68,68,0.15)'; borderStyle = '1px solid rgba(239,68,68,0.4)'; }
              return (
                <div key={i} className="flex flex-col items-center gap-0.5"
                  style={{ cursor: phase === 'dictation' ? 'pointer' : 'default' }}
                  onClick={() => { if (phase === 'dictation') setUserCells(prev => prev.filter((_, j) => j !== i)); }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-all"
                    style={{ background: bg, border: borderStyle }}>
                    {cell.label}
                  </div>
                  <span className="text-[9px] font-mono" style={{ color: 'var(--tx-muted)' }}>
                    {cell.isRest ? '休' : cell.id}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Correct answer (shown in result) */}
          {phase === 'result' && pattern?.cells && (
            <div className="mt-3">
              <span className="label text-[11px] mb-2 block">正確答案</span>
              <div className="flex gap-1.5 justify-center flex-wrap">
                {pattern.cells.map((cellId, i) => {
                  const cell = CELL_MAP[cellId];
                  if (!cell) return null;
                  return (
                    <div key={i} className="flex flex-col items-center gap-0.5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                        style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                        {cell.label}
                      </div>
                      <span className="text-[9px] font-mono" style={{ color: '#10b981' }}>
                        {cell.isRest ? '休' : cell.id}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dictation: Cell picker */}
      {rhythmMode === 'dictation' && phase === 'dictation' && (
        <div className="mb-5 card p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="label">音符元件</span>
            <span className="text-[10px]" style={{ color: 'var(--tx-muted)' }}>點擊加入 · 再點譜面上的音符可移除</span>
          </div>
          <div className="flex gap-2 justify-center flex-wrap">
            {availableCells.map(cell => {
              const wouldExceed = userCellsTotal + cell.value > 1.0 + 0.001;
              return (
                <button
                  key={cell.id}
                  disabled={wouldExceed}
                  onClick={() => addCell(cell.id)}
                  className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                  style={{ background: cell.isRest ? 'rgba(245,158,11,0.08)' : 'var(--input-bg)', border: `1px solid ${cell.isRest ? 'rgba(245,158,11,0.2)' : 'var(--bd)'}` }}>
                  <span className="text-xl">{cell.label}</span>
                  <span className="text-[9px] font-mono" style={{ color: 'var(--tx-muted)' }}>
                    {cell.isRest ? '休止' : cell.id === 'w' ? '全' : cell.id === 'h' ? '二分' : cell.id === 'dq' ? '附點' : cell.id === 'q' ? '四分' : cell.id === 'e' ? '八分' : '十六分'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Score Card */}
      {phase === 'result' && score !== null && (
        <div className="mb-5 rounded-2xl p-5 animate-scale-in flex items-center justify-between gap-6"
          style={{
            background: score >= 80 ? 'rgba(16,185,129,0.07)' : score >= 50 ? 'rgba(245,158,11,0.07)' : 'rgba(239,68,68,0.07)',
            border: `1px solid ${score >= 80 ? 'rgba(16,185,129,0.25)' : score >= 50 ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
          <div>
            <div className="text-4xl font-black mb-0.5" style={{ color: scoreColor }}>{score}%</div>
            <div className="text-sm" style={{ color: 'var(--tx-muted)' }}>
              {score >= 80 ? (rhythmMode === 'tap' ? '節奏正確 ✓' : '譜寫正確 ✓') : score >= 50 ? '接近正確' : '需要加強'}
            </div>
          </div>
          <div className="flex-1 max-w-40">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${score}%`,
                  background: score >= 80
                    ? 'linear-gradient(90deg,#10b981,#34d399)'
                    : score >= 50
                      ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                      : 'linear-gradient(90deg,#ef4444,#f87171)',
                }} />
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col items-center gap-4">
        {/* Tap mode: TAP button */}
        {rhythmMode === 'tap' && phase === 'recording' && (
          <button
            onPointerDown={handleTap}
            className="w-40 h-40 rounded-full flex flex-col items-center justify-center active:scale-90 transition-all cursor-pointer select-none"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))', boxShadow: '0 8px 32px rgba(139,92,246,0.3)' }}
          >
            <Disc size={40} className="text-white mb-1" />
            <span className="text-white text-sm font-bold">TAP</span>
          </button>
        )}

        {/* Start button */}
        {phase === 'idle' && (
          <button onClick={start}
            className="flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg,var(--primary),var(--accent))', color: 'white' }}>
            <Play size={16} /> 開始訓練
          </button>
        )}

        {/* Playing/CountIn indicator */}
        {(phase === 'countIn' || phase === 'playing') && (
          <div className="flex items-center gap-3 px-6 py-3 rounded-xl"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--primary)' }} />
            <span className="text-sm" style={{ color: 'var(--tx-muted)' }}>
              {phase === 'countIn' ? '預備…' : '聆聽中…'}
            </span>
          </div>
        )}

        {/* Dictation controls */}
        {rhythmMode === 'dictation' && phase === 'dictation' && (
          <div className="flex gap-3">
            <button onClick={replay}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)', color: 'var(--tx-sub)' }}>
              <Volume2 size={14} /> 重播
            </button>
            <button
              onClick={submitDictation}
              disabled={!barFull}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg,var(--primary),var(--accent))', color: 'white' }}>
              <CheckCircle size={14} /> 送出答案
            </button>
          </div>
        )}

        {/* Result: replay & next buttons */}
        {phase === 'result' && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-2">
              <button onClick={replayUserAnswer}
                disabled={isReplaying}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-xs cursor-pointer hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)', color: 'var(--tx-sub)' }}>
                <Volume2 size={13} /> 我的答案
              </button>
              <button onClick={replayCorrectAnswer}
                disabled={isReplaying}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-xs cursor-pointer hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                <Volume2 size={13} /> 正確答案
              </button>
            </div>
            <button onClick={start}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg,var(--primary),var(--accent))', color: 'white' }}>
              <SkipForward size={16} /> 下一題
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RhythmTraining;
