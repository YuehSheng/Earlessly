
import React, { useState, useCallback } from 'react';
import { Settings, Play, CheckCircle, XCircle, SkipForward, Volume2 } from 'lucide-react';
import { playChordProgression, NOTE_STRINGS } from '../utils/audioEngine';
import { PROGRESSIONS, ProgressionDef } from '../types';
import { shuffle, noteIndex } from '../utils/math';
import { useTrainingSession } from '../hooks/useTrainingSession';
import GradientButton from './common/GradientButton';
import StatusBar from './common/StatusBar';
import OptionsGrid, { optionStyle } from './common/OptionsGrid';
import ScoreBadge from './common/ScoreBadge';

interface Props { onBack: () => void; volume?: number; }

interface ProgressionQuestion {
  prog: ProgressionDef;
  rootMidi: number;
  options: ProgressionDef[];
}

const ProgressionTraining: React.FC<Props> = ({ onBack }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    PROGRESSIONS.slice(0, 6).map(p => p.id)
  );
  const [bpm, setBpm] = useState(90);
  const [selected, setSelected] = useState<string | null>(null);

  const session = useTrainingSession<ProgressionQuestion>();
  const { phase, setPhase, question, setQuestion, feedback, setFeedback, score, scheduleTimer, markCorrect, markIncorrect } = session;

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
    const root = 48 + Math.floor(Math.random() * 12);

    const others = PROGRESSIONS.filter(p => p.id !== answer.id);
    const distractors = shuffle(others).slice(0, 3);
    const options = shuffle([answer, ...distractors]);

    setQuestion({ prog: answer, rootMidi: root, options });
    setPhase('playing');
    playChordProgression(answer.degrees, root, bpm);

    const totalDur = (answer.degrees.length * (60 / bpm)) * 1000 + 300;
    scheduleTimer(() => setPhase('answering'), totalDur);
  }, [activeProgs, bpm, setFeedback, setQuestion, setPhase, scheduleTimer]);

  const replay = useCallback(() => {
    if (!question) return;
    playChordProgression(question.prog.degrees, question.rootMidi, bpm);
  }, [question, bpm]);

  const handleAnswer = useCallback((prog: ProgressionDef) => {
    if (feedback || !question) return;
    setSelected(prog.id);
    if (prog.id === question.prog.id) {
      markCorrect(generateQuestion);
    } else {
      markIncorrect(() => playChordProgression(question.prog.degrees, question.rootMidi, bpm));
    }
  }, [feedback, question, bpm, generateQuestion, markCorrect, markIncorrect]);

  const rootName = question ? NOTE_STRINGS[noteIndex(question.rootMidi)] : '';

  return (
    <div className="flex flex-col max-w-xl mx-auto w-full px-4 py-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="btn-ghost p-2 cursor-pointer" aria-label="返回設定">
          <Settings size={18} />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
            <button onClick={() => setBpm(b => Math.max(50, b - 10))} className="text-tx-muted hover:text-tx text-xs font-bold cursor-pointer">−</button>
            <span className="text-xs font-bold w-8 text-center" style={{ color: 'var(--primary-sub)' }}>{bpm}</span>
            <button onClick={() => setBpm(b => Math.min(160, b + 10))} className="text-tx-muted hover:text-tx text-xs font-bold cursor-pointer">+</button>
          </div>
          <ScoreBadge correct={score.correct} total={score.total} />
        </div>
      </div>

      {/* Idle: progression selector */}
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
                      ? { background: 'rgba(200,149,108,0.08)', border: '1px solid rgba(200,149,108,0.3)', color: 'var(--primary-sub)' }
                      : { background: 'var(--input-bg)', border: '1px solid var(--bd)', color: 'var(--tx-muted)' }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-center">
            <GradientButton onClick={generateQuestion}>
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
            {phase === 'playing' && `播放和弦進行中（${rootName} 調）…`}
            {phase === 'answering' && !feedback && '請選擇你聽到的和弦進行'}
            {feedback === 'correct' && `正確！${question.prog.label}`}
            {feedback === 'incorrect' && `正確答案：${question.prog.label}`}
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
                const isCorrect = feedback && question.prog.id === opt.id;
                const isWrong = feedback === 'incorrect' && selected === opt.id;
                const state = isCorrect ? 'correct' : isWrong ? 'wrong' : feedback ? 'dimmed' : 'idle';
                return (
                  <button
                    key={opt.id}
                    disabled={!!feedback}
                    aria-pressed={selected === opt.id}
                    onClick={() => handleAnswer(opt)}
                    className="py-4 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer"
                    style={optionStyle(state)}
                  >
                    <div className="text-sm mb-1">{opt.romanNumerals.join(' - ')}</div>
                    <div className="text-[10px] opacity-60">{opt.label}</div>
                  </button>
                );
              })}
            </OptionsGrid>
          )}

          {feedback && (
            <div className="mb-5 card p-3">
              <div className="label mb-2">和弦進行解析（{rootName} 調）</div>
              <div className="flex gap-1.5 flex-wrap justify-center">
                {question.prog.degrees.map((chord, ci) => (
                  <div key={ci} className="px-2.5 py-1.5 rounded-lg text-center"
                    style={{ background: 'var(--primary-bg)', border: '1px solid rgba(200,149,108,0.2)' }}>
                    <div className="text-xs font-bold" style={{ color: 'var(--primary-sub)' }}>
                      {question.prog.romanNumerals[ci]}
                    </div>
                    <div className="text-[10px] opacity-70" style={{ color: 'var(--primary-sub)' }}>
                      {chord.map(d => NOTE_STRINGS[noteIndex(question.rootMidi + d)]).join(' ')}
                    </div>
                  </div>
                ))}
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
              <GradientButton onClick={generateQuestion}>
                <SkipForward size={16} /> 下一題
              </GradientButton>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProgressionTraining;
