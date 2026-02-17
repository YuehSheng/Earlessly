
import React, { useState, useEffect, useRef } from 'react';
import { Play, Plus, Minus, TrendingUp, Pause, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react';
import { MetronomeEngine } from '../utils/audioEngine';
import { BeatIntensity, SpeedTrainerSettings } from '../types';

// --- Analog Knob Component ---
const AnalogKnob: React.FC<{
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; label: string; size?: number;
}> = ({ value, min, max, step, onChange, label, size = 64 }) => {
  const knobRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const pct = (value - min) / (max - min);
  const startAngle = -135;
  const endAngle = 135;
  const angle = startAngle + pct * (endAngle - startAngle);
  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;

  const arcPath = (from: number, to: number) => {
    const rad1 = (from - 90) * Math.PI / 180;
    const rad2 = (to - 90) * Math.PI / 180;
    const x1 = cx + r * Math.cos(rad1), y1 = cy + r * Math.sin(rad1);
    const x2 = cx + r * Math.cos(rad2), y2 = cy + r * Math.sin(rad2);
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dy = startY.current - e.clientY;
    const range = max - min;
    const sensitivity = range / 120;
    let next = startVal.current + dy * sensitivity;
    next = Math.round(next / step) * step;
    next = Math.max(min, Math.min(max, next));
    onChange(next);
  };

  const handlePointerUp = () => { dragging.current = false; };

  const needleRad = (angle - 90) * Math.PI / 180;
  const needleLen = r - 8;
  const nx = cx + needleLen * Math.cos(needleRad);
  const ny = cy + needleLen * Math.sin(needleRad);

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="label">{label}</span>
      <svg
        ref={knobRef} width={size} height={size}
        className="cursor-grab active:cursor-grabbing select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: 'none' }}
      >
        <path d={arcPath(startAngle, endAngle)} fill="none" stroke="var(--bg-hover)" strokeWidth="3" strokeLinecap="round" />
        {pct > 0.01 && (
          <path d={arcPath(startAngle, angle)} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
        )}
        <circle cx={cx} cy={cy} r={r - 5} fill="var(--bg-card)" stroke="var(--bd)" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r={r - 7} fill="none" stroke="var(--bd)" strokeWidth="0.5" opacity="0.3" />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" style={{ transition: dragging.current ? 'none' : 'all 0.1s ease-out' }} />
        <circle cx={cx} cy={cy} r="3" fill="var(--primary)" opacity="0.6" />
      </svg>
      <span className="text-[10px] font-mono text-tx-muted">{Math.round(value * 100)}%</span>
    </div>
  );
};

// --- Vertical Picker Component (swipe up/down to change value) ---
const VerticalPicker: React.FC<{
  value: number; min: number; max: number;
  onChange: (v: number) => void; label: string;
  display?: (v: number) => string;
  color?: string;
}> = ({ value, min, max, onChange, label, display, color }) => {
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dy = startY.current - e.clientY;
    const step = Math.max(1, Math.round(Math.abs(dy) / 24));
    if (Math.abs(dy) >= 24) {
      const dir = dy > 0 ? 1 : -1;
      const next = Math.max(min, Math.min(max, startVal.current + dir * step));
      if (next !== value) onChange(next);
    }
  };
  const handlePointerUp = () => { dragging.current = false; };

  const inc = () => onChange(Math.min(max, value + 1));
  const dec = () => onChange(Math.max(min, value - 1));
  const displayText = display ? display(value) : String(value);
  const textColor = color || 'var(--tx)';

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center select-none"
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <span className="label mb-1" style={color ? { color } : {}}>{label}</span>
      <div className="card-inner rounded-xl flex flex-col items-center py-1 px-3 gap-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); inc(); }}
          className="w-7 h-5 flex items-center justify-center rounded cursor-pointer transition-colors hover:bg-bg-hover"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ChevronUp size={14} className="text-tx-muted" />
        </button>
        <span
          className="text-2xl font-black leading-none py-1 cursor-grab active:cursor-grabbing select-none transition-transform duration-100"
          style={{ color: textColor, minWidth: '2ch', textAlign: 'center' }}
        >
          {displayText}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); dec(); }}
          className="w-7 h-5 flex items-center justify-center rounded cursor-pointer transition-colors hover:bg-bg-hover"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ChevronDown size={14} className="text-tx-muted" />
        </button>
      </div>
    </div>
  );
};

