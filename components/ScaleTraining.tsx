
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Settings, Play, CheckCircle, XCircle, SkipForward, Volume2 } from 'lucide-react';
import { playScale, NOTE_STRINGS } from '../utils/audioEngine';
import { ScaleType, SCALE_INTERVALS } from '../types';

type Phase = 'idle' | 'playing' | 'answering' | 'result';
type Direction = 'up' | 'down' | 'updown';

interface Props { onBack: () => void; volume?: number; }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ALL_SCALES = Object.values(ScaleType);

const ScaleTraining: React.FC<Props> = ({ onBack, volume = 0.5 }) => {
  const [selectedScales, setSelectedScales] = useState<ScaleType[]>([
    ScaleType.MAJOR, ScaleType.NATURAL_MINOR, ScaleType.DORIAN, ScaleType.MIXOLYDIAN,
  ]);
  const [direction, setDirection] = useState<Direction>('up');
  const [speed, setSpeed] = useState(1.0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [currentScale, setCurrentScale] = useState<ScaleType | null>(null);
  const [rootMidi, setRootMidi] = useState(60);
  const [options, setOptions] = useState<ScaleType[]>([]);
  const [selected, setSelected] = useState<ScaleType | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const toggleScale = (s: ScaleType) => {
    setSelectedScales(prev =>
      prev.includes(s)
        ? (prev.length > 2 ? prev.filter(i => i !== s) : prev)
        : [...prev, s]
    );
  };

  const generateQuestion = useCallback(() => {
    setFeedback(null);
    setSelected(null);

    const pool = selectedScales.length >= 2 ? selectedScales : ALL_SCALES.slice(0, 4);
    const answer = pool[Math.floor(Math.random() * pool.length)];
    const root = 60 + Math.floor(Math.random() * 12);

    setRootMidi(root);
    setCurrentScale(answer);

    // Generate options (answer + distractors)
    const others = ALL_SCALES.filter(s => s !== answer);
    const numOptions = Math.min(pool.length, 4);
    const distractors = shuffle(others).slice(0, numOptions - 1);
    setOptions(shuffle([answer, ...distractors]));

    setPhase('playing');
    const intervals = SCALE_INTERVALS[answer];
    playScale(root, intervals, speed, direction);

    let noteCount = intervals.length;
    if (direction === 'updown') noteCount = noteCount * 2 - 1;
    const totalDur = noteCount * 0.25 * speed * 1000 + 400;
    timerRef.current = setTimeout(() => setPhase('answering'), totalDur);
  }, [selectedScales, speed, direction]);

  const replay = useCallback(() => {
    if (!currentScale) return;
    playScale(rootMidi, SCALE_INTERVALS[currentScale], speed, direction);
  }, [currentScale, rootMidi, speed, direction]);

  const handleAnswer = useCallback((scale: ScaleType) => {
    if (feedback || !currentScale) return;
    setSelected(scale);

    if (scale === currentScale) {
      setFeedback('correct');
      setScore(s => ({ correct: s.correct + 1, total: s.total + 1 }));
      timerRef.current = setTimeout(() => generateQuestion(), 1200);
    } else {
      setFeedback('incorrect');
      setScore(s => ({ ...s, total: s.total + 1 }));
      setTimeout(() => playScale(rootMidi, SCALE_INTERVALS[currentScale], speed, direction), 500);
    }
  }, [feedback, currentScale, rootMidi, speed, direction, generateQuestion]);

  const rootName = NOTE_STRINGS[((rootMidi % 12) + 12) % 12];

  return (
    <div className="flex flex-col max-w-xl mx-auto w-full px-4 py-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="btn-ghost p-2 cursor-pointer" aria-label="返回設定">
          <Settings size={18} />
        </button>
        <div className="flex items-center gap-3">
          {/* Direction */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
            {(['up', 'down', 'updown'] as Direction[]).map(d => {
              const labels: Record<Direction, string> = { up: '↑', down: '↓', updown: '↑↓' };
              return (
                <button key={d} onClick={() => setDirection(d)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                  style={direction === d
                    ? { background: 'var(--primary-bg)', border: '1px solid var(--primary)', color: 'var(--primary-sub)' }
                    : { color: 'var(--tx-muted)' }}
                >{labels[d]}</button>
              );
            })}
          </div>
          {/* Speed */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
            <button onClick={() => setSpeed(s => Math.max(0.5, +(s - 0.25).toFixed(2)))} className="text-tx-muted hover:text-tx text-xs font-bold cursor-pointer">−</button>
            <span className="text-xs font-bold w-8 text-center" style={{ color: 'var(--primary-sub)' }}>{speed}×</span>
            <button onClick={() => setSpeed(s => Math.min(2.0, +(s + 0.25).toFixed(2)))} className="text-tx-muted hover:text-tx text-xs font-bold cursor-pointer">+</button>
          </div>
          {/* Score */}
          {score.total > 0 && (
            <div className="text-right">
              <span className="text-lg font-black" style={{ color: 'var(--primary)' }}>{score.correct}</span>
              <span className="text-tx-muted mx-1 font-bold">/</span>
              <span className="text-tx-sub font-bold">{score.total}</span>
            </div>
          )}
        </div>
      </div>

      {/* Scale Selector (idle) */}
      {phase === 'idle' && (
        <div className="space-y-4 mb-6">
          <div className="card p-4 space-y-3">
            <h3 className="font-bold text-tx text-sm">選擇練習的音階 / 調式</h3>
            <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1 no-scrollbar">
              {ALL_SCALES.map(s => {
                const isOn = selectedScales.includes(s);
                return (
                  <button key={s} onClick={() => toggleScale(s)}
                    className="text-[10px] py-2 px-2.5 rounded-lg text-left truncate transition-all cursor-pointer font-bold"
                    style={isOn
                      ? { background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--primary-sub)' }
                      : { background: 'var(--input-bg)', border: '1px solid var(--bd)', color: 'var(--tx-muted)' }}
                  >{s}</button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-center">
            <button onClick={generateQuestion}
              className="flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg,var(--primary),var(--accent))', color: 'white' }}>
              <Play size={16} /> 開始練習
            </button>
          </div>
        </div>
      )}

      {/* Playing / Answering / Result */}
      {phase !== 'idle' && (
        <>
          {/* Status */}
          <div className="mb-5 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm"
            style={{ background: 'var(--primary-bg)', border: '1px solid rgba(139,92,246,0.18)' }}>
            {phase === 'playing' && (
              <><div className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: 'var(--primary)' }} />
                <span style={{ color: 'var(--primary-sub)' }}>播放音階中（{rootName} 起始）…</span></>
            )}
            {phase === 'answering' && !feedback && (
              <><Volume2 size={13} style={{ color: 'var(--primary)' }} className="shrink-0" />
                <span style={{ color: 'var(--primary-sub)' }}>這是什麼音階 / 調式？</span></>
            )}
            {feedback === 'correct' && (
              <><CheckCircle size={13} style={{ color: '#10b981' }} className="shrink-0" />
                <span style={{ color: '#10b981' }}>正確！{rootName} {currentScale}</span></>
            )}
            {feedback === 'incorrect' && (
              <><XCircle size={13} style={{ color: '#ef4444' }} className="shrink-0" />
                <span style={{ color: '#ef4444' }}>正確答案：{rootName} {currentScale}</span></>
            )}
          </div>

          {/* Replay */}
          {(phase === 'answering' || phase === 'playing') && (
            <div className="flex justify-center mb-5">
              <button onClick={replay}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm cursor-pointer hover:opacity-80 active:scale-95 transition-all btn-ghost">
                <Play size={14} /> 重播
              </button>
            </div>
          )}

          {/* Options */}
          {(phase === 'answering' || feedback) && (
            <div className="grid grid-cols-2 gap-2.5 mb-6">
              {options.map(opt => {
                const isCorrect = feedback && currentScale === opt;
                const isWrong = feedback === 'incorrect' && selected === opt;
                let style: React.CSSProperties = { background: 'var(--input-bg)', border: '1px solid var(--bd)', color: 'var(--tx-sub)' };
                if (isCorrect) style = { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', boxShadow: '0 0 12px rgba(16,185,129,0.15)' };
                else if (isWrong) style = { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' };
                else if (feedback) style = { ...style, opacity: 0.5 };

                return (
                  <button key={opt} disabled={!!feedback} onClick={() => handleAnswer(opt)}
                    className="h-14 rounded-xl font-bold text-xs tracking-wider transition-all cursor-pointer px-3"
                    style={style}>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {/* Scale intervals display on result */}
          {feedback && currentScale && (
            <div className="mb-5 card p-3">
              <div className="label mb-2">音階組成音</div>
              <div className="flex gap-1.5 flex-wrap justify-center">
                {SCALE_INTERVALS[currentScale].map((interval, i) => {
                  const midi = rootMidi + interval;
                  const noteName = NOTE_STRINGS[((midi % 12) + 12) % 12];
                  return (
                    <div key={i} className="px-2.5 py-1.5 rounded-lg text-xs font-bold"
                      style={{ background: 'var(--primary-bg)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--primary-sub)' }}>
                      {noteName}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Next */}
          {feedback && (
            <div className="flex justify-center gap-3">
              {feedback === 'incorrect' && (
                <button onClick={replay} className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer hover:opacity-80 active:scale-95 transition-all btn-ghost">
                  <Volume2 size={14} /> 重聽正確答案
                </button>
              )}
              <button onClick={generateQuestion}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg,var(--primary),var(--accent))', color: 'white' }}>
                <SkipForward size={16} /> 下一題
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ScaleTraining;
