
import React, { useState, useCallback } from 'react';
import { Settings, Play, CheckCircle, XCircle, SkipForward, Volume2 } from 'lucide-react';
import { playScale, NOTE_STRINGS } from '../utils/audioEngine';
import { ScaleType, SCALE_INTERVALS } from '../types';
import { shuffle, noteIndex } from '../utils/math';
import { useTrainingSession } from '../hooks/useTrainingSession';
import GradientButton from './common/GradientButton';
import StatusBar from './common/StatusBar';
import OptionsGrid, { optionStyle } from './common/OptionsGrid';
import ScoreBadge from './common/ScoreBadge';

type Direction = 'up' | 'down' | 'updown';

interface Props { onBack: () => void; volume?: number; }

const ALL_SCALES = Object.values(ScaleType);

interface ScaleQuestion {
  scale: ScaleType;
  rootMidi: number;
  options: ScaleType[];
}

const ScaleTraining: React.FC<Props> = ({ onBack }) => {
  const [selectedScales, setSelectedScales] = useState<ScaleType[]>([
    ScaleType.MAJOR, ScaleType.NATURAL_MINOR, ScaleType.DORIAN, ScaleType.MIXOLYDIAN,
  ]);
  const [direction, setDirection] = useState<Direction>('up');
  const [speed, setSpeed] = useState(1.0);
  const [selected, setSelected] = useState<ScaleType | null>(null);

  const session = useTrainingSession<ScaleQuestion>();
  const { phase, setPhase, question, setQuestion, feedback, setFeedback, score, scheduleTimer, markCorrect, markIncorrect } = session;

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

    const others = ALL_SCALES.filter(s => s !== answer);
    const numOptions = Math.min(pool.length, 4);
    const distractors = shuffle(others).slice(0, numOptions - 1);
    const options = shuffle([answer, ...distractors]);

    setQuestion({ scale: answer, rootMidi: root, options });
    setPhase('playing');
    const intervals = SCALE_INTERVALS[answer];
    playScale(root, intervals, speed, direction);

    let noteCount = intervals.length;
    if (direction === 'updown') noteCount = noteCount * 2 - 1;
    const totalDur = noteCount * 0.25 * speed * 1000 + 400;
    scheduleTimer(() => setPhase('answering'), totalDur);
  }, [selectedScales, speed, direction, setFeedback, setQuestion, setPhase, scheduleTimer]);

  const replay = useCallback(() => {
    if (!question) return;
    playScale(question.rootMidi, SCALE_INTERVALS[question.scale], speed, direction);
  }, [question, speed, direction]);

  const handleAnswer = useCallback((scale: ScaleType) => {
    if (feedback || !question) return;
    setSelected(scale);

    if (scale === question.scale) {
      markCorrect(generateQuestion);
    } else {
      markIncorrect(() => playScale(question.rootMidi, SCALE_INTERVALS[question.scale], speed, direction));
    }
  }, [feedback, question, speed, direction, generateQuestion, markCorrect, markIncorrect]);

  const rootName = question ? NOTE_STRINGS[noteIndex(question.rootMidi)] : '';

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
          <ScoreBadge correct={score.correct} total={score.total} />
        </div>
      </div>

      {/* Idle: scale selector */}
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
                      ? { background: 'rgba(200,149,108,0.08)', border: '1px solid rgba(200,149,108,0.3)', color: 'var(--primary-sub)' }
                      : { background: 'var(--input-bg)', border: '1px solid var(--bd)', color: 'var(--tx-muted)' }}
                  >{s}</button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-center">
            <GradientButton onClick={generateQuestion} size="md">
              <Play size={16} /> 開始練習
            </GradientButton>
          </div>
        </div>
      )}

      {/* Playing / Answering / Result */}
      {phase !== 'idle' && question && (
        <>
          <StatusBar tone={feedback ?? phase}
            icon={
              phase === 'answering' && !feedback ? <Volume2 size={13} style={{ color: 'var(--primary)' }} className="shrink-0" /> :
              feedback === 'correct' ? <CheckCircle size={13} className="shrink-0" /> :
              feedback === 'incorrect' ? <XCircle size={13} className="shrink-0" /> :
              undefined
            }
          >
            {phase === 'playing' && `播放音階中（${rootName} 起始）…`}
            {phase === 'answering' && !feedback && '這是什麼音階 / 調式？'}
            {feedback === 'correct' && `正確！${rootName} ${question.scale}`}
            {feedback === 'incorrect' && `正確答案：${rootName} ${question.scale}`}
          </StatusBar>

          {(phase === 'answering' || phase === 'playing') && (
            <div className="flex justify-center mb-5">
              <button onClick={replay}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm cursor-pointer hover:opacity-80 active:scale-95 transition-all btn-ghost">
                <Play size={14} /> 重播
              </button>
            </div>
          )}

          {(phase === 'answering' || feedback) && (
            <OptionsGrid columns={2}>
              {question.options.map(opt => {
                const isCorrect = feedback && question.scale === opt;
                const isWrong = feedback === 'incorrect' && selected === opt;
                const state = isCorrect ? 'correct' : isWrong ? 'wrong' : feedback ? 'dimmed' : 'idle';
                return (
                  <button key={opt} disabled={!!feedback} aria-pressed={selected === opt} onClick={() => handleAnswer(opt)}
                    className="h-14 rounded-xl font-bold text-xs tracking-wider transition-all cursor-pointer px-3"
                    style={optionStyle(state)}>
                    {opt}
                  </button>
                );
              })}
            </OptionsGrid>
          )}

          {feedback && (
            <div className="mb-5 card p-3">
              <div className="label mb-2">音階組成音</div>
              <div className="flex gap-1.5 flex-wrap justify-center">
                {SCALE_INTERVALS[question.scale].map((interval, i) => {
                  const midi = question.rootMidi + interval;
                  const name = NOTE_STRINGS[noteIndex(midi)];
                  return (
                    <div key={i} className="px-2.5 py-1.5 rounded-lg text-xs font-bold"
                      style={{ background: 'var(--primary-bg)', border: '1px solid rgba(200,149,108,0.2)', color: 'var(--primary-sub)' }}>
                      {name}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {feedback && (
            <div className="flex justify-center gap-3">
              {feedback === 'incorrect' && (
                <button onClick={replay} className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer hover:opacity-80 active:scale-95 transition-all btn-ghost">
                  <Volume2 size={14} /> 重聽正確答案
                </button>
              )}
              <GradientButton onClick={generateQuestion} size="md">
                <SkipForward size={16} /> 下一題
              </GradientButton>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ScaleTraining;
