
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Settings, Play, CheckCircle, XCircle, SkipForward, Volume2 } from 'lucide-react';
import { playChordProgression, NOTE_STRINGS } from '../utils/audioEngine';
import { PROGRESSIONS, ProgressionDef } from '../types';

type Phase = 'idle' | 'playing' | 'answering' | 'result';

interface Props { onBack: () => void; volume?: number; }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ProgressionTraining: React.FC<Props> = ({ onBack, volume = 0.5 }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    PROGRESSIONS.slice(0, 6).map(p => p.id)
  );
  const [bpm, setBpm] = useState(90);
  const [phase, setPhase] = useState<Phase>('idle');
  const [currentProg, setCurrentProg] = useState<ProgressionDef | null>(null);
  const [rootMidi, setRootMidi] = useState(60);
  const [options, setOptions] = useState<ProgressionDef[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const toggleProg = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? (prev.length > 2 ? prev.filter(i => i !== id) : prev)
        : [...prev, id]
    );
  };

  const activeProgs = PROGRESSIONS.filter(p => selectedIds.includes(p.id));

  const generateQuestion = useCallback(() => {
    setFeedback(null);
    setSelected(null);

    const pool = activeProgs.length >= 2 ? activeProgs : PROGRESSIONS.slice(0, 4);
    const answer = pool[Math.floor(Math.random() * pool.length)];

    // Random root: C3 to B3
    const root = 48 + Math.floor(Math.random() * 12);
    setRootMidi(root);
    setCurrentProg(answer);

    // Generate 4 options (answer + 3 distractors)
    const others = PROGRESSIONS.filter(p => p.id !== answer.id);
    const distractors = shuffle(others).slice(0, 3);
    setOptions(shuffle([answer, ...distractors]));

    // Play
    setPhase('playing');
    playChordProgression(answer.degrees, root, bpm);

    const totalDur = (answer.degrees.length * (60 / bpm)) * 1000 + 300;
    timerRef.current = setTimeout(() => setPhase('answering'), totalDur);
  }, [activeProgs, bpm]);

  const replay = useCallback(() => {
    if (!currentProg) return;
    playChordProgression(currentProg.degrees, rootMidi, bpm);
  }, [currentProg, rootMidi, bpm]);

  const handleAnswer = useCallback((prog: ProgressionDef) => {
    if (feedback || !currentProg) return;
    setSelected(prog.id);

    if (prog.id === currentProg.id) {
      setFeedback('correct');
      setScore(s => ({ correct: s.correct + 1, total: s.total + 1 }));
      timerRef.current = setTimeout(() => generateQuestion(), 1200);
    } else {
      setFeedback('incorrect');
      setScore(s => ({ ...s, total: s.total + 1 }));
      // Play correct answer after a delay
      setTimeout(() => playChordProgression(currentProg.degrees, rootMidi, bpm), 500);
    }
  }, [feedback, currentProg, rootMidi, bpm, generateQuestion]);

  const rootName = NOTE_STRINGS[((rootMidi % 12) + 12) % 12];

  return (
    <div className="flex flex-col max-w-xl mx-auto w-full px-4 py-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="btn-ghost p-2 cursor-pointer" aria-label="返回設定">
          <Settings size={18} />
        </button>
        <div className="flex items-center gap-3">
          {/* BPM */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
            <button onClick={() => setBpm(b => Math.max(50, b - 10))} className="text-tx-muted hover:text-tx text-xs font-bold cursor-pointer">−</button>
            <span className="text-xs font-bold w-8 text-center" style={{ color: 'var(--primary-sub)' }}>{bpm}</span>
            <button onClick={() => setBpm(b => Math.min(160, b + 10))} className="text-tx-muted hover:text-tx text-xs font-bold cursor-pointer">+</button>
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

      {/* Progression Selector (idle) */}
      {phase === 'idle' && (
        <div className="space-y-4 mb-6">
          <div className="card p-4 space-y-3">
            <h3 className="font-bold text-tx text-sm">選擇練習的和弦進行</h3>
            <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1 no-scrollbar">
              {PROGRESSIONS.map(p => {
                const isOn = selectedIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleProg(p.id)}
                    className="text-[10px] py-2 px-2.5 rounded-lg text-left truncate transition-all cursor-pointer font-bold"
                    style={isOn
                      ? { background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--primary-sub)' }
                      : { background: 'var(--input-bg)', border: '1px solid var(--bd)', color: 'var(--tx-muted)' }}
                  >
                    {p.label}
                  </button>
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
                <span style={{ color: 'var(--primary-sub)' }}>播放和弦進行中（{rootName} 調）…</span></>
            )}
            {phase === 'answering' && !feedback && (
              <><Volume2 size={13} style={{ color: 'var(--primary)' }} className="shrink-0" />
                <span style={{ color: 'var(--primary-sub)' }}>請選擇你聽到的和弦進行</span></>
            )}
            {feedback === 'correct' && (
              <><CheckCircle size={13} style={{ color: '#10b981' }} className="shrink-0" />
                <span style={{ color: '#10b981' }}>正確！{currentProg?.label}</span></>
            )}
            {feedback === 'incorrect' && (
              <><XCircle size={13} style={{ color: '#ef4444' }} className="shrink-0" />
                <span style={{ color: '#ef4444' }}>正確答案：{currentProg?.label}</span></>
            )}
          </div>

          {/* Replay button */}
          {(phase === 'answering' || (phase === 'playing')) && (
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
                const isCorrect = feedback && currentProg?.id === opt.id;
                const isWrong = feedback === 'incorrect' && selected === opt.id;
                let style: React.CSSProperties = { background: 'var(--input-bg)', border: '1px solid var(--bd)', color: 'var(--tx-sub)' };
                if (isCorrect) style = { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', boxShadow: '0 0 12px rgba(16,185,129,0.15)' };
                else if (isWrong) style = { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' };
                else if (feedback) style = { ...style, opacity: 0.5 };

                return (
                  <button
                    key={opt.id}
                    disabled={!!feedback}
                    onClick={() => handleAnswer(opt)}
                    className="py-4 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer"
                    style={style}
                  >
                    <div className="text-sm mb-1">{opt.romanNumerals.join(' - ')}</div>
                    <div className="text-[10px] opacity-60">{opt.label}</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Next / Incorrect replay */}
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

export default ProgressionTraining;
