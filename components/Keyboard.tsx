
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PolySynth, NOTE_STRINGS } from '../utils/audioEngine';
import { Minus, Plus, Music, Zap, Infinity, Trash2, Hourglass, Play, CheckCircle2, RotateCcw, Trophy, Lightbulb, Settings2, Clock } from 'lucide-react';
import { ChordQuality } from '../types';

const WHITE_KEY_WIDTH: number = 50;
const BLACK_KEY_WIDTH: number = 32;
const KEYBOARD_HEIGHT: number = 220;
const KEYBOARD_PADDING: number = 10;

// 鋼琴顯示用：每個 offset 唯一，含顯示標籤
// 涵蓋 offset 0–28（約 2.5 個八度，17 個白鍵）
const PIANO_KEYS = [
  { note: 'C',  type: 'white', offset: 0,  chordType: 'M', wIndex: 0,  label: 'Z' },
  { note: 'C#', type: 'black', offset: 1,  posIndex: 1,                label: 'S' },
  { note: 'D',  type: 'white', offset: 2,  chordType: 'm', wIndex: 1,  label: 'X' },
  { note: 'D#', type: 'black', offset: 3,  posIndex: 2,                label: 'D' },
  { note: 'E',  type: 'white', offset: 4,  chordType: 'm', wIndex: 2,  label: 'C' },
  { note: 'F',  type: 'white', offset: 5,  chordType: 'M', wIndex: 3,  label: 'V' },
  { note: 'F#', type: 'black', offset: 6,  posIndex: 4,                label: 'G' },
  { note: 'G',  type: 'white', offset: 7,  chordType: 'M', wIndex: 4,  label: 'B' },
  { note: 'G#', type: 'black', offset: 8,  posIndex: 5,                label: 'H' },
  { note: 'A',  type: 'white', offset: 9,  chordType: 'm', wIndex: 5,  label: 'N' },
  { note: 'A#', type: 'black', offset: 10, posIndex: 6,                label: 'J' },
  { note: 'B',  type: 'white', offset: 11, chordType: 'd', wIndex: 6,  label: 'M' },
  // offset 12–16：Z排延伸（, K . L /）與 Q排起點（Q 2 W 3 E）重疊
  { note: 'C',  type: 'white', offset: 12, chordType: 'M', wIndex: 7,  label: 'Q/,' },
  { note: 'C#', type: 'black', offset: 13, posIndex: 8,                label: '2/K' },
  { note: 'D',  type: 'white', offset: 14, chordType: 'm', wIndex: 8,  label: 'W/.' },
  { note: 'D#', type: 'black', offset: 15, posIndex: 9,                label: '3/L' },
  { note: 'E',  type: 'white', offset: 16, chordType: 'm', wIndex: 9,  label: 'E//' },
  { note: 'F',  type: 'white', offset: 17, chordType: 'M', wIndex: 10, label: 'R' },
  { note: 'F#', type: 'black', offset: 18, posIndex: 11,               label: '5' },
  { note: 'G',  type: 'white', offset: 19, chordType: 'M', wIndex: 11, label: 'T' },
  { note: 'G#', type: 'black', offset: 20, posIndex: 12,               label: '6' },
  { note: 'A',  type: 'white', offset: 21, chordType: 'm', wIndex: 12, label: 'Y' },
  { note: 'A#', type: 'black', offset: 22, posIndex: 13,               label: '7' },
  { note: 'B',  type: 'white', offset: 23, chordType: 'd', wIndex: 13, label: 'U' },
  // offset 24–28：Q排延伸（I 8 O 9 P）
  { note: 'C',  type: 'white', offset: 24, chordType: 'M', wIndex: 14, label: 'I' },
  { note: 'C#', type: 'black', offset: 25, posIndex: 15,               label: '8' },
  { note: 'D',  type: 'white', offset: 26, chordType: 'm', wIndex: 15, label: 'O' },
  { note: 'D#', type: 'black', offset: 27, posIndex: 16,               label: '9' },
  { note: 'E',  type: 'white', offset: 28, chordType: 'm', wIndex: 16, label: 'P' },
] as const;

