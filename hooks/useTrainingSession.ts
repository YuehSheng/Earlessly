
import { useCallback, useEffect, useRef, useState } from 'react';
import { TrainingPhase } from '../types';

export interface TrainingScore {
  correct: number;
  total: number;
}

export interface TrainingSession<Q> {
  phase: TrainingPhase;
  setPhase: (p: TrainingPhase) => void;
  question: Q | null;
  setQuestion: (q: Q | null) => void;
  feedback: 'correct' | 'incorrect' | null;
  setFeedback: (f: 'correct' | 'incorrect' | null) => void;
  score: TrainingScore;
  resetScore: () => void;
  markCorrect: (advanceFn?: () => void, delayMs?: number) => void;
  markIncorrect: (replayFn?: () => void, delayMs?: number) => void;
  scheduleTimer: (fn: () => void, delayMs: number) => void;
  clearTimers: () => void;
  hasProgress: boolean;
}

// Shared state machine for ear-training sub-modes.
// Each mode owns its own question type, generation, and audio playback;
// this hook owns phase/score/feedback/timer plumbing that was duplicated
// across ScaleTraining, ProgressionTraining, FrequencyTraining, etc.
export function useTrainingSession<Q>(opts: {
  autoAdvanceMs?: number;
  incorrectReplayDelayMs?: number;
} = {}): TrainingSession<Q> {
  const autoAdvanceMs = opts.autoAdvanceMs ?? 1200;
  const incorrectReplayDelayMs = opts.incorrectReplayDelayMs ?? 500;

  const [phase, setPhase] = useState<TrainingPhase>('idle');
  const [question, setQuestion] = useState<Q | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [score, setScore] = useState<TrainingScore>({ correct: 0, total: 0 });

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
  }, []);

  const scheduleTimer = useCallback((fn: () => void, delayMs: number) => {
    const id = setTimeout(fn, delayMs);
    timersRef.current.push(id);
  }, []);

  const markCorrect = useCallback((advanceFn?: () => void, delayMs = autoAdvanceMs) => {
    setFeedback('correct');
    setScore(s => ({ correct: s.correct + 1, total: s.total + 1 }));
    if (advanceFn) scheduleTimer(advanceFn, delayMs);
  }, [autoAdvanceMs, scheduleTimer]);

  const markIncorrect = useCallback((replayFn?: () => void, delayMs = incorrectReplayDelayMs) => {
    setFeedback('incorrect');
    setScore(s => ({ ...s, total: s.total + 1 }));
    if (replayFn) scheduleTimer(replayFn, delayMs);
  }, [incorrectReplayDelayMs, scheduleTimer]);

  const resetScore = useCallback(() => setScore({ correct: 0, total: 0 }), []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return {
    phase,
    setPhase,
    question,
    setQuestion,
    feedback,
    setFeedback,
    score,
    resetScore,
    markCorrect,
    markIncorrect,
    scheduleTimer,
    clearTimers,
    hasProgress: score.total > 0,
  };
}
