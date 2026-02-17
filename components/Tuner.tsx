
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { getAudioContext, autoCorrelate, getNoteFromFrequency } from '../utils/audioEngine';
import { TunerData } from '../types';

const NOTE_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const HISTORY_DURATION = 6; // seconds of visible history
const HISTORY_MAX = 360; // max stored points

interface PitchPoint {
  time: number; // performance.now() ms
  semitone: number; // fractional MIDI number (e.g. 69.3 = A4 + 30 cents)
}

const Tuner: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [tunerData, setTunerData] = useState<TunerData | null>(null);
  const [micVolume, setMicVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafId = useRef<number | null>(null);
  const bufferRef = useRef<Float32Array | null>(null);
  const isListeningRef = useRef(false);
  const smoothedCentsRef = useRef(0);
  const smoothedNoteRef = useRef<{ note: string; octave: number; count: number }>({ note: '', octave: 0, count: 0 });

  // Pitch history
  const pitchHistoryRef = useRef<PitchPoint[]>([]);
  const historyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRafRef = useRef<number | null>(null);

  const startTuner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      audioRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      bufferRef.current = new Float32Array(analyser.fftSize);
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;
      isListeningRef.current = true;
      setIsListening(true);
      setError(null);
      updatePitch();
    } catch (err) {
      console.error(err);
      setError("無法取得麥克風權限或麥克風不可用。");
    }
  };

  const stopTuner = () => {
    isListeningRef.current = false;
    if (rafId.current !== null) { cancelAnimationFrame(rafId.current); rafId.current = null; }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current.mediaStream.getTracks().forEach(track => track.stop());
      sourceRef.current = null;
    }
    setIsListening(false);
    setTunerData(null);
    setMicVolume(0);
    pitchHistoryRef.current = [];
  };

  const updatePitch = () => {
    if (!isListeningRef.current || !analyserRef.current || !audioRef.current || !bufferRef.current) return;
    analyserRef.current.getFloatTimeDomainData(bufferRef.current);
    let sumSquares = 0.0;
    for (const amplitude of bufferRef.current) sumSquares += amplitude * amplitude;
    const volume = Math.sqrt(sumSquares / bufferRef.current.length);
    setMicVolume(volume);
    const frequency = autoCorrelate(bufferRef.current, audioRef.current.sampleRate);
    if (Number.isFinite(frequency) && frequency > 20 && frequency < 5000) {
      const raw = getNoteFromFrequency(frequency);
      // EMA smoothing on cents to reduce jitter
      const alpha = 0.3;
      // Note stability: only switch displayed note after consistent detections
      const noteKey = `${raw.note}${raw.octave}`;
      const prev = smoothedNoteRef.current;
      if (noteKey === `${prev.note}${prev.octave}`) {
        prev.count = Math.min(prev.count + 1, 10);
      } else {
        prev.count--;
        if (prev.count <= 0) {
          smoothedNoteRef.current = { note: raw.note as string, octave: raw.octave, count: 2 };
          smoothedCentsRef.current = raw.cents;
        }
      }
      smoothedCentsRef.current = smoothedCentsRef.current * (1 - alpha) + raw.cents * alpha;
      const stableNote = smoothedNoteRef.current;
      setTunerData({
        ...raw,
        note: (stableNote.count >= 2 ? stableNote.note : raw.note) as any,
        octave: stableNote.count >= 2 ? stableNote.octave : raw.octave,
        cents: Math.round(smoothedCentsRef.current),
      });

      // Record pitch history
      const semitone = 12 * (Math.log(frequency / 440) / Math.log(2)) + 69;
      const history = pitchHistoryRef.current;
      history.push({ time: performance.now(), semitone });
      if (history.length > HISTORY_MAX) history.splice(0, history.length - HISTORY_MAX);
    } else {
      setTunerData(prev => prev ? { ...prev, isSilent: true } : null);
    }
    rafId.current = requestAnimationFrame(updatePitch);
  };

  // Draw pitch history on canvas
  const drawHistory = useCallback(() => {
    const canvas = historyCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    const W = rect.width;
    const H = rect.height;
    const padLeft = 36;
    const padRight = 8;
    const padTop = 8;
    const padBottom = 8;
    const plotW = W - padLeft - padRight;
    const plotH = H - padTop - padBottom;

    ctx.clearRect(0, 0, W, H);

    const history = pitchHistoryRef.current;
    const now = performance.now();

    // Determine Y range: center on latest pitch, show ~2 octaves (24 semitones)
    let centerMidi = 69; // A4 default
    if (history.length > 0) {
      centerMidi = Math.round(history[history.length - 1].semitone);
    }
    const rangeHalf = 12; // 1 octave each direction
    const midiLow = centerMidi - rangeHalf;
    const midiHigh = centerMidi + rangeHalf;

    const midiToY = (midi: number) => {
      return padTop + plotH - ((midi - midiLow) / (midiHigh - midiLow)) * plotH;
    };
    const timeToX = (t: number) => {
      const age = (now - t) / 1000;
      return padLeft + plotW - (age / HISTORY_DURATION) * plotW;
    };

    // Draw horizontal grid lines for each note
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const computedStyle = getComputedStyle(document.documentElement);
    const mutedColor = computedStyle.getPropertyValue('--tx-muted').trim() || '#52525b';
    const gridColor = computedStyle.getPropertyValue('--bd').trim() || 'rgba(255,255,255,0.06)';

    for (let midi = midiLow; midi <= midiHigh; midi++) {
      const y = midiToY(midi);
      const noteIdx = ((midi % 12) + 12) % 12;
      const isNatural = [0, 2, 4, 5, 7, 9, 11].includes(noteIdx);

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = isNatural ? 0.8 : 0.3;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(W - padRight, y);
      ctx.stroke();

      // Label only natural notes
      if (isNatural) {
        ctx.fillStyle = mutedColor;
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(NOTE_LABELS[noteIdx], padLeft - 4, y);
      }
    }

    // Filter visible points
    const cutoff = now - HISTORY_DURATION * 1000;
    const visible = history.filter(p => p.time >= cutoff);
    if (visible.length < 2) {
      if (isListeningRef.current) historyRafRef.current = requestAnimationFrame(drawHistory);
      return;
    }

    // Draw pitch line
    ctx.beginPath();
    ctx.moveTo(timeToX(visible[0].time), midiToY(visible[0].semitone));
    for (let i = 1; i < visible.length; i++) {
      // Gap detection: if time gap > 200ms, break the line
      if (visible[i].time - visible[i - 1].time > 200) {
        ctx.moveTo(timeToX(visible[i].time), midiToY(visible[i].semitone));
      } else {
        ctx.lineTo(timeToX(visible[i].time), midiToY(visible[i].semitone));
      }
    }
    ctx.strokeStyle = computedStyle.getPropertyValue('--primary').trim() || '#8b5cf6';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Draw glow on the latest point
    const last = visible[visible.length - 1];
    const lx = timeToX(last.time);
    const ly = midiToY(last.semitone);
    const gradient = ctx.createRadialGradient(lx, ly, 0, lx, ly, 8);
    const primaryColor = computedStyle.getPropertyValue('--primary').trim() || '#8b5cf6';
    gradient.addColorStop(0, primaryColor);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(lx, ly, 8, 0, Math.PI * 2);
    ctx.fill();

    // Solid dot
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fill();

    if (isListeningRef.current) historyRafRef.current = requestAnimationFrame(drawHistory);
  }, []);

  // Start/stop history drawing loop
  useEffect(() => {
    if (isListening) {
      historyRafRef.current = requestAnimationFrame(drawHistory);
    } else {
      if (historyRafRef.current !== null) {
        cancelAnimationFrame(historyRafRef.current);
        historyRafRef.current = null;
      }
    }
    return () => {
      if (historyRafRef.current !== null) {
        cancelAnimationFrame(historyRafRef.current);
        historyRafRef.current = null;
      }
    };
  }, [isListening, drawHistory]);

  useEffect(() => { return () => { stopTuner(); }; }, []);

  const getGaugeColor = (cents: number) => {
    const absCents = Math.abs(cents);
    if (absCents < 5) return '#10b981';
    if (absCents < 20) return '#f59e0b';
    return '#ef4444';
  };

  const renderGauge = () => {
    const size = 300;
    const strokeWidth = 6;
    const radius = (size - strokeWidth * 2) / 2 - 10;
    const cx = size / 2;
    const cy = size / 2 + 15;
    const startAngle = -210;
    const endAngle = 30;
    const totalAngle = endAngle - startAngle;

    const polarToCartesian = (angle: number) => {
      const rad = (angle * Math.PI) / 180;
      return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
    };

    const arcPath = (start: number, end: number) => {
      const s = polarToCartesian(start);
      const e = polarToCartesian(end);
      const largeArc = Math.abs(end - start) > 180 ? 1 : 0;
      return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
    };

    const cents = tunerData?.cents ?? 0;
    const clamped = Math.max(-50, Math.min(50, cents));
    const needleAngle = startAngle + (totalAngle / 2) + (clamped / 50) * (totalAngle / 2);
    const needleEnd = polarToCartesian(needleAngle);
    const needleColor = tunerData && micVolume > 0.005 ? getGaugeColor(cents) : 'var(--tx-muted)';

    const ticks = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];

    return (
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.7}`} className="drop-shadow-lg">
        <path d={arcPath(startAngle, endAngle)} fill="none" stroke="var(--gauge-track)" strokeWidth={strokeWidth} strokeLinecap="round" />

        <path d={arcPath(startAngle, startAngle + totalAngle * 0.15)} fill="none" stroke="#ef4444" strokeWidth={strokeWidth} strokeLinecap="round" opacity="0.25" />
        <path d={arcPath(startAngle + totalAngle * 0.15, startAngle + totalAngle * 0.35)} fill="none" stroke="#f59e0b" strokeWidth={strokeWidth} strokeLinecap="round" opacity="0.25" />
        <path d={arcPath(startAngle + totalAngle * 0.35, startAngle + totalAngle * 0.65)} fill="none" stroke="#10b981" strokeWidth={strokeWidth} strokeLinecap="round" opacity="0.35" />
        <path d={arcPath(startAngle + totalAngle * 0.65, startAngle + totalAngle * 0.85)} fill="none" stroke="#f59e0b" strokeWidth={strokeWidth} strokeLinecap="round" opacity="0.25" />
        <path d={arcPath(startAngle + totalAngle * 0.85, endAngle)} fill="none" stroke="#ef4444" strokeWidth={strokeWidth} strokeLinecap="round" opacity="0.25" />

        {ticks.map(t => {
          const angle = startAngle + (totalAngle / 2) + (t / 50) * (totalAngle / 2);
          const inner = { x: cx + (radius - 10) * Math.cos((angle * Math.PI) / 180), y: cy + (radius - 10) * Math.sin((angle * Math.PI) / 180) };
          const outer = { x: cx + (radius + 3) * Math.cos((angle * Math.PI) / 180), y: cy + (radius + 3) * Math.sin((angle * Math.PI) / 180) };
          const isMajor = t === 0 || Math.abs(t) === 50;
          return (
            <g key={t}>
              <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={isMajor ? 'var(--tx-muted)' : 'var(--gauge-track)'} strokeWidth={isMajor ? 2 : 1} />
              {isMajor && (
                <text x={cx + (radius - 22) * Math.cos((angle * Math.PI) / 180)} y={cy + (radius - 22) * Math.sin((angle * Math.PI) / 180)} fill="var(--tx-muted)" fontSize="9" textAnchor="middle" dominantBaseline="middle" fontWeight="600">
                  {t > 0 ? `+${t}` : t}
                </text>
              )}
            </g>
          );
        })}

        <line
          x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y}
          stroke={needleColor} strokeWidth="2" strokeLinecap="round"
          style={{ transition: 'all 0.25s ease-out', filter: tunerData && Math.abs(cents) < 5 ? `drop-shadow(0 0 4px ${needleColor})` : 'none' }}
        />

        <circle cx={cx} cy={cy} r="5" fill="var(--bg-card)" stroke="var(--bd-strong)" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r="2.5" fill={needleColor} style={{ transition: 'fill 0.2s' }} />
      </svg>
    );
  };

  const hasData = tunerData && micVolume > 0.005;
  const inTune = hasData && Math.abs(tunerData!.cents) < 5;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] w-full p-4 sm:p-8 space-y-6 animate-slide-up">
      {/* Gauge */}
      <div className="relative">
        {renderGauge()}
        {inTune && (
          <div className="absolute inset-0 rounded-full animate-glow-success pointer-events-none" />
        )}
      </div>

      {/* Note Display */}
      <div className="text-center space-y-2 h-32 flex flex-col items-center justify-center">
        {hasData ? (
          <div className="animate-scale-in">
            <div className="flex items-baseline justify-center gap-1">
              <span
                className="text-7xl sm:text-8xl font-black tracking-tighter"
                style={{
                  color: inTune ? '#10b981' : 'var(--tx)',
                  textShadow: inTune ? '0 0 24px rgba(16,185,129,0.25)' : 'none',
                  transition: 'color 0.2s, text-shadow 0.2s'
                }}
              >
                {tunerData!.note}
              </span>
              <span className="text-2xl sm:text-3xl font-medium text-tx-muted">{tunerData!.octave}</span>
            </div>
            <div className="flex items-center justify-center gap-3 mt-2">
              <span className="text-sm font-mono text-tx-muted">{tunerData!.frequency.toFixed(1)} Hz</span>
              <span
                className="px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--bd)',
                  color: getGaugeColor(tunerData!.cents),
                }}
              >
                {tunerData!.cents > 0 ? '+' : ''}{tunerData!.cents} ¢
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full space-y-2">
            <div className="text-sm font-semibold uppercase tracking-[0.12em] text-tx-muted">
              {isListening ? "正在聆聽..." : "按下開始進行調音"}
            </div>
            {isListening && <div className="text-xs text-tx-muted">請彈奏或唱出一個長音</div>}
          </div>
        )}
      </div>

      {/* Volume Meter */}
      {isListening && (
        <div className="w-60 card p-3 space-y-2 animate-fade-in">
          <div className="flex justify-between items-center label">
            <span className="flex items-center gap-1.5"><Volume2 size={11}/> 輸入音量</span>
            <span>{Math.round(micVolume * 1000) / 10}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
            <div
              className="h-full rounded-full transition-all duration-75"
              style={{
                width: `${Math.min(100, micVolume * 500)}%`,
                background: micVolume > 0.01 ? 'linear-gradient(90deg, var(--primary), var(--accent))' : 'var(--bg-active)'
              }}
            />
          </div>
        </div>
      )}

      {/* Pitch History */}
      {isListening && (
        <div className="w-full max-w-lg card p-4 space-y-2 animate-fade-in">
          <div className="label">音高歷史</div>
          <canvas
            ref={historyCanvasRef}
            className="w-full rounded-lg"
            style={{ height: 160, background: 'var(--bg-hover)' }}
          />
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl text-sm text-danger animate-scale-in" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {/* Start/Stop Button */}
      <button
        onClick={isListening ? stopTuner : startTuner}
        className={`flex items-center gap-2.5 px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-150 cursor-pointer active:scale-95 ${
          isListening
            ? 'bg-danger text-white hover:bg-red-600'
            : 'btn-primary animate-glow-pulse'
        }`}
        style={isListening ? {} : { padding: '14px 32px' }}
      >
        {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        {isListening ? '停止' : '開始調音'}
      </button>
    </div>
  );
};

export default Tuner;
