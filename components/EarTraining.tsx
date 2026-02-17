
import React, { useState, useEffect, useRef } from 'react';
import { Settings, Play, Music, CheckCircle, XCircle, ArrowRight, Volume2, Anchor, Mic, MicOff, RotateCcw } from 'lucide-react';
import { NoteName, ChordQuality, IntervalQuality, Question } from '../types';
import { generateQuestion, playNotes, NOTE_STRINGS, getAudioContext, autoCorrelate } from '../utils/audioEngine';
import FrequencyTraining from './FrequencyTraining';

interface EarTrainingProps { volume?: number; }

const EarTraining: React.FC<EarTrainingProps> = ({ volume = 0.5 }) => {
  const [mode, setMode] = useState<'settings' | 'game'>('settings');
  const [gameMode, setGameMode] = useState<'note' | 'chord' | 'interval' | 'vocal' | 'frequency'>('note');
  const [selectedNotes, setSelectedNotes] = useState<NoteName[]>(NOTE_STRINGS);
  const [octaveRange, setOctaveRange] = useState<[number, number]>([3, 5]);
  const [polyphony, setPolyphony] = useState(1);
  const [chordQualities, setChordQualities] = useState<ChordQuality[]>([ChordQuality.MAJOR, ChordQuality.MINOR]);
  const [intervalQualities, setIntervalQualities] = useState<IntervalQuality[]>([IntervalQuality.M3, IntervalQuality.P5, IntervalQuality.P8]);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [userSelection, setUserSelection] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const [isListening, setIsListening] = useState(false);
  const [currentCentsOff, setCurrentCentsOff] = useState<number | null>(null);
  const [vocalHoldProgress, setVocalHoldProgress] = useState(0);
  const [micVolume, setMicVolume] = useState(0);

  const autoAdvanceTimer = useRef<number | null>(null);
  const audioLoopRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const bufferRef = useRef<Float32Array | null>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    return () => { stopListening(); if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current); };
  }, []);

  useEffect(() => {
    if (mode === 'game' && currentQuestion && !feedback) {
      const timer = setTimeout(() => handlePlay(), 400);
      return () => clearTimeout(timer);
    }
  }, [currentQuestion, mode]);

  const toggleNote = (note: NoteName) => {
    if (selectedNotes.includes(note)) {
      if (selectedNotes.length > 1) setSelectedNotes(selectedNotes.filter(n => n !== note));
    } else setSelectedNotes([...selectedNotes, note].sort((a, b) => NOTE_STRINGS.indexOf(a) - NOTE_STRINGS.indexOf(b)));
  };

  const toggleChord = (q: ChordQuality) => setChordQualities(prev => prev.includes(q) ? (prev.length > 1 ? prev.filter(c => c !== q) : prev) : [...prev, q]);
  const toggleInterval = (q: IntervalQuality) => setIntervalQualities(prev => prev.includes(q) ? (prev.length > 1 ? prev.filter(c => c !== q) : prev) : [...prev, q]);

  const startGame = () => { setScore({ correct: 0, total: 0 }); setMode('game'); if (gameMode !== 'frequency') nextQuestion(); };

  const nextQuestion = () => {
    setFeedback(null); setUserSelection([]); setVocalHoldProgress(0); setCurrentCentsOff(null); setMicVolume(0); stopListening();
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    const q = generateQuestion({ mode: gameMode === 'vocal' ? 'note' : gameMode, selectedNotes, octaveRange, polyphony: gameMode === 'note' ? polyphony : (gameMode === 'vocal' ? 1 : 3), chordQualities, intervalQualities });
    setCurrentQuestion(q);
  };

  const handlePlay = () => { if (currentQuestion) playNotes(currentQuestion.notes, playbackSpeed, gameMode === 'interval' ? 'arpeggio' : 'simultaneous'); };
  const playReferenceC = () => playNotes([72], playbackSpeed);

  const toggleVocalTest = () => { if (isListeningRef.current) stopListening(); else startListening(); };

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyserRef.current = analyser; micStreamRef.current = stream; bufferRef.current = new Float32Array(analyser.fftSize);
      isListeningRef.current = true; setIsListening(true); vocalLoop();
    } catch (err) { console.error("Vocal match error:", err); alert("無法啟用麥克風，請檢查權限。"); }
  };

  const stopListening = () => {
    isListeningRef.current = false; setIsListening(false);
    if (audioLoopRef.current) { cancelAnimationFrame(audioLoopRef.current); audioLoopRef.current = null; }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    setMicVolume(0);
  };

  const vocalLoop = () => {
    if (!analyserRef.current || !bufferRef.current || !currentQuestion || !isListeningRef.current) return;
    analyserRef.current.getFloatTimeDomainData(bufferRef.current);
    let sumSquares = 0.0;
    for (const amplitude of bufferRef.current) sumSquares += amplitude * amplitude;
    setMicVolume(Math.sqrt(sumSquares / bufferRef.current.length));
    const freq = autoCorrelate(bufferRef.current, getAudioContext().sampleRate);
    if (freq > 0) {
      const targetMidi = currentQuestion.notes[0];
      const targetFreq = 440 * Math.pow(2, (targetMidi - 69) / 12);
      const cents = 1200 * Math.log2(freq / targetFreq);
      setCurrentCentsOff(cents);
      if (Math.abs(cents) < 40) {
        setVocalHoldProgress(prev => { const next = prev + 3; if (next >= 100) { setTimeout(() => handleVocalSuccess(), 0); return 100; } return next; });
      } else { setVocalHoldProgress(prev => Math.max(0, prev - 2)); }
    } else { setCurrentCentsOff(null); setVocalHoldProgress(prev => Math.max(0, prev - 1)); }
    if (isListeningRef.current) audioLoopRef.current = requestAnimationFrame(vocalLoop);
  };

  const handleVocalSuccess = () => {
    if (feedback) return;
    stopListening(); setFeedback('correct'); setScore(s => ({ correct: s.correct + 1, total: s.total + 1 }));
    autoAdvanceTimer.current = window.setTimeout(() => nextQuestion(), 1500);
  };

  const handleAnswerClick = (answer: string) => {
    if (feedback || !currentQuestion) return;
    if (gameMode === 'note') {
      if (polyphony === 1) {
        const isCorrect = currentQuestion.answerNames.includes(answer);
        setUserSelection([answer]);
        if (isCorrect) { setFeedback('correct'); setScore(s => ({ correct: s.correct + 1, total: s.total + 1 })); autoAdvanceTimer.current = window.setTimeout(() => nextQuestion(), 1000); }
        else { setFeedback('incorrect'); setScore(s => ({ ...s, total: s.total + 1 })); }
      } else setUserSelection(prev => prev.includes(answer) ? prev.filter(a => a !== answer) : (prev.length < polyphony ? [...prev, answer] : prev));
    } else {
      const isCorrect = currentQuestion.answerNames.includes(answer);
      setUserSelection([answer]);
      if (isCorrect) { setFeedback('correct'); setScore(s => ({ correct: s.correct + 1, total: s.total + 1 })); autoAdvanceTimer.current = window.setTimeout(() => nextQuestion(), 1500); }
      else { setFeedback('incorrect'); setScore(s => ({ ...s, total: s.total + 1 })); }
    }
  };

  const checkMultiNoteAnswer = () => {
    if (!currentQuestion || feedback) return;
    const correct = currentQuestion.answerNames;
    const isCorrect = userSelection.length === correct.length && userSelection.every(val => correct.includes(val));
    if (isCorrect) { setFeedback('correct'); setScore(s => ({ correct: s.correct + 1, total: s.total + 1 })); autoAdvanceTimer.current = window.setTimeout(() => nextQuestion(), 1500); }
    else { setFeedback('incorrect'); setScore(s => ({ ...s, total: s.total + 1 })); }
  };

  // ========== SETTINGS PAGE ==========
  if (mode === 'settings') {
    return (
      <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-5 overflow-y-auto animate-slide-up">
        <div className="text-center space-y-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold gradient-text">練習設定</h2>
          <p className="text-tx-muted text-xs sm:text-sm">自訂你的聽力訓練內容</p>
        </div>

        <div className="flex flex-col gap-4">
          {/* Mode Card */}
          <div className="card p-4 sm:p-6 space-y-4">
            <h3 className="font-bold text-tx text-sm flex items-center gap-2">1. 模式</h3>
            <div className="flex flex-wrap gap-1.5 p-1 card-inner">
              {(['note', 'interval', 'chord', 'vocal', 'frequency'] as const).map(m => {
                const labels: Record<string, string> = { note: '聽音', interval: '音程', chord: '和弦', vocal: '視唱', frequency: '頻率 EQ' };
                return (
                  <button key={m} onClick={() => setGameMode(m)} className={`flex-1 py-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${gameMode === m ? 'text-primary-sub' : 'text-tx-muted hover:text-tx-sub'}`} style={gameMode === m ? { background: 'var(--primary-bg)', border: '1px solid var(--primary)' } : {}}>
                    {labels[m]}
                  </button>
                );
              })}
            </div>

            {gameMode === 'note' && (
              <div className="space-y-2 animate-fade-in">
                <label className="label">複音數</label>
                <div className="flex gap-2">
                  {[1, 2, 3].map(n => (
                    <button key={n} onClick={() => setPolyphony(n)} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${polyphony === n ? 'text-primary-sub' : 'text-tx-muted hover:text-tx-sub'}`} style={polyphony === n ? { background: 'var(--primary-bg)', border: '1px solid var(--primary)' } : { background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
                      {n} 個音
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="label">音域範圍 (C{octaveRange[0]} - B{octaveRange[1]})</label>
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-1">
                  <label className="text-[9px] text-tx-muted block">起始八度</label>
                  <input type="number" min="1" max="7" value={octaveRange[0]} onChange={(e) => setOctaveRange([parseInt(e.target.value), Math.max(parseInt(e.target.value), octaveRange[1])])} className="w-full input-field p-2.5 text-center text-xs"/>
                </div>
                <span className="text-tx-muted font-bold self-end pb-3">-</span>
                <div className="flex-1 space-y-1">
                  <label className="text-[9px] text-tx-muted block">結束八度</label>
                  <input type="number" min="1" max="7" value={octaveRange[1]} onChange={(e) => setOctaveRange([Math.min(parseInt(e.target.value), octaveRange[0]), parseInt(e.target.value)])} className="w-full input-field p-2.5 text-center text-xs"/>
                </div>
              </div>
            </div>
          </div>

          {/* Content Card */}
          <div className="card p-4 sm:p-6 space-y-4">
            <h3 className="font-bold text-tx text-sm flex items-center gap-2">2. 內容</h3>
            {gameMode === 'frequency' && (
              <div className="rounded-xl px-4 py-3 text-sm animate-fade-in" style={{ background: 'var(--primary-bg)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <p className="font-semibold mb-1" style={{ color: 'var(--primary-sub)' }}>頻率 EQ 訓練</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--tx-muted)' }}>
                  系統播放經過 EQ 調整的粉紅雜訊，你需要拖曳頻譜圖上的控制點，
                  調整頻率與增益來匹配答案。匹配度 ≥ 90% 視為成功。
                </p>
              </div>
            )}
            {(gameMode !== 'interval' && gameMode !== 'chord' && gameMode !== 'frequency') && (
              <div className="space-y-2 animate-fade-in">
                <label className="label">可用音符</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {NOTE_STRINGS.map(n => (
                    <button key={n} onClick={() => toggleNote(n)} className={`chip ${selectedNotes.includes(n) ? 'chip-active' : ''} justify-center py-2`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {gameMode === 'chord' && (
              <div className="space-y-2 animate-fade-in">
                <label className="label">和弦屬性</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1 no-scrollbar">
                  {Object.values(ChordQuality).map(q => (
                    <button key={q} onClick={() => toggleChord(q)} className={`text-[10px] py-2 px-2.5 rounded-lg text-left truncate transition-all cursor-pointer ${chordQualities.includes(q) ? 'text-success' : 'text-tx-muted hover:text-tx-sub'}`} style={chordQualities.includes(q) ? { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' } : { background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {gameMode === 'interval' && (
              <div className="space-y-2 animate-fade-in">
                <label className="label">音程</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1 no-scrollbar">
                  {Object.values(IntervalQuality).map(q => (
                    <button key={q} onClick={() => toggleInterval(q)} className={`text-[10px] py-2 px-2.5 rounded-lg text-left truncate transition-all cursor-pointer ${intervalQualities.includes(q) ? 'text-purple-400' : 'text-tx-muted hover:text-tx-sub'}`} style={intervalQualities.includes(q) ? { background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)' } : { background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center pt-2">
          <button onClick={startGame} className="w-full sm:w-auto btn-primary px-12 py-4 text-base tracking-wide active:scale-95" style={{ boxShadow: '0 4px 20px rgba(139,92,246,0.2)' }}>
            開始練習
          </button>
        </div>
      </div>
    );
  }

  // ========== FREQUENCY MODE ==========
  if (gameMode === 'frequency') {
    return <FrequencyTraining onBack={() => setMode('settings')} volume={volume} />;
  }

  // ========== GAME PAGE ==========
  return (
    <div className="flex flex-col h-full max-w-xl mx-auto p-4 sm:p-6 overflow-y-auto animate-slide-up">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => { stopListening(); setMode('settings'); }} className="btn-ghost p-2 cursor-pointer">
          <Settings size={18}/>
        </button>
        <div className="flex flex-col items-end">
          <span className="label">分數</span>
          <div className="text-xl font-black leading-none">
            <span className="gradient-text">{score.correct}</span>
            <span className="text-tx-muted mx-1">/</span>
            <span className="text-tx-sub">{score.total}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        {/* Question Audio Section */}
        <div className="flex flex-col items-center gap-6 w-full">
          <div className="flex items-center gap-6 sm:gap-10">
            {(gameMode === 'vocal' || gameMode === 'note') && (
              <button onClick={playReferenceC} className="flex flex-col items-center gap-1.5 text-tx-muted hover:text-primary transition-colors cursor-pointer">
                <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}><Anchor size={16} /></div>
                <span className="label">基準 C</span>
              </button>
            )}

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handlePlay}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center active:scale-90 transition-all group relative overflow-hidden cursor-pointer btn-primary animate-glow-pulse"
                style={{ boxShadow: '0 8px 32px rgba(139,92,246,0.3)' }}
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <Volume2 size={36} className="text-white" />
              </button>
              <span className="label text-primary-sub">播放題目</span>
            </div>

            {(gameMode !== 'note' && gameMode !== 'vocal' || polyphony > 1) && (
              <div className="flex flex-col gap-2">
                <button onClick={() => playNotes(currentQuestion?.notes || [], 1, 'arpeggio')} className="btn-ghost px-3 py-1.5 text-[10px] uppercase tracking-wider">琶音</button>
                <button onClick={() => playNotes(currentQuestion?.notes || [], 1, 'simultaneous')} className="btn-ghost px-3 py-1.5 text-[10px] uppercase tracking-wider">和弦</button>
              </div>
            )}
          </div>

          {/* Vocal Mode */}
          {gameMode === 'vocal' && (
            <div className="flex flex-col items-center gap-5 w-full max-w-xs animate-fade-in">
              <div className="relative w-full">
                <button
                  onClick={toggleVocalTest}
                  className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all cursor-pointer ${isListening ? 'bg-danger text-white' : 'btn-ghost hover:border-primary'}`}
                  style={isListening ? { boxShadow: '0 4px 16px rgba(239,68,68,0.2)' } : {}}
                >
                  {isListening ? <RotateCcw size={18} className="animate-spin" style={{ animationDuration: '3s' }} /> : <Mic size={18} />}
                  {isListening ? '檢測中...' : '開始測試音準'}
                </button>
                {isListening && (
                  <div className="absolute top-1/2 -translate-y-1/2 right-4 w-3 h-3 rounded-full bg-success transition-transform duration-75" style={{ transform: `translateY(-50%) scale(${1 + micVolume * 5})`, opacity: 0.5 + micVolume * 2 }}></div>
                )}
              </div>

              <div className="w-full space-y-4 min-h-[100px] flex flex-col justify-center">
                {isListening ? (
                  <div className="space-y-4 animate-fade-in">
                    <div className="relative h-7 rounded-full flex items-center px-1" style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
                      <div className="absolute left-1/2 -translate-x-1/2 w-12 h-full" style={{ background: 'rgba(16,185,129,0.05)', borderLeft: '1px solid rgba(16,185,129,0.15)', borderRight: '1px solid rgba(16,185,129,0.15)' }}></div>
                      <div className="absolute left-1/2 -translate-x-1/2 w-0.5 h-full z-10" style={{ background: 'var(--bd)' }}></div>
                      {currentCentsOff !== null && (
                        <div
                          className="absolute w-1.5 h-full rounded-full transition-all duration-75 z-20"
                          style={{
                            left: `calc(50% + ${Math.max(-50, Math.min(50, currentCentsOff / 1.5))}%)`,
                            transform: 'translateX(-50%)',
                            background: Math.abs(currentCentsOff) < 40 ? '#10b981' : '#ef4444',
                            boxShadow: Math.abs(currentCentsOff) < 40 ? '0 0 8px rgba(16,185,129,0.4)' : 'none',
                          }}
                        ></div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center label px-1">
                        <span>匹配穩定度</span>
                        <span className="text-success">{vocalHoldProgress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
                        <div className="h-full rounded-full transition-all duration-100 ease-out" style={{ width: `${vocalHoldProgress}%`, background: 'linear-gradient(90deg, #10b981, var(--primary))' }}></div>
                      </div>
                    </div>
                    <p className="text-[11px] text-center text-tx-muted font-medium">
                      {currentCentsOff !== null ? (Math.abs(currentCentsOff) < 40 ? '音準正確！請維持住' : (currentCentsOff > 0 ? '太高了' : '太低了')) : '請對著麥克風歌唱...'}
                    </p>
                  </div>
                ) : (
                  <div className="text-center p-4 rounded-xl" style={{ background: 'var(--input-bg)', border: '1px dashed var(--bd-strong)' }}>
                    <p className="label">聽完題目後點擊「開始測試」</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status & Results */}
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="h-8 flex items-center justify-center w-full">
            {feedback ? (
              <div className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold animate-bounce-in ${feedback === 'correct' ? 'text-success' : 'text-danger'}`} style={{ background: feedback === 'correct' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: feedback === 'correct' ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(239,68,68,0.25)' }}>
                {feedback === 'correct' ? <CheckCircle size={15}/> : <XCircle size={15}/>}
                <span>{currentQuestion?.answerLabel}</span>
              </div>
            ) : (
              <div className="label px-5 py-2 rounded-full" style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
                {gameMode === 'vocal' ? '請唱出聽到的音符' : (gameMode === 'note' ? `請識別 ${polyphony > 1 ? polyphony + ' 個音符' : '該音符'}` : '請識別其屬性')}
              </div>
            )}
          </div>

          {gameMode !== 'vocal' && (
            <div className="w-full px-2 max-w-sm">
              {gameMode === 'note' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {selectedNotes.map(n => {
                      const isSelected = userSelection.includes(n);
                      const isActuallyCorrect = feedback && currentQuestion?.answerNames.includes(n);
                      const isWronglySelected = feedback === 'incorrect' && isSelected && !isActuallyCorrect;
                      let btnStyle: React.CSSProperties = { background: 'var(--input-bg)', border: '1px solid var(--bd)', color: 'var(--tx-sub)' };
                      if (isActuallyCorrect) btnStyle = { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', boxShadow: '0 0 12px rgba(16,185,129,0.15)' };
                      else if (isWronglySelected) btnStyle = { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' };
                      else if (feedback) btnStyle = { background: 'var(--input-bg)', border: '1px solid var(--bd)', color: 'var(--tx-muted)', opacity: 0.5 };
                      else if (isSelected) btnStyle = { background: 'var(--primary-bg)', border: '1px solid var(--primary)', color: 'var(--primary-sub)', boxShadow: '0 2px 10px rgba(139,92,246,0.15)' };
                      return <button key={n} disabled={!!feedback} onClick={() => handleAnswerClick(n)} className="h-12 sm:h-14 rounded-xl font-bold text-base transition-all cursor-pointer" style={btnStyle}>{n}</button>;
                    })}
                  </div>
                  {polyphony > 1 && !feedback && (
                    <button onClick={checkMultiNoteAnswer} disabled={userSelection.length !== polyphony} className="w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all cursor-pointer" style={userSelection.length === polyphony ? { background: 'linear-gradient(90deg, #10b981, var(--primary))', color: 'white', boxShadow: '0 4px 16px rgba(16,185,129,0.2)' } : { background: 'var(--input-bg)', border: '1px solid var(--bd)', color: 'var(--tx-muted)', cursor: 'not-allowed' }}>
                      檢查答案
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {(gameMode === 'chord' ? chordQualities : intervalQualities).map(q => {
                    const isCorrect = feedback && currentQuestion?.answerNames.includes(q);
                    const isSelected = userSelection.includes(q);
                    let btnStyle: React.CSSProperties = { background: 'var(--input-bg)', border: '1px solid var(--bd)', color: 'var(--tx-sub)' };
                    if (isCorrect) btnStyle = { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', boxShadow: '0 0 12px rgba(16,185,129,0.15)' };
                    else if (isSelected && feedback === 'incorrect') btnStyle = { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' };
                    else if (feedback) btnStyle = { background: 'var(--input-bg)', border: '1px solid var(--bd)', color: 'var(--tx-muted)', opacity: 0.5 };
                    return <button key={q} disabled={!!feedback} onClick={() => handleAnswerClick(q)} className="h-12 sm:h-14 rounded-xl font-bold text-[11px] tracking-wider transition-all px-2 cursor-pointer" style={btnStyle}>{q}</button>;
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {(feedback || (gameMode === 'vocal' && !isListening)) && (
        <div className="flex justify-center mt-8 animate-slide-up">
          <button onClick={nextQuestion} className="btn-ghost flex items-center gap-3 px-8 py-3 rounded-full text-xs font-bold uppercase tracking-wider">
            下一題 <ArrowRight size={15}/>
          </button>
        </div>
      )}
    </div>
  );
};

export default EarTraining;
