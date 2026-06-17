
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Pause, RotateCcw, Volume2, Trash2, Headphones, Sliders, GraduationCap } from 'lucide-react';
import { DrumMachineEngine } from '../utils/audio/drumMachine';
import DrumQuiz from './DrumQuiz';
import { DRUM_PLAYERS, DRUM_VOICE_ORDER, DRUM_VOICE_LABELS } from '../utils/audio/drums';
import { getAudioContext, resumeAudio } from '../utils/audio/context';
import { DrumBank, DrumPattern, DrumSlot, DrumTrack, BEATS_PER_BAR_OPTIONS, SUBDIVISION_OPTIONS, grooveStepCount, beatOffsets, subLabel, DrumVoice } from '../types';

const STORAGE_KEY = 'earlessly-drum-bank-v1';
const SLOTS: DrumSlot[] = ['A', 'B', 'C', 'D'];

const emptyTrack = (voice: DrumVoice, steps: number): DrumTrack => ({
  voice,
  label: DRUM_VOICE_LABELS[voice],
  volume: 0.8,
  muted: false,
  steps: new Array(steps).fill(false),
});

const emptyPattern = (bpm = 110, swing = 0, beatsPerBar = 4, subdivision = 4): DrumPattern => {
  const subdivisions = new Array(beatsPerBar).fill(subdivision);
  return {
    bpm,
    swing,
    subdivisions,
    tracks: DRUM_VOICE_ORDER.map(v => emptyTrack(v, grooveStepCount(subdivisions))),
  };
};

// Resize a track's steps array beat-by-beat: keep each beat's existing hits where
// the cell still exists, fill the rest with rests. Handles changing one beat's
// subdivision as well as adding/removing whole beats.
const reshapeTrackSteps = (steps: boolean[], oldSubs: number[], newSubs: number[]): boolean[] => {
  const oldOff = beatOffsets(oldSubs);
  const out: boolean[] = [];
  newSubs.forEach((ns, b) => {
    const os = oldSubs[b] ?? 0;
    const start = oldOff[b] ?? 0;
    for (let k = 0; k < ns; k++) out.push(k < os ? (steps[start + k] ?? false) : false);
  });
  return out;
};

// Slot A ships with a basic four-on-the-floor so first-run users hear something.
const seedPatternA = (): DrumPattern => {
  const p = emptyPattern(110, 0);
  const on = (voice: DrumVoice, indices: number[]) => {
    const track = p.tracks.find(t => t.voice === voice);
    if (!track) return;
    indices.forEach(i => { track.steps[i] = true; });
  };
  on('kick', [0, 4, 8, 12]);
  on('snare', [4, 12]);
  on('closedHat', [0, 2, 4, 6, 8, 10, 12, 14]);
  return p;
};

const defaultBank = (): DrumBank => ({
  active: 'A',
  slots: {
    A: seedPatternA(),
    B: emptyPattern(120, 0),
    C: emptyPattern(95, 0.2),
    D: emptyPattern(140, 0),
  },
});

const loadBank = (): DrumBank => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultBank();
    const parsed = JSON.parse(raw) as DrumBank;
    // Guard against schema drift: rebuild any missing tracks/slots.
    SLOTS.forEach(slot => {
      const p = parsed.slots?.[slot];
      if (!p) (parsed.slots ??= {} as DrumBank['slots'])[slot] = emptyPattern();
      else {
        // Migrate older shapes into `subdivisions[]`: a uniform {beatsPerBar,
        // subdivision} pair, a `meter` string, or just a bare step count.
        if (!Array.isArray(p.subdivisions)) {
          const anyP = p as { beatsPerBar?: number; subdivision?: number; meter?: string };
          if (typeof anyP.beatsPerBar === 'number' && typeof anyP.subdivision === 'number') {
            p.subdivisions = new Array(anyP.beatsPerBar).fill(anyP.subdivision);
          } else {
            const len = p.tracks?.[0]?.steps?.length;
            const beats = anyP.meter === '3/4' || len === 12 ? 3 : 4;
            p.subdivisions = new Array(beats).fill(4);
          }
          delete anyP.beatsPerBar; delete anyP.subdivision; delete anyP.meter;
        }
        const len = grooveStepCount(p.subdivisions);
        const byVoice = new Map(p.tracks.map(t => [t.voice, t]));
        p.tracks = DRUM_VOICE_ORDER.map(v => byVoice.get(v) ?? emptyTrack(v, len));
        p.tracks.forEach(t => {
          if (!Array.isArray(t.steps) || t.steps.length !== len) {
            const base = Array.isArray(t.steps) ? t.steps : [];
            t.steps = Array.from({ length: len }, (_, i) => base[i] ?? false);
          }
        });
      }
    });
    if (!SLOTS.includes(parsed.active)) parsed.active = 'A';
    return parsed;
  } catch {
    return defaultBank();
  }
};