// 鍵盤輸入映射：允許多個按鍵對應同一 offset（Z排延伸與Q排起點重疊）
const KEY_BINDINGS = [
  // Z排 下音域（offset 0–16，約 1.5 個八度）
  // 白鍵：Z X C V B N M , . /    黑鍵：S D G H J K L
  { keyBind: 'z', offset: 0,  chordType: 'M' },
  { keyBind: 's', offset: 1  },
  { keyBind: 'x', offset: 2,  chordType: 'm' },
  { keyBind: 'd', offset: 3  },
  { keyBind: 'c', offset: 4,  chordType: 'm' },
  { keyBind: 'v', offset: 5,  chordType: 'M' },
  { keyBind: 'g', offset: 6  },
  { keyBind: 'b', offset: 7,  chordType: 'M' },
  { keyBind: 'h', offset: 8  },
  { keyBind: 'n', offset: 9,  chordType: 'm' },
  { keyBind: 'j', offset: 10 },
  { keyBind: 'm', offset: 11, chordType: 'd' },
  { keyBind: ',', offset: 12, chordType: 'M' }, // Z排延伸
  { keyBind: 'k', offset: 13 },
  { keyBind: '.', offset: 14, chordType: 'm' },
  { keyBind: 'l', offset: 15 },
  { keyBind: '/', offset: 16, chordType: 'm' },
  // Q排 上音域（offset 12–28，約 1.5 個八度，12–16 與 Z排延伸重疊）
  // 白鍵：Q W E R T Y U I O P    黑鍵：2 3 5 6 7 8 9
  { keyBind: 'q', offset: 12, chordType: 'M' },
  { keyBind: '2', offset: 13 },
  { keyBind: 'w', offset: 14, chordType: 'm' },
  { keyBind: '3', offset: 15 },
  { keyBind: 'e', offset: 16, chordType: 'm' },
  { keyBind: 'r', offset: 17, chordType: 'M' },
  { keyBind: '5', offset: 18 },
  { keyBind: 't', offset: 19, chordType: 'M' },
  { keyBind: '6', offset: 20 },
  { keyBind: 'y', offset: 21, chordType: 'm' },
  { keyBind: '7', offset: 22 },
  { keyBind: 'u', offset: 23, chordType: 'd' },
  { keyBind: 'i', offset: 24, chordType: 'M' }, // Q排延伸
  { keyBind: '8', offset: 25 },
  { keyBind: 'o', offset: 26, chordType: 'm' },
  { keyBind: '9', offset: 27 },
  { keyBind: 'p', offset: 28, chordType: 'm' },
];

const MAX_KEY_OFFSET: number = 28;

interface KeyboardProps { isActive: boolean; volume: number; setVolume: (v: number) => void; }

