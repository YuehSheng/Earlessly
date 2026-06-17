
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, Pause, Check, ChevronRight, Volume2, RotateCcw, Trophy } from 'lucide-react';
import { DrumMachineEngine } from '../utils/audio/drumMachine';
import { DRUM_VOICE_LABELS } from '../utils/audio/drums';
import { resumeAudio } from '../utils/audio/context';
import { DrumVoice, DrumMeter, DRUM_METERS, meterSteps } from '../types';
import {
  QUIZ_LEVELS, QUIZ_BPM, QuizLevel, DrumQuestion, DrumAnswer, QuizScore,
  emptyAnswer, generateQuestion, scoreAnswer, toTracks,
} from '../utils/audio/drumQuiz';

interface DrumQuizProps {
  volume: number;
}

type Source = 'none' | 'question' | 'answer';

const DrumQuiz: React.FC<DrumQuizProps> = ({ volume }) => {
  const [level, setLevel] = useState<QuizLevel>(1);
  const [meter, setMeter] = useState<DrumMeter>('4/4');
  const [question, setQuestion] = useState<DrumQuestion>(() => generateQuestion(1, '4/4'));
  const [answer, setAnswer] = useState<DrumAnswer>(() => emptyAnswer(meterSteps('4/4')));
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState<QuizScore | null>(null);
  const [source, setSource] = useState<Source>('none');
  const [currentStep, setCurrentStep] = useState(-1);
  // Session tally — light motivation, not persisted.
  const [stats, setStats] = useState({ solved: 0, perfect: 0 });

  const engineRef = useRef<DrumMachineEngine | null>(null);

  useEffect(() => {
    engineRef.current = new DrumMachineEngine(step => setCurrentStep(step));
    engineRef.current.setVolume(volume);
    return () => engineRef.current?.destroy();
  }, []);

  useEffect(() => { engineRef.current?.setVolume(volume); }, [volume]);

  // Drive the engine: play whichever grid the user asked to hear, looping.
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const grid = source === 'answer' ? answer : question.pattern;
    const noSolo = question.voices.map(() => false);
    eng.setParams(QUIZ_BPM, 0, toTracks(grid, question.voices), noSolo);
    if (source === 'none') eng.stop();
    else eng.start();
  }, [source, question, answer]);

  const stopAudio = useCallback(() => { setSource('none'); setCurrentStep(-1); }, []);

  const newQuestion = useCallback((lvl: QuizLevel, mtr: DrumMeter) => {
    stopAudio();
    setQuestion(prev => generateQuestion(lvl, mtr, prev));
    setAnswer(emptyAnswer(meterSteps(mtr)));
    setRevealed(false);
    setScore(null);
  }, [stopAudio]);

  const chooseLevel = (lvl: QuizLevel) => {
    if (lvl === level && !revealed) return;
    setLevel(lvl);
    newQuestion(lvl, meter);
  };

  const chooseMeter = (mtr: DrumMeter) => {
    if (mtr === meter) return;
    setMeter(mtr);
    newQuestion(level, mtr);
  };

  const toggleSource = (src: Exclude<Source, 'none'>) => {
    resumeAudio();
    setCurrentStep(-1);
    setSource(prev => (prev === src ? 'none' : src));
  };

  const toggleStep = (voice: DrumVoice, stepIdx: number) => {
    if (revealed) return; // locked after submitting
    setAnswer(prev => ({ ...prev, [voice]: prev[voice].map((s, i) => (i === stepIdx ? !s : s)) }));
  };

  const submit = () => {
    const result = scoreAnswer(question, answer);
    setScore(result);
    setRevealed(true);
    stopAudio();
    setStats(s => ({ solved: s.solved + 1, perfect: s.perfect + (result.perfect ? 1 : 0) }));
  };

  const answerHasHits = useMemo(
    () => question.voices.some(v => answer[v].some(Boolean)),
    [question, answer],
  );

  const steps = question.pattern[question.voices[0]].length; // 12 for 3/4, 16 for 4/4

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto p-3 sm:p-5 space-y-3 lg:space-y-4 overflow-y-auto h-full no-scrollbar animate-slide-up">

      {/* ===== Difficulty selector ===== */}
      <div className="card p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="label">難度</span>
            <div role="group" aria-label="拍號" className="flex card-inner p-1 gap-0.5">
              {DRUM_METERS.map(({ meter: m }) => {
                const isActive = meter === m;
                return (
                  <button
                    key={m}
                    onClick={() => chooseMeter(m)}
                    aria-pressed={isActive}
                    className="px-2.5 h-7 rounded-md text-[11px] font-extrabold font-mono transition-all cursor-pointer"
                    style={isActive
                      ? { background: 'var(--primary-bg)', border: '1px solid var(--primary)', color: 'var(--primary-sub)' }
                      : { background: 'transparent', color: 'var(--tx-muted)' }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
          {stats.solved > 0 && (
            <span className="text-[11px] text-tx-muted flex items-center gap-1.5">
              <Trophy size={11} /> 完美 {stats.perfect} / {stats.solved} 題
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {QUIZ_LEVELS.map(def => {
            const isActive = def.level === level;
            return (
              <button
                key={def.level}
                onClick={() => chooseLevel(def.level)}
                aria-pressed={isActive}
                className="rounded-xl p-2.5 text-left transition-all cursor-pointer"
                style={isActive
                  ? { background: 'var(--primary-bg)', border: '1px solid var(--primary)' }
                  : { background: 'var(--input-bg)', border: '1px solid var(--bd)' }}
              >
                <div className="text-sm font-extrabold" style={{ color: isActive ? 'var(--primary-sub)' : 'var(--tx)' }}>
                  Lv.{def.level} {def.label}
                </div>
                <div className="text-[10px] text-tx-muted mt-0.5 leading-tight">{def.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== Quiz transport ===== */}
      <div className="card p-3 sm:p-4 flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          onClick={() => toggleSource('question')}
          className={`flex items-center gap-2 px-4 h-11 rounded-xl font-bold text-sm transition-all active:scale-95 cursor-pointer ${
            source === 'question' ? 'bg-danger text-white' : 'btn-primary'
          }`}
        >
          {source === 'question' ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          播放題目
        </button>

        <button
          onClick={() => toggleSource('answer')}
          disabled={!answerHasHits}
          className="btn-ghost flex items-center gap-1.5 px-3 h-11 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {source === 'answer' ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          試聽作答
        </button>

        <div className="flex-1" />

        {!revealed ? (
          <button
            onClick={submit}
            disabled={!answerHasHits}
            className="btn-primary flex items-center gap-1.5 px-4 h-11 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check size={16} /> 對答案
          </button>
        ) : (
          <button
            onClick={() => newQuestion(level, meter)}
            className="btn-primary flex items-center gap-1.5 px-4 h-11 rounded-xl text-sm font-bold animate-glow-pulse"
          >
            下一題 <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* ===== Result banner ===== */}
      {score && (
        <div
          className="card p-3 sm:p-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 animate-fade-in"
          style={{
            background: score.perfect ? 'var(--status-success-bg)' : undefined,
            border: score.perfect ? '1px solid var(--status-success-border)' : undefined,
          }}
        >
          <span
            className="text-2xl font-black"
            style={{ color: score.perfect ? 'var(--status-success)' : 'var(--primary-sub)' }}
          >
            {score.perfect ? '完美！' : `${score.accuracy}%`}
          </span>
          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--status-success)' }}>
            <span className="font-bold">{score.correct}</span> 正確
          </span>
          {score.missed > 0 && (
            <span className="text-xs text-tx-muted"><span className="font-bold">{score.missed}</span> 漏掉</span>
          )}
          {score.wrong > 0 && (
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--status-danger)' }}>
              <span className="font-bold">{score.wrong}</span> 多按
            </span>
          )}
          <span className="text-[11px] text-tx-muted ml-auto">綠=正確 · 紅=多按 · 虛線=漏掉</span>
        </div>
      )}

      {/* ===== Answer grid ===== */}
      <div className="card p-2 sm:p-3 overflow-x-auto">
        <div className="min-w-[640px] space-y-1.5">
          {/* Header: beat numbers */}
          <div className="flex items-center gap-2 pl-[72px] pr-1">
            {Array.from({ length: steps }).map((_, i) => {
              const subAtBeat = i % 4 === 0;
              return (
                <div key={i} className="flex-1 flex justify-center" style={{ marginLeft: i > 0 && i % 4 === 0 ? 6 : 0 }}>
                  <span className={`text-[9px] font-mono ${subAtBeat ? 'text-tx-sub font-bold' : 'text-tx-muted'}`}>
                    {subAtBeat ? Math.floor(i / 4) + 1 : '·'}
                  </span>
                </div>
              );
            })}
          </div>

          {question.voices.map(voice => (
            <div key={voice} className="flex items-center gap-2 card-inner p-1.5 rounded-lg">
              <div className="w-[64px] shrink-0 text-xs font-bold pl-1" style={{ color: 'var(--tx)' }}>
                {DRUM_VOICE_LABELS[voice]}
              </div>

              <div className="flex items-center gap-2 flex-1">
                {answer[voice].map((on, stepIdx) => {
                  const isCurrent = source !== 'none' && stepIdx === currentStep;
                  const isBeatStart = stepIdx % 4 === 0;
                  const target = question.pattern[voice][stepIdx];

                  // Default (answering) palette; result phase recolours each cell.
                  let bg = on ? 'var(--primary)' : isBeatStart ? 'var(--input-bg)' : 'var(--bg-hover)';
                  let border = on ? '1px solid var(--primary)' : `1px solid ${isBeatStart ? 'var(--bd)' : 'transparent'}`;
                  let opacity = 1;

                  if (revealed) {
                    if (target && on) {                 // correct
                      bg = 'var(--status-success)';
                      border = '1px solid var(--status-success)';
                    } else if (!target && on) {         // extra / wrong
                      bg = 'var(--status-danger)';
                      border = '1px solid var(--status-danger)';
                    } else if (target && !on) {         // missed
                      bg = 'transparent';
                      border = '2px dashed var(--status-success)';
                      opacity = 0.85;
                    } else {                             // correctly empty
                      bg = isBeatStart ? 'var(--input-bg)' : 'var(--bg-hover)';
                      border = `1px solid ${isBeatStart ? 'var(--bd)' : 'transparent'}`;
                    }
                  }

                  if (isCurrent) border = '2px solid var(--primary-sub)';

                  return (
                    <button
                      key={stepIdx}
                      onClick={() => toggleStep(voice, stepIdx)}
                      disabled={revealed}
                      aria-pressed={on}
                      aria-label={`${DRUM_VOICE_LABELS[voice]} step ${stepIdx + 1}`}
                      className="flex-1 h-9 rounded-md transition-all select-none cursor-pointer disabled:cursor-default"
                      style={{
                        marginLeft: isBeatStart && stepIdx > 0 ? 6 : 0,
                        background: bg,
                        border,
                        opacity,
                        transform: isCurrent ? 'scaleY(1.1)' : 'scaleY(1)',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer hint */}
      <div className="flex items-center justify-between text-[11px] text-tx-muted px-1">
        <div className="flex items-center gap-1.5">
          <Volume2 size={11} /> 先聽題目，再在格子上重現節奏
        </div>
        {revealed && (
          <button
            onClick={() => newQuestion(level, meter)}
            className="btn-ghost px-2 py-1 text-[10px] flex items-center gap-1"
          >
            <RotateCcw size={10} /> 換一題
          </button>
        )}
      </div>

      <div className="h-4 w-full shrink-0"></div>
    </div>
  );
};

export default DrumQuiz;