interface DrumMachineProps {
  volume: number;
}

const DrumMachine: React.FC<DrumMachineProps> = ({ volume }) => {
  const [studioMode, setStudioMode] = useState<'free' | 'quiz'>('free');
  const [bank, setBank] = useState<DrumBank>(loadBank);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  // Solo is session-scoped, not persisted — it's a monitoring tool, not a pattern attribute.
  const [solo, setSolo] = useState<boolean[]>(() => DRUM_VOICE_ORDER.map(() => false));
  const engineRef = useRef<DrumMachineEngine | null>(null);

  const pattern = bank.slots[bank.active];
  const subdivisions = pattern.subdivisions;
  // Start step index of each beat, for grouping the grid by beat.
  const offsets = useMemo(() => beatOffsets(subdivisions), [subdivisions]);

  // Persist on every change. localStorage write is cheap enough at this size (~1KB).
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bank)); } catch { /* quota — ignore */ }
  }, [bank]);

  useEffect(() => {
    engineRef.current = new DrumMachineEngine(step => setCurrentStep(step));
    engineRef.current.setVolume(volume);
    return () => engineRef.current?.destroy();
  }, []);

  useEffect(() => { engineRef.current?.setVolume(volume); }, [volume]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setParams(pattern.bpm, pattern.swing, pattern.tracks, solo, pattern.subdivisions);
    if (isPlaying) engineRef.current.start();
    else engineRef.current.stop();
  }, [pattern, solo, isPlaying]);

  // Pattern mutation helpers — always replace the slot inside bank to avoid mutating refs.
  const updatePattern = useCallback((mut: (p: DrumPattern) => DrumPattern) => {
    setBank(prev => ({
      ...prev,
      slots: { ...prev.slots, [prev.active]: mut(prev.slots[prev.active]) },
    }));
  }, []);

  const toggleStep = (trackIdx: number, stepIdx: number) => {
    updatePattern(p => {
      const tracks = p.tracks.map((t, i) => i === trackIdx
        ? { ...t, steps: t.steps.map((s, j) => j === stepIdx ? !s : s) }
        : t,
      );
      return { ...p, tracks };
    });
  };

  const setTrackVolume = (trackIdx: number, v: number) => {
    updatePattern(p => ({
      ...p,
      tracks: p.tracks.map((t, i) => i === trackIdx ? { ...t, volume: v } : t),
    }));
  };

  const toggleMute = (trackIdx: number) => {
    updatePattern(p => ({
      ...p,
      tracks: p.tracks.map((t, i) => i === trackIdx ? { ...t, muted: !t.muted } : t),
    }));
  };

  const toggleSolo = (trackIdx: number) => {
    setSolo(prev => prev.map((s, i) => i === trackIdx ? !s : s));
  };

  const clearPattern = () => {
    if (!window.confirm(`清空 Pattern ${bank.active}？`)) return;
    updatePattern(p => ({ ...p, tracks: p.tracks.map(t => ({ ...t, steps: new Array(t.steps.length).fill(false) })) }));
  };

  const setBpm = (bpm: number) => updatePattern(p => ({ ...p, bpm }));
  const setSwingValue = (swing: number) => updatePattern(p => ({ ...p, swing }));

  // Apply a new per-beat subdivision layout, remapping every track beat-by-beat.
  const reshape = (newSubs: number[]) => {
    setCurrentStep(-1);
    updatePattern(p => ({
      ...p,
      subdivisions: newSubs,
      tracks: p.tracks.map(t => ({ ...t, steps: reshapeTrackSteps(t.steps, p.subdivisions, newSubs) })),
    }));
  };

  // 拍數: grow/shrink the beat list, keeping existing beats; new beats default to 16ths.
  const setBeatsPerBar = (beats: number) => {
    if (beats === subdivisions.length) return;
    reshape(Array.from({ length: beats }, (_, i) => subdivisions[i] ?? 4));
  };

  // Set one beat's subdivision (per-beat freedom: e.g. beat 1 = 16分, beat 2 = 三連音).
  const setBeatSubdivision = (beatIdx: number, sub: number) => {
    if (subdivisions[beatIdx] === sub) return;
    reshape(subdivisions.map((s, i) => (i === beatIdx ? sub : s)));
  };
  // Click a beat header to cycle its subdivision through the offered options.
  const cycleBeatSubdivision = (beatIdx: number) => {
    const order = SUBDIVISION_OPTIONS.map(o => o.value);
    const next = order[(order.indexOf(subdivisions[beatIdx]) + 1) % order.length];
    setBeatSubdivision(beatIdx, next);
  };

  const togglePlay = () => {
    if (!isPlaying) {
      resumeAudio();
      setCurrentStep(-1);
    }
    setIsPlaying(p => !p);
  };

  const switchSlot = (slot: DrumSlot) => {
    if (slot === bank.active) return;
    setBank(prev => ({ ...prev, active: slot }));
    setCurrentStep(-1);
  };

  // Preview a single drum sound when user clicks the row label / volume knob.
  const previewVoice = (voice: DrumVoice, gain: number) => {
    const ctx = getAudioContext();
    resumeAudio();
    DRUM_PLAYERS[voice](ctx, ctx.currentTime + 0.01, ctx.destination, gain);
  };

  const anySolo = useMemo(() => solo.some(Boolean), [solo]);

  const switchMode = (m: 'free' | 'quiz') => {
    if (m === studioMode) return;
    if (m === 'quiz') setIsPlaying(false); // hand the speakers over to the quiz engine
    setStudioMode(m);
  };

  // Segmented control shared by both modes.
  const modeBar = (
    <div className="max-w-5xl mx-auto w-full px-3 sm:px-5 pt-3">
      <div role="tablist" className="card-inner p-1 flex gap-1 w-fit">
        {([['free', '自由', Sliders], ['quiz', '作答', GraduationCap]] as const).map(([m, label, Icon]) => {
          const active = studioMode === m;
          return (
            <button
              key={m}
              role="tab"
              aria-selected={active}
              onClick={() => switchMode(m)}
              className="px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
              style={active
                ? { background: 'var(--primary-bg)', border: '1px solid var(--primary)', color: 'var(--primary-sub)' }
                : { background: 'transparent', color: 'var(--tx-muted)' }}
            >
              <Icon size={13} /> {label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {modeBar}
      <div className="flex-1 min-h-0">
        {studioMode === 'quiz' ? <DrumQuiz volume={volume} /> : (
    <div className="flex flex-col w-full max-w-5xl mx-auto p-3 sm:p-5 space-y-3 lg:space-y-4 overflow-y-auto h-full no-scrollbar animate-slide-up">

      {/* ===== Transport bar ===== */}
      <div className="card p-3 sm:p-4 flex flex-wrap items-center gap-3 sm:gap-4">
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? '停止' : '播放'}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 cursor-pointer shrink-0 ${
            isPlaying ? 'bg-danger text-white' : 'btn-primary animate-glow-pulse'
          }`}
        >
          {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-0.5" />}
        </button>

        <div className="flex flex-col items-start">
          <span className="text-3xl sm:text-4xl font-black gradient-text leading-none">{pattern.bpm}</span>
          <span className="label mt-0.5">BPM</span>
        </div>

        <div className="flex-1 min-w-[180px] flex items-center gap-2">
          <input
            type="range" min="40" max="220" value={pattern.bpm}
            onChange={e => setBpm(parseInt(e.target.value))}
            className="flex-1 h-1 cursor-pointer"
            aria-label="鼓機 BPM"
          />
        </div>

        <div className="flex items-center gap-2 min-w-[160px]">
          <span className="label shrink-0">Swing</span>
          <input
            type="range" min="0" max="50" value={Math.round(pattern.swing * 100)}
            onChange={e => setSwingValue(parseInt(e.target.value) / 100)}
            className="flex-1 h-1 cursor-pointer"
            aria-label="Swing"
          />
          <span className="text-[11px] font-mono text-tx-muted w-8 text-right">{Math.round(pattern.swing * 100)}%</span>
        </div>

        {/* 拍數 (beats per bar) */}
        <div className="flex items-center gap-2">
          <span className="label shrink-0">拍數</span>
          <div role="group" aria-label="每小節拍數" className="flex card-inner p-1 gap-0.5">
            {BEATS_PER_BAR_OPTIONS.map(({ value, label }) => {
              const isActive = subdivisions.length === value;
              return (
                <button
                  key={value}
                  onClick={() => setBeatsPerBar(value)}
                  aria-pressed={isActive}
                  className="px-2.5 h-8 rounded-md text-xs font-extrabold transition-all cursor-pointer"
                  style={isActive
                    ? { background: 'var(--primary-bg)', border: '1px solid var(--primary)', color: 'var(--primary-sub)' }
                    : { background: 'transparent', color: 'var(--tx-muted)' }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pattern slots A/B/C/D */}
        <div role="tablist" className="flex card-inner p-1 gap-0.5">
          {SLOTS.map(slot => {
            const isActive = bank.active === slot;
            const isEmpty = bank.slots[slot].tracks.every(t => t.steps.every(s => !s));
            return (
              <button
                key={slot}
                role="tab"
                aria-selected={isActive}
                onClick={() => switchSlot(slot)}
                className="w-9 h-8 rounded-md text-xs font-extrabold transition-all cursor-pointer relative"
                style={isActive
                  ? { background: 'var(--primary-bg)', border: '1px solid var(--primary)', color: 'var(--primary-sub)' }
                  : { background: 'transparent', color: 'var(--tx-muted)' }}
              >
                {slot}
                {!isEmpty && !isActive && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: 'var(--primary)', opacity: 0.7 }} />
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={clearPattern}
          className="btn-ghost px-2.5 py-2 flex items-center gap-1.5 text-xs"
          aria-label="清空當前 pattern"
        >
          <Trash2 size={12} /> Clear
        </button>
      </div>

      {/* ===== Step grid ===== */}
      <div className="card p-2 sm:p-3 overflow-x-auto">
        <div className="min-w-[680px] space-y-1.5">
          {/* Header: one control per beat. Click to cycle that beat's subdivision. */}
          <div className="flex items-center gap-2 pl-[200px] pr-1">
            {subdivisions.map((sub, b) => (
              <div key={b} className="flex flex-col items-stretch" style={{ flex: sub, marginLeft: b > 0 ? 6 : 0 }}>
                <button
                  onClick={() => cycleBeatSubdivision(b)}
                  title={`第 ${b + 1} 拍：${subLabel(sub)}（點擊切換格數）`}
                  className="w-full flex items-center justify-center gap-1 rounded-md py-1 text-[9px] font-bold transition-colors cursor-pointer hover:border-primary"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}
                >
                  <span className="text-tx-muted font-mono">{b + 1}</span>
                  <span className="text-primary-sub">{subLabel(sub)}</span>
                </button>
              </div>
            ))}
          </div>

          {pattern.tracks.map((track, trackIdx) => {
            const isMuted = (anySolo && !solo[trackIdx]) || (!anySolo && track.muted);
            return (
              <div key={track.voice} className="flex items-center gap-2 card-inner p-1.5 rounded-lg">
                {/* Row controls: label + M/S + volume — fixed 192px keeps things aligned with header */}
                <div className="flex items-center gap-1.5 w-[192px] shrink-0">
                  <button
                    onClick={() => previewVoice(track.voice, track.volume)}
                    className="w-12 text-left text-xs font-bold cursor-pointer hover:text-primary-sub transition-colors shrink-0"
                    style={{ color: isMuted ? 'var(--tx-muted)' : 'var(--tx)' }}
                    title={`試聽 ${track.label}`}
                  >
                    {track.label}
                  </button>

                  <button
                    onClick={() => toggleMute(trackIdx)}
                    className="w-6 h-6 rounded text-[9px] font-bold cursor-pointer transition-colors flex items-center justify-center shrink-0"
                    style={track.muted
                      ? { background: 'var(--status-danger-bg)', color: 'var(--status-danger)', border: '1px solid var(--status-danger-border)' }
                      : { background: 'var(--input-bg)', color: 'var(--tx-muted)', border: '1px solid var(--bd)' }}
                    aria-label={`${track.label} 靜音`}
                    aria-pressed={track.muted}
                  >M</button>

                  <button
                    onClick={() => toggleSolo(trackIdx)}
                    className="w-6 h-6 rounded text-[9px] font-bold cursor-pointer transition-colors flex items-center justify-center shrink-0"
                    style={solo[trackIdx]
                      ? { background: 'var(--status-warning-bg)', color: 'var(--status-warning)', border: '1px solid var(--status-warning-border)' }
                      : { background: 'var(--input-bg)', color: 'var(--tx-muted)', border: '1px solid var(--bd)' }}
                    aria-label={`${track.label} 獨奏`}
                    aria-pressed={solo[trackIdx]}
                  >S</button>

                  <input
                    type="range" min="0" max="1" step="0.05" value={track.volume}
                    onChange={e => setTrackVolume(trackIdx, parseFloat(e.target.value))}
                    className="flex-1 min-w-0 h-1 cursor-pointer"
                    aria-label={`${track.label} 音量`}
                  />
                </div>

                {/* Steps — grouped per beat so each beat keeps its own subdivision. */}
                <div className="flex items-center gap-2 flex-1">
                  {subdivisions.map((sub, b) => (
                    <div key={b} className="flex items-center gap-2" style={{ flex: sub, marginLeft: b > 0 ? 6 : 0 }}>
                      {Array.from({ length: sub }).map((_, k) => {
                        const stepIdx = offsets[b] + k;
                        const on = track.steps[stepIdx];
                        const isCurrent = isPlaying && stepIdx === currentStep;
                        const isBeatStart = k === 0;
                        return (
                          <button
                            key={stepIdx}
                            onClick={() => toggleStep(trackIdx, stepIdx)}
                            aria-pressed={on}
                            aria-label={`${track.label} 第${b + 1}拍 step ${k + 1}`}
                            className="flex-1 h-8 rounded-md transition-all cursor-pointer select-none relative"
                            style={{
                              background: on
                                ? isMuted ? 'var(--bg-active)' : 'var(--primary)'
                                : isBeatStart ? 'var(--input-bg)' : 'var(--bg-hover)',
                              border: isCurrent
                                ? '2px solid var(--primary-sub)'
                                : on
                                  ? '1px solid var(--primary)'
                                  : `1px solid ${isBeatStart ? 'var(--bd)' : 'transparent'}`,
                              opacity: isMuted && on ? 0.45 : 1,
                              transform: isCurrent ? 'scaleY(1.1)' : 'scaleY(1)',
                              boxShadow: isCurrent && on ? '0 0 12px var(--primary)' : 'none',
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer hint */}
      <div className="flex items-center justify-between text-[11px] text-tx-muted px-1">
        <div className="flex items-center gap-1.5">
          <Headphones size={11} /> 點軌道名試聽 · M 靜音 / S 獨奏
        </div>
        <div className="flex items-center gap-1.5">
          點各拍標頭可切換該拍格數（16分 / 三連音 / 8分）
        </div>
        <button
          onClick={() => updatePattern(p => ({
            ...p,
            tracks: p.tracks.map(t => ({ ...t, volume: 0.8, muted: false })),
          }))}
          className="btn-ghost px-2 py-1 text-[10px] flex items-center gap-1"
        >
          <RotateCcw size={10} /> 重置音量 / mute
        </button>
      </div>

      <div className="h-4 w-full shrink-0"></div>
    </div>
        )}
      </div>
    </div>
  );
};

export default DrumMachine;