const Keyboard: React.FC<KeyboardProps> = ({ isActive, volume }) => {
  const [sideTab, setSideTab] = useState<'pitch' | 'chord_quiz'>('pitch');
  const [transpose, setTranspose] = useState(0);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [isSmartChord, setIsSmartChord] = useState(false);
  const [isSustain, setIsSustain] = useState(false);
  const [isDecayMode, setIsDecayMode] = useState(true);
  const synthRef = useRef<PolySynth | null>(null);
  const [mouseSelection, setMouseSelection] = useState<Set<number>>(new Set());
  const [showResults, setShowResults] = useState(false);
  const [trainingActive, setTrainingActive] = useState(false);
  const [numNotesToPlay, setNumNotesToPlay] = useState(1);
  const [targetMidiNotes, setTargetMidiNotes] = useState<number[]>([]);
  const [quizActive, setQuizActive] = useState(false);
  const [quizTimeLimit, setQuizTimeLimit] = useState(10);
  const [selectedQuizQualities, setSelectedQuizQualities] = useState<ChordQuality[]>([ChordQuality.MAJOR, ChordQuality.MINOR]);
  const [currentChordName, setCurrentChordName] = useState("");
  const [quizScore, setQuizScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [correctChordNotes, setCorrectChordNotes] = useState<number[]>([]);
  const timerRef = useRef<number | null>(null);
  const isAdvancingRef = useRef(false);
  const cooldownRef = useRef(false);

  useEffect(() => {
    synthRef.current = new PolySynth();
    const stored = localStorage.getItem('chord_quiz_high_score');
    if (stored) setHighScore(parseInt(stored));
    return () => { synthRef.current?.stopAll(); if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => { if (synthRef.current) { synthRef.current.setVolume(volume); synthRef.current.decayMode = isDecayMode; } }, [volume, isDecayMode]);
  useEffect(() => { if (!isActive) fullReset(true); }, [isActive]);

  const getMidiNote = (offset: number) => 60 + offset + transpose;
  const getNoteLabel = (offset: number) => { const midi = getMidiNote(offset); return NOTE_STRINGS[((midi % 12) + 12) % 12]; };

  const fullReset = (hardReset: boolean = false) => {
    synthRef.current?.stopAll();
    if (hardReset) setActiveKeys(new Set());
    setMouseSelection(new Set()); setShowResults(false); setTrainingActive(false); setQuizActive(false); setTargetMidiNotes([]); setCorrectChordNotes([]);
    isAdvancingRef.current = false; cooldownRef.current = false;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const keyboardMidis = useMemo(() => {
    const set = new Set<number>();
    activeKeys.forEach(k => { const conf = KEY_BINDINGS.find(c => c.keyBind === k); if (conf) set.add(getMidiNote(conf.offset)); });
    return set;
  }, [activeKeys, transpose]);

  const currentAttempt = useMemo(() => {
    const combined = new Set(mouseSelection);
    keyboardMidis.forEach(m => combined.add(m));
    return combined;
  }, [mouseSelection, keyboardMidis]);

  const playInternal = (offset: number, chordType?: string, isKeyboard: boolean = false) => {
    const midi = getMidiNote(offset);
    if (isSmartChord && chordType) {
      let intervals = [0, 4, 7];
      if (chordType === 'm') intervals = [0, 3, 7];
      else if (chordType === 'd') intervals = [0, 3, 6];
      intervals.forEach(i => synthRef.current?.play(midi + i));
    } else synthRef.current?.play(midi);
    if ((trainingActive || quizActive) && !showResults) {
      if (!isKeyboard) {
        setMouseSelection(prev => {
          const next = new Set(prev);
          if (next.has(midi)) next.delete(midi);
          else if (next.size < (quizActive ? 5 : numNotesToPlay)) next.add(midi);
          return next;
        });
      }
    }
  };

  const stopInternal = (offset: number, chordType?: string) => {
    if (isSmartChord && chordType) { const root = getMidiNote(offset); [0, 3, 4, 6, 7].forEach(i => synthRef.current?.stop(root + i, false)); }
    else synthRef.current?.stop(getMidiNote(offset), false);
  };

  const handleNoteStart = (keyBind: string, offset: number, chordType?: string, isKeyboard: boolean = false) => {
    if (isSustain && isKeyboard) {
      if (activeKeys.has(keyBind)) handleNoteStopDirect(keyBind, offset, chordType, true);
      else { setActiveKeys(prev => new Set(prev).add(keyBind)); playInternal(offset, chordType, isKeyboard); }
    } else {
      if (isKeyboard && activeKeys.has(keyBind)) return;
      if (isKeyboard) setActiveKeys(prev => new Set(prev).add(keyBind));
      playInternal(offset, chordType, isKeyboard);
    }
  };

  const handleNoteStop = (keyBind: string, offset: number, chordType?: string, isKeyboard: boolean = false) => {
    if (isKeyboard && isSustain) return;
    if (isKeyboard && isDecayMode) { setActiveKeys(prev => { const next = new Set(prev); next.delete(keyBind); return next; }); return; }
    handleNoteStopDirect(keyBind, offset, chordType, isKeyboard);
  };

  const handleNoteStopDirect = (keyBind: string, offset: number, chordType?: string, isKeyboard: boolean = false) => {
    if (isKeyboard) setActiveKeys(prev => { const next = new Set(prev); next.delete(keyBind); return next; });
    stopInternal(offset, chordType);
  };

  const handleClearAll = () => { synthRef.current?.stopAll(); if (trainingActive || quizActive) { setMouseSelection(new Set()); if (trainingActive) setShowResults(false); } };

  const generateTraining = () => {
    fullReset(false); setSideTab('pitch');
    const notes: number[] = [];
    const currentTranspose = Number(transpose);
    const minMidi = 60 + currentTranspose;
    const range = MAX_KEY_OFFSET + 1;
    const count = Number(numNotesToPlay);
    for (let i = 0; i < count; i += 1) {
      let r = 0; let attempts = 0;
      do { r = Math.floor(Math.random() * range) + minMidi; attempts += 1; if (attempts > 100) break; } while (notes.includes(r));
      notes.push(r);
    }
    setTargetMidiNotes(notes); setTrainingActive(true);
    notes.forEach((m, i) => { setTimeout(() => { synthRef.current?.play(m); setTimeout(() => synthRef.current?.stop(m), 1000); }, i * 500); });
  };

  const confirmTraining = () => { if (currentAttempt.size === 0) return; setShowResults(true); };

  const startChordQuiz = () => { if (selectedQuizQualities.length === 0) return; fullReset(false); setSideTab('chord_quiz'); setQuizActive(true); setQuizScore(0); generateQuizQuestion(); };

  const generateQuizQuestion = () => {
    isAdvancingRef.current = true; cooldownRef.current = true;
    let quality: ChordQuality = ChordQuality.MAJOR; let rootOffset = 0; let intervals: number[] = [0, 4, 7];
    const qualities = selectedQuizQualities; const qualitiesLen = qualities.length; const maxKeyOffset = MAX_KEY_OFFSET; const currentTranspose = Number(transpose);
    let attempts = 0;
    do {
      if (qualitiesLen > 0) quality = qualities[Math.floor(Math.random() * qualitiesLen)];
      rootOffset = Math.floor(Math.random() * (maxKeyOffset + 1));
      switch (quality) {
        case ChordQuality.MAJOR: intervals = [0, 4, 7]; break; case ChordQuality.MINOR: intervals = [0, 3, 7]; break;
        case ChordQuality.DIMINISHED: intervals = [0, 3, 6]; break; case ChordQuality.AUGMENTED: intervals = [0, 4, 8]; break;
        case ChordQuality.MAJOR_7: intervals = [0, 4, 7, 11]; break; case ChordQuality.MINOR_7: intervals = [0, 3, 7, 10]; break;
        case ChordQuality.DOMINANT_7: intervals = [0, 4, 7, 10]; break; case ChordQuality.HALF_DIM: intervals = [0, 3, 6, 10]; break;
        case ChordQuality.DIMINISHED_7: intervals = [0, 3, 6, 9]; break; default: intervals = [0, 4, 7];
      }
      attempts++;
      if (attempts > 200) { rootOffset = 0; quality = ChordQuality.MAJOR; intervals = [0, 4, 7]; break; }
    } while (rootOffset + Math.max(...intervals) > maxKeyOffset);
    setCurrentChordName(`${NOTE_STRINGS[rootOffset % 12]} ${quality}`);
    setCorrectChordNotes(intervals.map(i => 60 + rootOffset + currentTranspose + i));
    setTimeLeft(quizTimeLimit); setMouseSelection(new Set()); setShowResults(false); synthRef.current?.stopAll();
    setTimeout(() => { isAdvancingRef.current = false; cooldownRef.current = false; }, 500);
  };

  useEffect(() => {
    if (quizActive && !showResults && !isAdvancingRef.current && !cooldownRef.current && correctChordNotes.length > 0) {
      const attempt = Array.from(currentAttempt).sort((a: number, b: number) => a - b);
      const target = [...correctChordNotes].sort((a: number, b: number) => a - b);
      if (attempt.length === target.length && attempt.every((v, i) => v === target[i])) {
        setQuizScore(s => { const next = s + 1; if (next > highScore) { setHighScore(next); localStorage.setItem('chord_quiz_high_score', next.toString()); } return next; });
        generateQuizQuestion();
      }
    }
  }, [currentAttempt, quizActive, showResults, correctChordNotes]);

  useEffect(() => {
    if (quizActive && timeLeft > 0) timerRef.current = window.setInterval(() => setTimeLeft(t => t - 1), 1000);
    else if (timeLeft === 0 && quizActive) { setQuizActive(false); setShowResults(true); synthRef.current?.stopAll(); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [quizActive, timeLeft]);

  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      const target = KEY_BINDINGS.find(k => k.keyBind === key);
      if (target) handleNoteStart(key, target.offset, target.chordType, true);
      if (e.key === ' ') { handleClearAll(); e.preventDefault(); }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const target = KEY_BINDINGS.find(k => k.keyBind === key);
      if (target) handleNoteStop(key, target.offset, target.chordType, true);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [isActive, transpose, isSmartChord, isSustain, isDecayMode, quizActive, trainingActive, mouseSelection, activeKeys]);

  const activeMidiMap = useMemo(() => {
    const map = new Set(keyboardMidis);
    if (isSmartChord) {
      activeKeys.forEach(k => {
        const conf = KEY_BINDINGS.find(c => k === c.keyBind);
        if (conf && conf.chordType) {
          const root = getMidiNote(conf.offset);
          let ints = [0, 4, 7]; if (conf.chordType === 'm') ints = [0, 3, 7]; else if (conf.chordType === 'd') ints = [0, 3, 6];
          ints.forEach(i => map.add(root + i));
        }
      });
    }
    return map;
  }, [keyboardMidis, activeKeys, isSmartChord, transpose]);

  const whiteKeys = PIANO_KEYS.filter(k => k.type === 'white');
  const blackKeys = PIANO_KEYS.filter(k => k.type === 'black');
  const totalWidth = whiteKeys.length * WHITE_KEY_WIDTH + (KEYBOARD_PADDING * 2);

  const ctrlBtnStyle = (active: boolean, color: string): React.CSSProperties => {
    if (!active) return { background: 'var(--input-bg)', border: '1px solid var(--bd)', color: 'var(--tx-muted)' };
    const colors: Record<string, { bg: string; bd: string; tx: string }> = {
      cyan: { bg: 'rgba(6,182,212,0.1)', bd: 'rgba(6,182,212,0.3)', tx: '#22d3ee' },
      orange: { bg: 'rgba(245,158,11,0.1)', bd: 'rgba(245,158,11,0.3)', tx: '#fb923c' },
      purple: { bg: 'rgba(139,92,246,0.1)', bd: 'rgba(139,92,246,0.3)', tx: '#a78bfa' },
    };
    const c = colors[color] || colors.purple;
    return { background: c.bg, border: `1px solid ${c.bd}`, color: c.tx };
  };

  return (
    <div className="flex flex-col lg:flex-row items-center justify-center min-h-full p-2 sm:p-4 gap-4 sm:gap-6 w-full max-w-7xl mx-auto overflow-y-auto animate-slide-up">
      <div className="flex flex-col items-center space-y-4 sm:space-y-6 flex-1 w-full">
        {/* Title */}
        <div className="text-center hidden sm:block">
          <h2 className="text-2xl sm:text-3xl font-extrabold gradient-text flex items-center justify-center gap-2 mb-1">
            <Music size={24} /> 鍵盤控制器
          </h2>
          <p className="text-tx-muted text-xs sm:text-sm">Z排下音域（黑鍵 S D G H J K L）| Q排上音域（黑鍵 2 3 5 6 7 8 9）| 空白鍵重置</p>
        </div>

        {/* Control Strip */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full card p-3 sm:p-5">
          <div className="flex flex-col items-center p-2 rounded-xl w-28 sm:w-40 card-inner">
            <span className="label mb-1 sm:mb-2">移調</span>
            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={() => setTranspose(t => t - 1)} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors hover:bg-bg-hover" style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}><Minus size={12}/></button>
              <div className="w-8 sm:w-10 text-center text-lg sm:text-xl font-bold text-primary-sub">{transpose > 0 ? '+' : ''}{transpose}</div>
              <button onClick={() => setTranspose(t => t + 1)} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors hover:bg-bg-hover" style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}><Plus size={12}/></button>
            </div>
          </div>

          {[
            { id: 'decay', icon: Hourglass, label: '衰減', active: isDecayMode, action: () => setIsDecayMode(!isDecayMode), color: 'cyan' },
            { id: 'sustain', icon: Infinity, label: '延音', active: isSustain, action: () => setIsSustain(!isSustain), color: 'orange' },
            { id: 'chords', icon: Zap, label: '和弦', active: isSmartChord, action: () => setIsSmartChord(!isSmartChord), color: 'purple' }
          ].map(btn => (
            <button
              key={btn.id} onClick={btn.action}
              className="flex flex-col items-center justify-center p-2 rounded-xl transition-all w-14 h-14 sm:w-20 sm:h-20 cursor-pointer"
              style={ctrlBtnStyle(btn.active, btn.color)}
            >
              <btn.icon size={16} className="mb-0.5 sm:w-5 sm:h-5" />
              <span className="text-[8px] sm:text-[10px] font-bold">{btn.label}</span>
            </button>
          ))}

          <button onClick={() => fullReset(true)} className="flex flex-col items-center justify-center p-2 rounded-xl transition-all w-14 h-14 sm:w-20 sm:h-20 cursor-pointer hover:text-danger" style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)', color: 'var(--tx-muted)' }}>
            <Trash2 size={16} className="mb-0.5 sm:w-5 sm:h-5" />
            <span className="text-[8px] sm:text-[10px] font-bold">重置</span>
          </button>
        </div>

        {/* Piano Keyboard */}
        <div className="w-full overflow-x-auto pb-4 sm:pb-8 flex justify-start sm:justify-center no-scrollbar touch-pan-x">
          <div className="relative rounded-b-2xl flex-shrink-0" style={{ width: totalWidth, height: KEYBOARD_HEIGHT + 20, padding: `0 ${KEYBOARD_PADDING}px`, background: 'var(--bg-sub)', borderBottom: '1px solid var(--bd)', borderLeft: '1px solid var(--bd)', borderRight: '1px solid var(--bd)', boxShadow: '0 8px 32px var(--shadow-color)' }}>
            <div className="absolute top-0 flex" style={{ left: KEYBOARD_PADDING }}>
              {whiteKeys.map(k => {
                const midi = getMidiNote(k.offset);
                const isSounding = activeMidiMap.has(midi);
                const isInAttempt = currentAttempt.has(midi);
                const isMouseToggled = mouseSelection.has(midi);
                const isHardwareHold = keyboardMidis.has(midi);
                let displayStyle: React.CSSProperties = { background: 'var(--kbd-white)', borderBottom: '6px solid var(--kbd-white-border)' };
                let textColor = 'var(--tx-muted)';
                if (showResults) {
                  const isCorrect = targetMidiNotes.includes(midi) || correctChordNotes.includes(midi);
                  if (isInAttempt && isCorrect) { displayStyle = { background: 'linear-gradient(180deg, #34d399, #10b981)', borderBottom: '8px solid #059669' }; textColor = 'white'; }
                  else if (isInAttempt && !isCorrect) { displayStyle = { background: 'linear-gradient(180deg, #f87171, #ef4444)', borderBottom: '8px solid #dc2626' }; textColor = 'white'; }
                  else if (!isInAttempt && isCorrect) { displayStyle = { ...displayStyle, outline: '2px solid #10b981', outlineOffset: '-2px' }; }
                } else if (isHardwareHold) { displayStyle = { background: 'linear-gradient(180deg, #a78bfa, #8b5cf6)', borderBottom: '8px solid #7c3aed', boxShadow: '0 0 12px rgba(139,92,246,0.3)' }; textColor = 'white'; }
                else if (isMouseToggled) { displayStyle = { background: 'linear-gradient(180deg, #c4b5fd, #a78bfa)', borderBottom: '6px solid #8b5cf6', outline: '2px solid rgba(139,92,246,0.4)', outlineOffset: '-2px' }; textColor = 'white'; }
                else if (isSounding) { displayStyle = { background: 'linear-gradient(180deg, #ddd6fe, #c4b5fd)', borderBottom: '6px solid #a78bfa' }; }
                return (
                  <div
                    key={k.offset}
                    onPointerDown={(e) => { e.preventDefault(); handleNoteStart(k.offset.toString(), k.offset, k.chordType, false); }}
                    onPointerUp={(e) => { e.preventDefault(); handleNoteStop(k.offset.toString(), k.offset, k.chordType, false); }}
                    onPointerLeave={(e) => { e.preventDefault(); handleNoteStop(k.offset.toString(), k.offset, k.chordType, false); }}
                    className="relative rounded-b-lg sm:rounded-b-xl shrink-0 flex flex-col justify-end items-center pb-3 sm:pb-5 transition-all duration-75 select-none cursor-pointer"
                    style={{ width: WHITE_KEY_WIDTH, height: KEYBOARD_HEIGHT, borderLeft: '1px solid var(--bd)', borderRight: '1px solid var(--bd)', ...displayStyle }}
                  >
                    <span className="font-bold text-[9px] sm:text-xs pointer-events-none" style={{ color: textColor }}>{getNoteLabel(k.offset)}</span>
                    <span className="text-[7px] sm:text-[9px] font-semibold pointer-events-none mt-0.5 opacity-30 hidden xs:block" style={{ color: textColor }}>{k.label}</span>
                  </div>
                );
              })}
            </div>

            {blackKeys.map(k => {
              const midi = getMidiNote(k.offset);
              const isSounding = activeMidiMap.has(midi);
              const isInAttempt = currentAttempt.has(midi);
              const isMouseToggled = mouseSelection.has(midi);
              const isHardwareHold = keyboardMidis.has(midi);
              const leftOffset = ((k.posIndex ?? 0) * WHITE_KEY_WIDTH) - (BLACK_KEY_WIDTH / 2) + KEYBOARD_PADDING;
              let displayStyle: React.CSSProperties = { background: 'var(--kbd-black)', borderBottom: '6px solid var(--kbd-black-border)' };
              if (showResults) {
                const isCorrect = targetMidiNotes.includes(midi) || correctChordNotes.includes(midi);
                if (isInAttempt && isCorrect) displayStyle = { background: 'linear-gradient(180deg, #10b981, #059669)', borderBottom: '6px solid #047857' };
                else if (isInAttempt && !isCorrect) displayStyle = { background: 'linear-gradient(180deg, #ef4444, #dc2626)', borderBottom: '6px solid #b91c1c' };
                else if (!isInAttempt && isCorrect) displayStyle = { ...displayStyle, outline: '1px solid #10b981' };
              } else if (isHardwareHold) displayStyle = { background: 'linear-gradient(180deg, #8b5cf6, #6d28d9)', borderBottom: '6px solid #5b21b6', boxShadow: '0 0 12px rgba(139,92,246,0.4)' };
              else if (isMouseToggled) displayStyle = { background: 'linear-gradient(180deg, #7c3aed, #6d28d9)', borderBottom: '6px solid #5b21b6', outline: '1px solid #a78bfa' };
              else if (isSounding) displayStyle = { background: 'linear-gradient(180deg, #6d28d9, #4c1d95)', borderBottom: '6px solid #3b0764' };
              return (
                <div
                  key={k.offset}
                  onPointerDown={(e) => { e.preventDefault(); handleNoteStart(k.offset.toString(), k.offset, undefined, false); }}
                  onPointerUp={(e) => { e.preventDefault(); handleNoteStop(k.offset.toString(), k.offset, undefined, false); }}
                  onPointerLeave={(e) => { e.preventDefault(); handleNoteStop(k.offset.toString(), k.offset, undefined, false); }}
                  className="absolute top-0 rounded-b-md sm:rounded-b-lg flex flex-col justify-end items-center pb-2 sm:pb-3 transition-all duration-75 z-20 cursor-pointer shadow-lg select-none"
                  style={{ left: leftOffset, width: BLACK_KEY_WIDTH, height: KEYBOARD_HEIGHT * 0.6, ...displayStyle }}
                >
                  <span className="text-[8px] sm:text-[10px] font-bold text-white/80 pointer-events-none">{getNoteLabel(k.offset)}</span>
                  <span className="text-[6px] sm:text-[7px] font-semibold pointer-events-none mt-0.5 hidden xs:block" style={{ color: 'rgba(255,255,255,0.3)' }}>{k.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Side Panel */}
      <div className="w-full lg:w-80 card p-4 sm:p-5 self-stretch flex flex-col space-y-4 sm:space-y-5">
        <div className="flex card-inner p-1 shrink-0">
          <button onClick={() => { fullReset(false); setSideTab('pitch'); }} className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${sideTab === 'pitch' ? 'text-primary-sub' : 'text-tx-muted hover:text-tx-sub'}`} style={sideTab === 'pitch' ? { background: 'var(--primary-bg)', border: '1px solid var(--primary)' } : {}}>聽音訓練</button>
          <button onClick={() => { fullReset(false); setSideTab('chord_quiz'); }} className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${sideTab === 'chord_quiz' ? 'text-primary-sub' : 'text-tx-muted hover:text-tx-sub'}`} style={sideTab === 'chord_quiz' ? { background: 'var(--primary-bg)', border: '1px solid var(--primary)' } : {}}>和弦速記</button>
        </div>

        {sideTab === 'pitch' ? (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: 'var(--bd)' }}>
              <div className="p-1.5 rounded-lg" style={{ background: 'var(--primary-bg)', color: 'var(--primary-sub)' }}><Music size={16} /></div>
              <div>
                <h3 className="font-bold text-tx leading-tight text-xs sm:text-sm">聽音訓練</h3>
                <p className="label">Pitch Training</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="label">音數選擇</label>
                <select value={numNotesToPlay} onChange={(e) => setNumNotesToPlay(parseInt(e.target.value))} className="w-full input-field p-2.5 text-xs cursor-pointer">
                  <option value={1}>1 個音</option><option value={2}>2 個音</option><option value={3}>3 個音</option>
                </select>
              </div>
              <button onClick={generateTraining} className="w-full py-3 btn-primary flex items-center justify-center gap-2 active:scale-95">
                <Play size={15} fill="currentColor" />{trainingActive ? '重新出題' : '開始挑戰'}
              </button>
              {trainingActive && (
                <div className="p-3 card-inner space-y-3 animate-fade-in">
                  <div className="flex justify-between items-center label">
                    <span>已選：{currentAttempt.size}/{numNotesToPlay}</span>
                    {showResults && (
                      <span style={{ color: Array.from(currentAttempt).every(n => targetMidiNotes.includes(n)) && currentAttempt.size === targetMidiNotes.length ? '#10b981' : '#ef4444' }}>
                        {Array.from(currentAttempt).every(n => targetMidiNotes.includes(n)) && currentAttempt.size === targetMidiNotes.length ? '全對！' : '不正確'}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    <button onClick={() => targetMidiNotes.forEach((m,i)=>setTimeout(()=>synthRef.current?.play(m),i*500))} className="btn-ghost w-full py-2 text-[11px] flex items-center justify-center gap-2"><RotateCcw size={11} /> 再次播放</button>
                    <button onClick={() => setMouseSelection(new Set())} className="btn-ghost w-full py-2 text-[11px] flex items-center justify-center gap-2"><Trash2 size={11} /> 清除</button>
                    <button disabled={currentAttempt.size < numNotesToPlay || showResults} onClick={confirmTraining} className="w-full py-2.5 rounded-xl font-bold text-[11px] flex items-center justify-center gap-2 cursor-pointer transition-all" style={currentAttempt.size < numNotesToPlay || showResults ? { background: 'var(--input-bg)', border: '1px solid var(--bd)', color: 'var(--tx-muted)' } : { background: 'linear-gradient(90deg, #10b981, var(--primary))', color: 'white', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}><CheckCircle2 size={13} /> 確定選擇</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in h-full flex flex-col">
            <div className="flex items-center gap-3 border-b pb-3 shrink-0" style={{ borderColor: 'var(--bd)' }}>
              <div className="p-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}><Zap size={16} /></div>
              <div>
                <h3 className="font-bold text-tx leading-tight text-xs sm:text-sm">和弦記憶力挑戰</h3>
                <p className="label">Chord Quiz</p>
              </div>
            </div>

            {!quizActive && !showResults ? (
              <div className="flex-1 flex flex-col space-y-4 py-1">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 label"><Settings2 size={10}/> 設定</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[ChordQuality.MAJOR, ChordQuality.MINOR, ChordQuality.DIMINISHED, ChordQuality.AUGMENTED, ChordQuality.MAJOR_7, ChordQuality.MINOR_7, ChordQuality.DOMINANT_7, ChordQuality.HALF_DIM, ChordQuality.DIMINISHED_7].map(q => {
                      const isSelected = selectedQuizQualities.includes(q);
                      return (
                        <button key={q} onClick={() => setSelectedQuizQualities(prev => prev.includes(q) ? (prev.length > 1 ? prev.filter(i => i !== q) : prev) : [...prev, q])} className="text-[10px] font-bold py-1.5 px-1.5 rounded-lg truncate text-left cursor-pointer transition-all" style={isSelected ? { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' } : { background: 'var(--input-bg)', border: '1px solid var(--bd)', color: 'var(--tx-muted)' }}>{q}</button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between label">
                    <span className="flex items-center gap-1.5"><Clock size={10} /> 每題時間</span>
                    <span style={{ color: '#f59e0b', fontWeight: 900 }}>{quizTimeLimit}s</span>
                  </div>
                  <input type="range" min="5" max="30" step="5" value={quizTimeLimit} onChange={(e) => setQuizTimeLimit(parseInt(e.target.value))} className="w-full h-1 cursor-pointer" />
                </div>
                <div className="card-inner p-3 flex justify-between items-center shrink-0">
                  <div>
                    <span className="label">最高得分</span>
                    <div className="text-xl sm:text-2xl font-black" style={{ color: '#f59e0b' }}>{highScore}</div>
                  </div>
                  <Trophy className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: 'rgba(245,158,11,0.15)' }} />
                </div>
                <button onClick={startChordQuiz} className="w-full py-3 rounded-xl font-bold transition-all active:scale-95 cursor-pointer text-white" style={{ background: 'linear-gradient(90deg, #f59e0b, #f97316)', boxShadow: '0 4px 16px rgba(245,158,11,0.2)' }}>開始挑戰</button>
              </div>
            ) : quizActive ? (
              <div className="flex-1 space-y-4">
                <div className="flex justify-between items-center card-inner p-3">
                  <div className="flex flex-col items-center flex-1 border-r" style={{ borderColor: 'var(--bd)' }}>
                    <span className="label">得分</span>
                    <span className="text-xl font-black text-tx">{quizScore}</span>
                  </div>
                  <div className="flex flex-col items-center flex-1">
                    <span className="label">時間</span>
                    <span className={`text-xl font-black ${timeLeft < 4 ? 'text-danger animate-pulse' : 'text-primary-sub'}`}>{timeLeft}s</span>
                  </div>
                </div>
                <div className="card-inner p-4 sm:p-6 flex flex-col items-center justify-center text-center" style={{ borderColor: 'rgba(139,92,246,0.15)' }}>
                  <span className="label text-primary-sub mb-1">請同時按下</span>
                  <div className="text-xl sm:text-2xl font-black text-tx">{currentChordName}</div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between label">
                    <span>輸入狀態</span>
                    <span>{currentAttempt.size}/{correctChordNotes.length} 個音符</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)', border: '1px solid var(--bd)' }}>
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(currentAttempt.size / correctChordNotes.length) * 100}%`, background: 'linear-gradient(90deg, var(--primary), var(--accent))' }}></div>
                  </div>
                </div>
                <div className="card-inner p-3 flex items-start gap-2">
                  <Lightbulb size={12} className="text-primary-sub shrink-0 mt-0.5" />
                  <p className="text-[10px] text-tx-muted leading-relaxed">如果音色中斷，請放開後重新按下按鍵。</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 animate-scale-in">
                <div className="p-5 card-inner w-full" style={{ borderColor: 'rgba(239,68,68,0.15)' }}>
                  <span className="label text-danger">挑戰結束</span>
                  <div className="text-4xl sm:text-5xl font-black text-tx my-2">{quizScore}</div>
                  <p className="text-[11px] text-tx-muted">總計完成 {quizScore} 個和弦</p>
                </div>
                <button onClick={startChordQuiz} className="w-full py-3 btn-primary active:scale-95">再試一次</button>
                <button onClick={() => { fullReset(true); setSideTab('chord_quiz'); }} className="w-full py-2 text-tx-muted text-[11px] font-bold uppercase tracking-widest cursor-pointer hover:text-tx transition-colors">返回設定</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Keyboard;
