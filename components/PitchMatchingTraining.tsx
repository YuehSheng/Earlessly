
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, Play, CheckCircle, RotateCcw, Target } from 'lucide-react';
import { PitchMatchQuestion, PitchMatchResult } from '../types';
import { NOTE_STRINGS, getNoteFromFrequency, playPitchTone, createPreviewOscillator } from '../utils/audioEngine';
import { midiToFreq, centsBetween, noteIndex, midiOctave, randInt } from '../utils/math';
import { getScorePalette } from '../utils/scoring';
import { useTrainingSession } from '../hooks/useTrainingSession';
import GradientButton from './common/GradientButton';

interface Props {
  onBack: () => void;
  volume?: number;
}

const MIDI_MIN = 36;
const MIDI_MAX = 84;
const QUESTION_MIDI_MIN = 48;
const QUESTION_MIDI_MAX = 83;

const PitchMatchingTraining: React.FC<Props> = ({ onBack, volume = 0.5 }) => {
  const [userMidi, setUserMidi] = useState(60);
  const [result, setResult] = useState<PitchMatchResult | null>(null);
  const [isPreviewOn, setIsPreviewOn] = useState(false);

  const session = useTrainingSession<PitchMatchQuestion>({ autoAdvanceMs: 0 });
  const { phase, setPhase, question, setQuestion, score, scheduleTimer, clearTimers } = session;

  const previewOscRef = useRef<ReturnType<typeof createPreviewOscillator> | null>(null);

  useEffect(() => {
    return () => {
      previewOscRef.current?.stop();
    };
  }, []);

  const stopPreview = useCallback(() => {
    previewOscRef.current?.stop();
    previewOscRef.current = null;
    setIsPreviewOn(false);
  }, []);

  const buildQuestion = (): PitchMatchQuestion => {
    const targetMidi = randInt(QUESTION_MIDI_MIN, QUESTION_MIDI_MAX);
    const targetFreq = midiToFreq(targetMidi);
    return {
      targetMidi,
      targetFreq,
      targetLabel: `${NOTE_STRINGS[noteIndex(targetMidi)]}${midiOctave(targetMidi)}`,
    };
  };

  const startNewQuestion = useCallback(() => {
    stopPreview();
    setResult(null);
    setUserMidi(60);
    const q = buildQuestion();
    setQuestion(q);
    setPhase('playing');
    playPitchTone(q.targetFreq, 2.5, volume);
    scheduleTimer(() => setPhase('answering'), 2700);
  }, [volume, stopPreview, setQuestion, setPhase, scheduleTimer]);

  const handleReplay = useCallback(() => {
    if (!question) return;
    playPitchTone(question.targetFreq, 2.5, volume);
  }, [question, volume]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const midi = parseFloat(e.target.value);
    setUserMidi(midi);
    const freq = midiToFreq(midi);
    if (!previewOscRef.current) {
      previewOscRef.current = createPreviewOscillator(volume);
      setIsPreviewOn(true);
    }
    previewOscRef.current.setFrequency(freq);
  }, [volume]);

  const handleSliderRelease = useCallback(() => stopPreview(), [stopPreview]);

  const handleSubmit = useCallback(() => {
    if (!question) return;
    stopPreview();
    const userFreq = midiToFreq(userMidi);
    const centsError = centsBetween(question.targetFreq, userFreq);
    const scoreVal = Math.max(0, Math.round(100 * (1 - Math.abs(centsError) / 100)));
    const r: PitchMatchResult = { targetMidi: question.targetMidi, userFreq, centsError, score: scoreVal };
    setResult(r);
    if (scoreVal >= 80) session.markCorrect();
    else session.markIncorrect();
    setPhase('result');
  }, [question, userMidi, stopPreview, session, setPhase]);

  const sliderFreq = midiToFreq(userMidi);
  const sliderNote = getNoteFromFrequency(sliderFreq);
  const palette = result ? getScorePalette(result.score) : null;

  return (
    <div className="flex flex-col h-full max-w-xl lg:max-w-3xl mx-auto p-4 sm:p-6 overflow-y-auto animate-slide-up">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => { stopPreview(); clearTimers(); onBack(); }} className="btn-ghost p-2 cursor-pointer">
          <Settings size={18} />
        </button>
        <div className="text-center">
          <p className="text-[10px] text-tx-muted uppercase tracking-widest mb-0.5">音高匹配</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="label">分數</span>
          <div className="text-xl font-black leading-none">
            <span className="gradient-text">{score.correct}</span>
            <span className="text-tx-muted mx-1">/</span>
            <span className="text-tx-sub">{score.total}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8">

        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-6 animate-fade-in">
            <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ background: 'var(--primary-bg)', border: '2px solid var(--primary)' }}>
              <Target size={40} style={{ color: 'var(--primary-sub)' }} />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm text-tx-sub">系統播放一個音高，聆聽後</p>
              <p className="text-sm text-tx-sub">調整滑桿匹配相同音高後提交</p>
            </div>
            <button onClick={startNewQuestion} className="btn-primary px-12 py-4 text-base tracking-wide active:scale-95" style={{ boxShadow: '0 4px 20px rgba(200,149,108,0.2)' }}>
              開始訓練
            </button>
          </div>
        )}

        {phase === 'playing' && (
          <div className="flex flex-col items-center gap-6 animate-fade-in">
            <div className="relative w-28 h-28">
              <div className="w-28 h-28 rounded-full btn-primary flex items-center justify-center animate-glow-pulse" style={{ boxShadow: '0 8px 32px rgba(200,149,108,0.3)' }}>
                <Play size={40} className="text-white" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 animate-ping" style={{ borderColor: 'var(--primary)', animationDuration: '1.5s' }} />
            </div>
            <p className="text-sm text-tx-muted animate-pulse">正在播放音高，請仔細聆聽...</p>
          </div>
        )}

        {phase === 'answering' && question && (
          <div className="w-full max-w-md space-y-8 animate-fade-in">
            <div className="flex justify-center">
              <button onClick={handleReplay} className="btn-ghost flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-wider cursor-pointer">
                <RotateCcw size={14} />
                重播音高
              </button>
            </div>

            <div className="card p-6 space-y-6">
              <div className="text-center space-y-1">
                <p className="text-2xl font-black" style={{ color: 'var(--primary-sub)' }}>
                  {sliderNote.note}{sliderNote.octave}
                </p>
                <p className="text-xs text-tx-muted">{Math.round(sliderFreq)} Hz</p>
                {sliderNote.cents !== 0 && (
                  <p className="text-[10px]" style={{ color: 'var(--tx-muted)' }}>
                    {sliderNote.cents > 0 ? '+' : ''}{sliderNote.cents} 音分
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-[10px] text-tx-muted px-1">
                  <span>C2</span>
                  <span>← 拖曳調整音高 →</span>
                  <span>C6</span>
                </div>
                <input
                  type="range"
                  min={MIDI_MIN}
                  max={MIDI_MAX}
                  step={0.1}
                  value={userMidi}
                  onChange={handleSliderChange}
                  onPointerUp={handleSliderRelease}
                  onMouseUp={handleSliderRelease}
                  className="w-full cursor-pointer"
                  style={{ accentColor: 'var(--primary)' }}
                />
              </div>

              {isPreviewOn && (
                <p className="text-center text-[10px] text-tx-muted animate-pulse">▶ 預覽中...</p>
              )}
            </div>

            <button
              onClick={handleSubmit}
              className="w-full btn-primary py-4 text-base font-bold tracking-wide active:scale-95"
              style={{ boxShadow: '0 4px 20px rgba(200,149,108,0.2)' }}
            >
              提交答案
            </button>
          </div>
        )}

        {phase === 'result' && result && question && palette && (
          <div className="w-full max-w-md space-y-6 animate-bounce-in">
            <div className="card p-6 space-y-4">
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: palette.bg, border: `2px solid ${palette.border}` }}>
                  {result.score >= 80
                    ? <CheckCircle size={36} style={{ color: palette.color }} />
                    : <Target size={36} style={{ color: palette.color }} />
                  }
                </div>
                <div className="text-center">
                  <p className="text-5xl font-black" style={{ color: palette.color }}>{result.score}</p>
                  <p className="text-xs text-tx-muted mt-1">分</p>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--input-bg)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${result.score}%`, background: palette.color }} />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--bd)' }}>
                <div className="flex justify-between items-center text-xs py-1.5">
                  <span className="text-tx-muted">目標音高</span>
                  <span className="font-bold" style={{ color: 'var(--tx)' }}>{question.targetLabel} · {Math.round(question.targetFreq)} Hz</span>
                </div>
                <div className="flex justify-between items-center text-xs py-1.5">
                  <span className="text-tx-muted">你的答案</span>
                  <span className="font-bold" style={{ color: 'var(--tx)' }}>
                    {getNoteFromFrequency(result.userFreq).note}{getNoteFromFrequency(result.userFreq).octave} · {Math.round(result.userFreq)} Hz
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs py-1.5">
                  <span className="text-tx-muted">音分差</span>
                  <span className="font-bold" style={{ color: palette.color }}>
                    {result.centsError === 0
                      ? '完全準確'
                      : `${result.centsError > 0 ? '+' : ''}${Math.round(result.centsError)} c · ${result.centsError > 0 ? '偏高' : '偏低'}`
                    }
                  </span>
                </div>
              </div>
            </div>

            <GradientButton onClick={startNewQuestion} size="lg" className="w-full">
              下一題
            </GradientButton>
          </div>
        )}
      </div>
    </div>
  );
};

export default PitchMatchingTraining;
