
import { useCallback, useEffect, useRef } from 'react';

export interface AudioRefs {
  stream: MediaStream | null;
  source: AudioNode | null;
  oscillators: OscillatorNode[];
  rafIds: number[];
  timeouts: ReturnType<typeof setTimeout>[];
  intervals: ReturnType<typeof setInterval>[];
}

// Centralized cleanup for components that hold mic streams, analysers, oscillators,
// and timers. Previously each of Tuner / EarTraining / FrequencyTraining / RhythmTraining
// wrote its own slightly different version of this.
export function useAudioCleanup() {
  const refs = useRef<AudioRefs>({
    stream: null,
    source: null,
    oscillators: [],
    rafIds: [],
    timeouts: [],
    intervals: [],
  });

  const cleanup = useCallback(() => {
    const r = refs.current;
    r.rafIds.forEach(id => cancelAnimationFrame(id));
    r.rafIds = [];
    r.timeouts.forEach(id => clearTimeout(id));
    r.timeouts = [];
    r.intervals.forEach(id => clearInterval(id));
    r.intervals = [];
    r.oscillators.forEach(o => { try { o.stop(); } catch { /* may already be stopped */ } });
    r.oscillators = [];
    if (r.source) { try { (r.source as AudioNode).disconnect(); } catch { /* may already be disconnected */ } r.source = null; }
    if (r.stream) {
      r.stream.getTracks().forEach(t => t.stop());
      r.stream = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  return { refs: refs.current, cleanup };
}