const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
const lcm = (a: number, b: number): number => {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
};

const SUB_MAP: Record<number, string> = { 1: '♩', 2: '♪', 4: '𝅘𝅥𝅯' };

interface MetronomeProps {
  volume: number;
  setVolume: (v: number) => void;
}

const Metronome: React.FC<MetronomeProps> = ({ volume, setVolume }) => {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<'STANDARD' | 'POLYRHYTHM'>('STANDARD');
  const [numerator, setNumerator] = useState(4);
  const [subdivision, setSubdivision] = useState(1);
  const [polyA, setPolyA] = useState(3);
  const [polyB, setPolyB] = useState(4);
  const [trainerSettings, setTrainerSettings] = useState<SpeedTrainerSettings>({
    enabled: false, barCount: 4, increment: 5, currentBarTracker: 0
  });
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [grid, setGrid] = useState<BeatIntensity[]>([]);
  const engineRef = useRef<MetronomeEngine | null>(null);
  const tapTimesRef = useRef<number[]>([]);
  const prevStepRef = useRef(-1);

  useEffect(() => {
    engineRef.current = new MetronomeEngine((step) => setCurrentStepIndex(step));
    engineRef.current.setVolume(volume);
    return () => engineRef.current?.stop();
  }, []);

  useEffect(() => { if (engineRef.current) engineRef.current.setVolume(volume); }, [volume]);

  useEffect(() => {
    const wasZero = prevStepRef.current === 0;
    prevStepRef.current = currentStepIndex;
    if (wasZero || currentStepIndex !== 0) return;
    if (!isPlaying || !trainerSettings.enabled) return;

    setTrainerSettings(prev => {
      const nextCount = prev.currentBarTracker + 1;
      if (nextCount > prev.barCount) {
        setBpm(current => Math.min(300, current + prev.increment));
        return { ...prev, currentBarTracker: 1 };
      }
      return { ...prev, currentBarTracker: nextCount };
    });
  }, [currentStepIndex, isPlaying, trainerSettings.enabled]);

  useEffect(() => {
    if (mode === 'STANDARD') {
      const totalSteps = numerator * subdivision;
      const newGrid = new Array(totalSteps).fill(BeatIntensity.MUTE);
      for (let i = 0; i < totalSteps; i++) {
        if (i === 0) newGrid[i] = BeatIntensity.STRONG;
        else if (i % subdivision === 0) newGrid[i] = BeatIntensity.WEAK;
      }
      setGrid(newGrid);
    } else {
      const stepsA = Math.max(1, polyA);
      const stepsB = Math.max(1, polyB);
      const totalSteps = lcm(stepsA, stepsB);
      if (totalSteps === 0) return;
      const newGrid = new Array(totalSteps).fill(BeatIntensity.MUTE);
      const stepIntervalA = totalSteps / stepsA;
      const stepIntervalB = totalSteps / stepsB;
      for (let i = 0; i < totalSteps; i++) {
        const hitA = i % stepIntervalA === 0;
        const hitB = i % stepIntervalB === 0;
        if (hitA && hitB) newGrid[i] = BeatIntensity.POLY_BOTH;
        else if (hitA) newGrid[i] = BeatIntensity.POLY_A;
        else if (hitB) newGrid[i] = BeatIntensity.POLY_B;
      }
      setGrid(newGrid);
    }
  }, [mode, numerator, subdivision, polyA, polyB]);

  useEffect(() => {
    if (!engineRef.current) return;
    let stepTime = 0.5;
    const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;
    if (mode === 'STANDARD') stepTime = (60.0 / safeBpm) / subdivision;
    else {
      const totalSteps = lcm(polyA, polyB);
      if (totalSteps > 0) stepTime = (60.0 / safeBpm * polyB) / totalSteps;
    }
    engineRef.current.setStepInterval(stepTime);
    engineRef.current.setParams(safeBpm, grid);
    if (isPlaying) engineRef.current.start();
    else engineRef.current.stop();
  }, [bpm, grid, isPlaying, subdivision, mode, polyA, polyB]);

  const togglePlay = () => {
    if (!isPlaying) {
      setTrainerSettings(prev => ({...prev, currentBarTracker: 0}));
      setCurrentStepIndex(-1);
    } else {
      setCurrentStepIndex(-1);
      prevStepRef.current = -1;
    }
    setIsPlaying(!isPlaying);
  };

  const cycleIntensity = (index: number) => {
    if (mode === 'POLYRHYTHM') return;
    const currentIntensity = grid[index] as number;
    const next = ((currentIntensity ?? 0) + 1) % 3;
    const newGrid = [...grid];
    newGrid[index] = next;
    setGrid(newGrid);
  };

  const resetPattern = () => {
    if (mode === 'STANDARD') {
      const totalSteps = numerator * subdivision;
      const newGrid = new Array(totalSteps).fill(BeatIntensity.MUTE);
      for (let i = 0; i < totalSteps; i++) {
        if (i === 0) newGrid[i] = BeatIntensity.STRONG;
        else if (i % subdivision === 0) newGrid[i] = BeatIntensity.WEAK;
      }
      setGrid(newGrid);
    }
  };

  const handleTap = () => {
    const now = Date.now();
    const times = tapTimesRef.current;
    if (times.length > 0 && now - times[times.length - 1] > 2000) {
      tapTimesRef.current = [now]; return;
    }
    tapTimesRef.current.push(now);
    if (tapTimesRef.current.length > 5) tapTimesRef.current.shift();
    if (tapTimesRef.current.length > 1) {
      let sumDiffs = 0;
      for (let i = 1; i < tapTimesRef.current.length; i++) sumDiffs += (tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
      const avgDiff = sumDiffs / (tapTimesRef.current.length - 1);
      const newBpm = Math.round(60000 / avgDiff);
      if (newBpm >= 20 && newBpm <= 300) setBpm(newBpm);
    }
  };

  // Color mapping — improved contrast for light mode
  const getIntensityColor = (level: BeatIntensity) => {
    switch(level) {
      case BeatIntensity.STRONG: return { dot: '#10b981', rgb: '16,185,129' };
      case BeatIntensity.WEAK: return { dot: '#a78bfa', rgb: '167,139,250' };
      case BeatIntensity.POLY_A: return { dot: '#0ea5e9', rgb: '14,165,233' };
      case BeatIntensity.POLY_B: return { dot: '#f59e0b', rgb: '245,158,11' };
      case BeatIntensity.POLY_BOTH: return { dot: '#e879f9', rgb: '232,121,249' };
      default: return { dot: '#6b7280', rgb: '107,114,128' };
    }
  };

  const renderIntensityIcon = (level: BeatIntensity) => {
    const c = getIntensityColor(level);
    switch(level) {
      case BeatIntensity.STRONG: return <div className="w-3 h-3 rounded-full" style={{ background: c.dot, boxShadow: `0 0 8px rgba(${c.rgb},0.5)` }}></div>;
      case BeatIntensity.WEAK: return <div className="w-2 h-2 rounded-full" style={{ background: c.dot, opacity: 0.7 }}></div>;
      case BeatIntensity.POLY_A: return <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.dot }}></div>;
      case BeatIntensity.POLY_B: return <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.dot }}></div>;
      case BeatIntensity.POLY_BOTH: return <div className="w-3 h-3 rounded-full" style={{ background: c.dot, boxShadow: `0 0 6px rgba(${c.rgb},0.4)` }}></div>;
      default: return <div className="w-1.5 h-1.5 rounded-full bg-tx-muted opacity-30"></div>;
    }
  };

  const renderBeatCell = (idx: number, intensity: BeatIntensity, clickable: boolean) => {
    const isActive = isPlaying && idx === currentStepIndex;
    const c = getIntensityColor(intensity);
    return (
      <button
        key={idx}
        onClick={clickable ? () => cycleIntensity(idx) : undefined}
        disabled={!clickable}
        className={`relative w-7 h-9 rounded-lg flex items-center justify-center transition-transform duration-75 ${clickable ? 'cursor-pointer' : ''} ${isActive ? 'beat-pulse' : ''}`}
        style={{
          background: isActive ? `rgba(${c.rgb},0.1)` : 'var(--input-bg)',
          border: isActive ? `1.5px solid rgba(${c.rgb},0.6)` : '1px solid var(--bd)',
          transform: isActive ? 'scale(1.2)' : 'scale(1)',
          boxShadow: isActive ? `0 0 14px rgba(${c.rgb},0.5), 0 0 4px rgba(${c.rgb},0.2)` : 'none',
        }}
      >
        {renderIntensityIcon(intensity)}
        {isActive && <span className="absolute inset-0 rounded-lg animate-ping opacity-20" style={{ background: c.dot }} />}
      </button>
    );
  };

  // Subdivision picker: cycle through [1,2,4] mapped to indices [0,1,2]
  const subValues = [1, 2, 4];
  const subIndex = subValues.indexOf(subdivision);
  const handleSubChange = (idx: number) => {
    const clamped = Math.max(0, Math.min(2, idx));
    setSubdivision(subValues[clamped]);
  };

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto p-3 sm:p-6 space-y-3 overflow-y-auto h-full no-scrollbar animate-slide-up">

      {/* === Unified Main Card === */}
      <div className="w-full card p-4 sm:p-5 space-y-4">
        {/* Top row: Knob | BPM | Play */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-1">
            <AnalogKnob value={volume} min={0} max={1} step={0.05} onChange={setVolume} label={volume === 0 ? '靜音' : '音量'} size={56} />
            <button onClick={handleTap} className="btn-ghost py-1 px-2.5 text-[10px] uppercase tracking-wider active:scale-95">
              Tap
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-5xl sm:text-6xl font-black gradient-text leading-none">{bpm}</span>
              <span className="label mt-0.5">BPM</span>
            </div>
            <button
              onClick={togglePlay}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-150 active:scale-90 cursor-pointer ${
                isPlaying ? 'bg-danger text-white' : 'btn-primary animate-glow-pulse'
              }`}
              style={isPlaying ? {} : { boxShadow: '0 4px 20px rgba(139,92,246,0.25)' }}
            >
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-0.5" />}
            </button>
          </div>
        </div>

        {/* BPM slider */}
        <div className="flex items-center gap-2">
          <button onClick={() => setBpm(b => Math.max(20, b - 1))} className="btn-ghost p-1.5"><Minus size={14}/></button>
          <input type="range" min="30" max="250" value={bpm} onChange={(e) => setBpm(parseInt(e.target.value))} className="flex-1 h-1 cursor-pointer" />
          <button onClick={() => setBpm(b => Math.min(300, b + 1))} className="btn-ghost p-1.5"><Plus size={14}/></button>
        </div>

        {/* Divider */}
        <div className="w-full h-px" style={{ background: 'var(--bd)' }} />

        {/* 2-column: Left 70% (mode + pickers) | Right 30% (speed trainer full height) */}
        <div className="grid gap-3 items-stretch" style={{ gridTemplateColumns: '7fr 3fr' }}>
          {/* Left: Mode toggle + Pickers */}
          <div className="flex flex-col gap-3">
            <div className="card-inner p-1 flex">
              <button onClick={() => { setMode('STANDARD'); setIsPlaying(false); setCurrentStepIndex(-1); }} className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${mode === 'STANDARD' ? 'text-primary-sub' : 'text-tx-muted hover:text-tx-sub'}`} style={mode === 'STANDARD' ? { background: 'var(--primary-bg)', border: '1px solid var(--primary)' } : {}}>
                標準
              </button>
              <button onClick={() => { setMode('POLYRHYTHM'); setIsPlaying(false); setCurrentStepIndex(-1); }} className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${mode === 'POLYRHYTHM' ? 'text-primary-sub' : 'text-tx-muted hover:text-tx-sub'}`} style={mode === 'POLYRHYTHM' ? { background: 'var(--primary-bg)', border: '1px solid var(--primary)' } : {}}>
                複合節奏
              </button>
            </div>
            <div className="flex items-center justify-center gap-3">
              {mode === 'STANDARD' ? (
                <>
                  <VerticalPicker value={numerator} min={1} max={16} onChange={setNumerator} label="拍數" />
                  <VerticalPicker value={subIndex} min={0} max={2} onChange={handleSubChange} label="細分" display={(v) => SUB_MAP[subValues[v]] || '?'} />
                </>
              ) : (
                <>
                  <VerticalPicker value={polyA} min={2} max={12} onChange={setPolyA} label="A" color="#0ea5e9" />
                  <VerticalPicker value={polyB} min={2} max={12} onChange={setPolyB} label="B" color="#f59e0b" />
                </>
              )}
            </div>
          </div>

          {/* Right: Speed Trainer — stretches to match left column height */}
          <div className="card-inner rounded-xl overflow-hidden transition-all duration-200 flex flex-col" style={trainerSettings.enabled ? { borderColor: 'rgba(245,158,11,0.2)' } : {}}>
            <div
              className="p-2 flex items-center justify-between cursor-pointer"
              onClick={() => setTrainerSettings(s => ({...s, enabled: !s.enabled}))}
            >
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-lg transition-all duration-200" style={trainerSettings.enabled ? { background: '#f59e0b', color: 'white' } : { background: 'var(--input-bg)', color: 'var(--tx-muted)' }}>
                  <TrendingUp size={12} />
                </div>
                <span className={`font-bold text-[10px] transition-colors ${trainerSettings.enabled ? 'text-tx' : 'text-tx-muted'}`}>
                  漸快
                </span>
              </div>
              <div className={`toggle-track ${trainerSettings.enabled ? 'active' : ''}`} style={trainerSettings.enabled ? { background: '#f59e0b' } : {}}>
                <div className="toggle-thumb"></div>
              </div>
            </div>
            {trainerSettings.enabled && (
              <div className="px-2 pb-2 space-y-2 animate-fade-in">
                <div className="space-y-1">
                  <label className="label block">增加量</label>
                  <div className="flex items-center justify-between">
                    <button onClick={(e) => { e.stopPropagation(); setTrainerSettings(s => ({...s, increment: Math.max(1, s.increment - 1)})); }} className="w-5 h-5 rounded flex items-center justify-center cursor-pointer hover:bg-bg-hover"><Minus size={10}/></button>
                    <span className="text-xs font-black text-warning">+{trainerSettings.increment}</span>
                    <button onClick={(e) => { e.stopPropagation(); setTrainerSettings(s => ({...s, increment: Math.min(20, s.increment + 1)})); }} className="w-5 h-5 rounded flex items-center justify-center cursor-pointer hover:bg-bg-hover"><Plus size={10}/></button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="label block">間隔</label>
                  <div className="flex items-center justify-between">
                    <button onClick={(e) => { e.stopPropagation(); setTrainerSettings(s => ({...s, barCount: Math.max(1, s.barCount - 1)})); }} className="w-5 h-5 rounded flex items-center justify-center cursor-pointer hover:bg-bg-hover"><Minus size={10}/></button>
                    <span className="text-xs font-black text-tx">{trainerSettings.barCount}bar</span>
                    <button onClick={(e) => { e.stopPropagation(); setTrainerSettings(s => ({...s, barCount: Math.min(64, s.barCount + 1)})); }} className="w-5 h-5 rounded flex items-center justify-center cursor-pointer hover:bg-bg-hover"><Plus size={10}/></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* === Accent Grid === */}
      <div className="w-full card p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="label">重音型態</label>
          <button onClick={resetPattern} className="flex items-center gap-1 text-[10px] text-tx-muted hover:text-tx transition-colors cursor-pointer">
            <RotateCcw size={10} /> 重置
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 justify-center card-inner p-2">
          {mode === 'STANDARD' ? (
            Array.from({ length: numerator }).map((_, beatIdx) => (
              <div key={beatIdx} className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--input-bg)' }}>
                {Array.from({ length: subdivision }).map((_, subIdx) => {
                  const idx = beatIdx * subdivision + subIdx;
                  return renderBeatCell(idx, grid[idx], true);
                })}
              </div>
            ))
          ) : (
            grid.map((intensity, idx) => renderBeatCell(idx, intensity, false))
          )}
        </div>
      </div>

      <div className="h-4 w-full shrink-0"></div>
    </div>
  );
};

export default Metronome;
