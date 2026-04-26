
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, Play, CheckCircle, RotateCcw, Target } from 'lucide-react';
import { PitchMatchPhase, PitchMatchQuestion, PitchMatchResult } from '../types';
import { NOTE_STRINGS, getNoteFromFrequency, playPitchTone, createPreviewOscillator } from '../utils/audioEngine';

interface Props {
  onBack: () => void;
  volume?: number;
}

const MIDI_MIN = 36;
const MIDI_MAX = 84;
const QUESTION_MIDI_MIN = 48;
const QUESTION_MIDI_MAX = 83;

const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

const PitchMatchingTraining: React.FC<Props> = ({ onBack, volume = 0.5 }) => {
  const [phase, setPhase] = useState<PitchMatchPhase>('idle');
  const [question, setQuestion] = useState<PitchMatchQuestion | null>(null);
  const [userMidi, setUserMidi] = useState(60);
  const [result, setResult] = useState<PitchMatchResult | null>(null);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [isPreviewOn, setIsPreviewOn] = useState(false);

  const previewOscRef = useRef<ReturnType<typeof createPreviewOscillator> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      previewOscRef.current?.stop();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const stopPreview = useCallback(() => {
    previewOscRef.current?.stop();
    previewOscRef.current = null;
    setIsPreviewOn(false);
  }, []);

  const buildQuestion = (): PitchMatchQuestion => {
    const targetMidi = QUESTION_MIDI_MIN + Math.floor(Math.random() * (QUESTION_MIDI_MAX - QUESTION_MIDI_MIN + 1));
    const targetFreq = midiToFreq(targetMidi);
    const noteIndex = ((targetMidi % 12) + 12) % 12;
    const octave = Math.floor(targetMidi / 12) - 1;
    return { targetMidi, targetFreq, targetLabel: `${NOTE_STRINGS[noteIndex]}${octave}` };
  };

  const startNewQuestion = useCallback(() => {
    stopPreview();
    setResult(null);
    setUserMidi(60);
    const q = buildQuestion();
    setQuestion(q);
    setPhase('playing');
    playPitchTone(q.targetFreq, 2.5, volume);
    timerRef.current = setTimeout(() => setPhase('answering'), 2700);
  }, [volume, stopPreview]);

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

  const handleSliderRelease = useCallback(() => {
    stopPreview();
  }, [stopPreview]);

  const handleSubmit = useCallback(() => {
    if (!question) return;
    stopPreview();
    const userFreq = midiToFreq(userMidi);
    const centsError = 1200 * Math.log2(userFreq / question.targetFreq);
    const score = Math.max(0, Math.round(100 * (1 - Math.abs(centsError) / 100)));
    const r: PitchMatchResult = { targetMidi: question.targetMidi, userFreq, centsError, score };
    setResult(r);
    setTotal(t => t + 1);
    if (score >= 80) setCorrect(c => c + 1);
    setPhase('result');
  }, [question, userMidi, stopPreview]);

  // Current slider display info
  const sliderFreq = midiToFreq(userMidi);
  const sliderNote = getNoteFromFrequency(sliderFreq);

  // Score color
  const scoreColor = (s: number) => s >= 80 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444';
  const scoreBg = (s: number) => s >= 80 ? 'rgba(16,185,129,0.08)' : s >= 50 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)';
  const scoreBorder = (s: number) => s >= 80 ? 'rgba(16,185,129,0.3)' : s >= 50 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)';

  return (
    <div className="flex flex-col h-full max-w-xl lg:max-w-3xl mx-auto p-4 sm:p-6 overflow-y-auto animate-slide-up">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => { stopPreview(); if (timerRef.current) clearTimeout(timerRef.current); onBack(); }} className="btn-ghost p-2 cursor-pointer">
          <Settings size={18} />
        </button>
        <div className="text-center">
          <p className="text-[10px] text-tx-muted uppercase tracking-widest mb-0.5">音高匹配</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="label">分數</span>
          <div className="text-xl font-black leading-none">
            <span className="gradient-text">{correct}</span>
            <span className="text-tx-muted mx-1">/</span>
            <span className="text-tx-sub">{total}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8">

        {/* Idle state */}
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

        {/* Playing state */}
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

        {/* Answering state */}
        {phase === 'answering' && question && (
          <div className="w-full max-w-md space-y-8 animate-fade-in">
            {/* Replay button */}
            <div className="flex justify-center">
              <button onClick={handleReplay} className="btn-ghost flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-wider cursor-pointer">
                <RotateCcw size={14} />
                重播音高
              </button>
            </div>

            {/* Slider section */}
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

        {/* Result state */}
        {phase === 'result' && result && question && (
          <div className="w-full max-w-md space-y-6 animate-bounce-in">
            {/* Score card */}
            <div className="card p-6 space-y-4">
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: scoreBg(result.score), border: `2px solid ${scoreBorder(result.score)}` }}>
                  {result.score >= 80
                    ? <CheckCircle size={36} style={{ color: scoreColor(result.score) }} />
                    : <Target size={36} style={{ color: scoreColor(result.score) }} />
                  }
                </div>
                <div className="text-center">
                  <p className="text-5xl font-black" style={{ color: scoreColor(result.score) }}>{result.score}</p>
                  <p className="text-xs text-tx-muted mt-1">分</p>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--input-bg)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${result.score}%`, background: scoreColor(result.score) }} />
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
                  <span className="font-bold" style={{ color: scoreColor(result.score) }}>
                    {result.centsError === 0
                      ? '完全準確'
                      : `${result.centsError > 0 ? '+' : ''}${Math.round(result.centsError)} c · ${result.centsError > 0 ? '偏高' : '偏低'}`
                    }
                  </span>
                </div>
              </div>
            </div>

            <button onClick={startNewQuestion} className="w-full btn-primary py-4 text-base font-bold tracking-wide active:scale-95" style={{ boxShadow: '0 4px 20px rgba(200,149,108,0.2)' }}>
              下一題
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PitchMatchingTraining;
