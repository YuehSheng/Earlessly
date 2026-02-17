
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Settings, Play, CheckCircle, Headphones, SkipForward, Sliders } from 'lucide-react';
import { getAudioContext } from '../utils/audioEngine';

// ── Types ─────────────────────────────────────────────────────────────────

interface EQBand { id: number; frequency: number; gain: number; }
type Phase = 'idle' | 'playing' | 'answering' | 'result';
type Difficulty = 'easy' | 'medium' | 'hard';

interface Props { onBack: () => void; volume?: number; }

// ── Difficulty Config ──────────────────────────────────────────────────────

const DIFF: Record<Difficulty, {
  label: string; desc: string;
  qCount: () => number; uCount: number;
  freqs: number[]; gainMin: number; gainMax: number;
}> = {
  easy: { label: '簡單', desc: '1 個調節點', qCount: () => 1, uCount: 1, freqs: [1000], gainMin: 8, gainMax: 13 },
  medium: { label: '中等', desc: '2 個調節點', qCount: () => 2, uCount: 2, freqs: [300, 3000], gainMin: 5, gainMax: 11 },
  hard: { label: '困難', desc: '3 個調節點', qCount: () => 2 + Math.floor(Math.random() * 2), uCount: 3, freqs: [150, 900, 6500], gainMin: 4, gainMax: 10 },
};

// ── SVG Layout ─────────────────────────────────────────────────────────────

const SW = 860, SH = 240;
const PL = 48, PR = 18, PT = 18, PB = 30;
const PW = SW - PL - PR;
const PH = SH - PT - PB;

// ── EQ Constants ───────────────────────────────────────────────────────────

const FMIN = 20, FMAX = 20000;
const GMIN = -15, GMAX = 15;
const BW = 0.8; // bandwidth in octaves (controls filter width)

const FGRID = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const GGRID = [-12, -6, 0, 6, 12];

// ── Math Helpers ────────────────────────────────────────────────────────────

const freqNx = (f: number) => Math.log10(f / FMIN) / Math.log10(FMAX / FMIN);
const nxFreq = (n: number) => FMIN * Math.pow(FMAX / FMIN, Math.max(0.001, Math.min(0.999, n)));
const gainNy = (g: number) => 1 - (g - GMIN) / (GMAX - GMIN);
const nyGain = (n: number) => GMIN + (1 - Math.max(0, Math.min(1, n))) * (GMAX - GMIN);
const fToX = (f: number) => freqNx(f) * PW;
const gToY = (g: number) => gainNy(g) * PH;
const ZERO_Y = gainNy(0) * PH; // 50% of PH since GMIN = -GMAX

// Gaussian approximation of a peaking EQ filter
function eqGain(freq: number, bands: EQBand[]): number {
  let total = 0;
  for (const b of bands) {
    const oct = Math.log2(freq / b.frequency);
    total += b.gain * Math.exp(-(oct * oct) / (2 * BW * BW));
  }
  return Math.max(GMIN, Math.min(GMAX, total));
}

function curvePath(bands: EQBand[], N = 420): string {
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const nx = i / N;
    const x = (nx * PW).toFixed(1);
    const y = (gainNy(eqGain(nxFreq(nx), bands)) * PH).toFixed(1);
    pts.push(`${i === 0 ? 'M' : 'L'}${x},${y}`);
  }
  return pts.join(' ');
}

function areaPath(bands: EQBand[], N = 420): string {
  const line = curvePath(bands, N);
  return `${line} L${PW.toFixed(1)},${ZERO_Y.toFixed(1)} L0,${ZERO_Y.toFixed(1)} Z`;
}

// Score [0–100]: compare EQ curve similarity via RMS error
function calcScore(answer: EQBand[], user: EQBand[], N = 300): number {
  let err = 0;
  for (let i = 0; i < N; i++) {
    const freq = nxFreq(i / (N - 1));
    err += (eqGain(freq, answer) - eqGain(freq, user)) ** 2;
  }
  const rms = Math.sqrt(err / N);
  return Math.max(0, Math.min(100, (1 - rms / 6) * 100));
}

function randomBands(count: number, gainMin: number, gainMax: number): EQBand[] {
  return Array.from({ length: count }, (_, i) => {
    const nx = Math.max(0.08, Math.min(0.92,
      (i + 0.5) / count + (Math.random() - 0.5) * 0.35));
    const sign = Math.random() > 0.45 ? 1 : -1;
    return { id: i, frequency: nxFreq(nx), gain: sign * (gainMin + Math.random() * (gainMax - gainMin)) };
  });
}

function defaultBands(diff: Difficulty): EQBand[] {
  return DIFF[diff].freqs.map((freq, i) => ({ id: i, frequency: freq, gain: 0 }));
}

function fmtF(f: number): string {
  return f >= 1000 ? `${(f / 1000).toFixed(f >= 9500 ? 0 : 1)}k` : `${Math.round(f)}`;
}

// Pink noise (Voss-McCartney algorithm)
function makePinkNoise(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 3;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return buf;
}

// ── Component ──────────────────────────────────────────────────────────────

const FrequencyTraining: React.FC<Props> = ({ onBack, volume = 0.5 }) => {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<Phase>('idle');
  const [answer, setAnswer] = useState<EQBand[]>([]);
  const [user, setUser] = useState<EQBand[]>(defaultBands('easy'));
  const [score, setScore] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [dragId, setDragId] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopAudio = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    try { srcRef.current?.stop(); } catch { }
    srcRef.current = null; gainRef.current = null;
  }, []);

  useEffect(() => () => { stopAudio(); }, [stopAudio]);

  const playEQ = useCallback((bands: EQBand[], dur = 2.5, cb?: () => void) => {
    stopAudio();
    const ctx = getAudioContext();
    ctx.resume().catch(() => { });

    const src = ctx.createBufferSource();
    src.buffer = makePinkNoise(ctx);
    src.loop = true;

    let node: AudioNode = src;
    for (const b of bands) {
      const f = ctx.createBiquadFilter();
      f.type = 'peaking';
      f.frequency.value = Math.max(20, Math.min(20000, b.frequency));
      f.gain.value = Math.max(-15, Math.min(15, b.gain));
      f.Q.value = 1.5;
      node.connect(f); node = f;
    }

    const master = ctx.createGain();
    const peak = Math.max(0, Math.min(1, volume));
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(peak, ctx.currentTime + 0.07);
    master.gain.setValueAtTime(peak, ctx.currentTime + dur - 0.15);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
    node.connect(master); master.connect(ctx.destination);
    src.start(); srcRef.current = src; gainRef.current = master;

    if (cb) timerRef.current = setTimeout(() => { stopAudio(); cb(); }, dur * 1000);
  }, [stopAudio, volume]);

  const start = useCallback(() => {
    const cfg = DIFF[difficulty];
    const bands = randomBands(cfg.qCount(), cfg.gainMin, cfg.gainMax);
    setAnswer(bands);
    setUser(defaultBands(difficulty));
    setScore(null); setPhase('playing');
    playEQ(bands, 2.5, () => setPhase('answering'));
  }, [playEQ, difficulty]);

  const replay = useCallback(() => {
    setPreviewing(false);
    playEQ(answer, 2.5, () => { });
  }, [answer, playEQ]);

  const previewUser = useCallback(() => {
    playEQ(user, 2.0, () => setPreviewing(false));
    setPreviewing(true);
  }, [user, playEQ]);

  const submit = useCallback(() => {
    stopAudio(); setPreviewing(false);
    const s = calcScore(answer, user);
    setScore(s); setTotal(t => t + 1);
    if (s >= 90) setCorrect(c => c + 1);
    setPhase('result');
  }, [answer, user, stopAudio]);

  // ── Pointer Events ──────────────────────────────────────────────────────

  const plotPt = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current; if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (SW / r.width) - PL,
      y: (e.clientY - r.top) * (SH / r.height) - PT,
    };
  }, []);

  const onDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (phase !== 'answering') return;
    const pt = plotPt(e); if (!pt) return;
    let best = -1, minD = 30 * 30;
    for (const b of user) {
      const d = (pt.x - fToX(b.frequency)) ** 2 + (pt.y - gToY(b.gain)) ** 2;
      if (d < minD) { minD = d; best = b.id; }
    }
    if (best !== -1) { e.currentTarget.setPointerCapture(e.pointerId); setDragId(best); }
  }, [phase, user, plotPt]);

  const onMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (dragId === null) return;
    const pt = plotPt(e); if (!pt) return;
    const nx = Math.max(0.01, Math.min(0.99, pt.x / PW));
    const ny = Math.max(0, Math.min(1, pt.y / PH));
    setUser(prev => prev.map(b =>
      b.id === dragId ? { ...b, frequency: nxFreq(nx), gain: nyGain(ny) } : b
    ));
  }, [dragId, plotPt]);

  const onUp = useCallback(() => setDragId(null), []);

  // ── Memoized Paths ──────────────────────────────────────────────────────

  const userCurve = useMemo(() => curvePath(user), [user]);
  const userArea = useMemo(() => areaPath(user), [user]);
  const ansCurve = useMemo(() => phase === 'result' ? curvePath(answer) : null, [phase, answer]);
  const ansArea = useMemo(() => phase === 'result' ? areaPath(answer) : null, [phase, answer]);

  const activeBand = user.find(b => b.id === (dragId ?? hoverId));

  // ── Score bar color ─────────────────────────────────────────────────────

  const scoreColor = score !== null
    ? score >= 90 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444'
    : '#8b5cf6';

  const scoreBg = score !== null
    ? score >= 90 ? 'rgba(16,185,129,0.07)' : score >= 70 ? 'rgba(245,158,11,0.07)' : 'rgba(239,68,68,0.07)'
    : 'transparent';

  const scoreBorder = score !== null
    ? score >= 90 ? 'rgba(16,185,129,0.25)' : score >= 70 ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'
    : 'transparent';

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col max-w-4xl mx-auto w-full px-4 py-6 animate-slide-up">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="btn-ghost p-2 cursor-pointer"
          aria-label="返回設定"
        >
          <Settings size={18} />
        </button>

        <div className="flex items-center gap-3">
          {/* Difficulty selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
              <button
                key={d}
                disabled={phase === 'playing'}
                onClick={() => { if (phase !== 'playing') { setDifficulty(d); setPhase('idle'); setScore(null); setUser(defaultBands(d)); } }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:cursor-default"
                style={difficulty === d
                  ? { background: 'var(--primary-bg)', border: '1px solid var(--primary)', color: 'var(--primary-sub)' }
                  : { color: 'var(--tx-muted)' }}
              >
                {DIFF[d].label}
              </button>
            ))}
          </div>

          {/* Session score */}
          {total > 0 && (
            <div className="text-right">
              <span className="text-lg font-black" style={{ color: 'var(--primary)' }}>{correct}</span>
              <span className="text-tx-muted mx-1 font-bold">/</span>
              <span className="text-tx-sub font-bold">{total}</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="mb-4 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm min-h-10"
        style={{ background: 'var(--primary-bg)', border: '1px solid rgba(139,92,246,0.18)' }}>
        {phase === 'idle' && (
          <><Sliders size={13} style={{ color: 'var(--primary)' }} className="shrink-0" />
            <span style={{ color: 'var(--primary-sub)' }}>
              {DIFF[difficulty].desc} · 準備好後按「開始訓練」，仔細聆聽頻率特性
            </span></>
        )}
        {phase === 'playing' && (
          <><div className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: 'var(--primary)' }} />
            <span style={{ color: 'var(--primary-sub)' }}>正在播放題目，請仔細聆聽 EQ 頻率特性…</span></>
        )}
        {phase === 'answering' && (
          <><Sliders size={13} style={{ color: 'var(--primary)' }} className="shrink-0" />
            <span style={{ color: 'var(--primary-sub)' }}>
              拖曳紫色節點：<strong>左右</strong>調整頻率，<strong>上下</strong>調整增益 · 可重播或試聽你的設定
            </span></>
        )}
        {phase === 'result' && score !== null && (
          <><CheckCircle size={13} style={{ color: scoreColor }} className="shrink-0" />
            <span style={{ color: scoreColor }}>
              {score >= 90 ? '優秀！頻率曲線高度吻合' : score >= 70 ? '接近了，繼續練習！' : '差距較大，多聆聽幾次觀察頻率形狀'}
            </span></>
        )}
      </div>

      {/* EQ Visualizer Card */}
      <div className="rounded-2xl overflow-hidden mb-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--bd)' }}>

        {/* Top info bar */}
        <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2"
          style={{ borderBottom: '1px solid var(--bd)' }}>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--primary)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--tx-muted)' }}>
              Parametric EQ · 3 Bands
            </span>
          </div>

          <span className="text-xs font-mono"
            style={{ color: activeBand ? 'var(--primary-sub)' : 'var(--tx-muted)' }}>
            {activeBand
              ? `${fmtF(activeBand.frequency)} Hz · ${activeBand.gain >= 0 ? '+' : ''}${activeBand.gain.toFixed(1)} dB`
              : '20 Hz – 20 kHz · ±15 dB'}
          </span>

          {phase === 'result' && (
            <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--tx-muted)' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-0.5 rounded-full" style={{ background: 'var(--primary)' }} />
                你的答案
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5" style={{ borderTop: '2px dashed #10b981' }} />
                正確答案
              </div>
            </div>
          )}
        </div>

        {/* SVG EQ Plot */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SW} ${SH}`}
          className="w-full block"
          style={{
            background: '#080810',
            touchAction: 'none',
            cursor: dragId !== null ? 'grabbing' : phase === 'answering' ? 'crosshair' : 'default',
          }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        >
          <defs>
            <linearGradient id="ftUG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.28" />
              <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.18" />
            </linearGradient>
            <linearGradient id="ftAG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#10b981" stopOpacity="0" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.12" />
            </linearGradient>
            <clipPath id="ftClip">
              <rect x="0" y="0" width={PW} height={PH} />
            </clipPath>
          </defs>

          <g transform={`translate(${PL},${PT})`}>

            {/* Gain grid */}
            {GGRID.map(g => {
              const y = gToY(g);
              const isZero = g === 0;
              return (
                <g key={g}>
                  <line x1={0} y1={y} x2={PW} y2={y}
                    stroke={isZero ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.05)'}
                    strokeWidth={isZero ? 1.2 : 0.6}
                    strokeDasharray={isZero ? undefined : '3,6'}
                  />
                  <text x={-6} y={y + 4} textAnchor="end" fontSize="10"
                    fill="rgba(255,255,255,0.22)" fontFamily="Inter,sans-serif">
                    {g > 0 ? `+${g}` : g}
                  </text>
                </g>
              );
            })}

            {/* Freq grid */}
            {FGRID.map(f => {
              const x = fToX(f);
              return (
                <g key={f}>
                  <line x1={x} y1={0} x2={x} y2={PH}
                    stroke="rgba(255,255,255,0.05)" strokeWidth={0.6} strokeDasharray="3,6" />
                  <text x={x} y={PH + 18} textAnchor="middle" fontSize="10"
                    fill="rgba(255,255,255,0.22)" fontFamily="Inter,sans-serif">
                    {fmtF(f)}
                  </text>
                </g>
              );
            })}

            {/* Answer area fill (result) */}
            {ansArea && (
              <path d={ansArea} fill="url(#ftAG)" clipPath="url(#ftClip)" />
            )}

            {/* User area fill */}
            <path d={userArea} fill="url(#ftUG)" clipPath="url(#ftClip)" />

            {/* Answer curve (result) */}
            {ansCurve && (
              <path d={ansCurve} fill="none" stroke="#10b981" strokeWidth="2"
                strokeDasharray="8,4" clipPath="url(#ftClip)" />
            )}

            {/* User curve */}
            <path d={userCurve} fill="none" stroke="#8b5cf6" strokeWidth="2.5"
              clipPath="url(#ftClip)" />

            {/* User control nodes */}
            {phase !== 'idle' && phase !== 'playing' && user.map(b => {
              const x = fToX(b.frequency);
              const y = gToY(b.gain);
              const active = dragId === b.id || hoverId === b.id;
              return (
                <g key={b.id}
                  style={{ cursor: phase === 'answering' ? 'grab' : 'default' }}
                  onPointerEnter={() => phase === 'answering' && setHoverId(b.id)}
                  onPointerLeave={() => setHoverId(null)}
                >
                  {active && (
                    <circle cx={x} cy={y} r={24}
                      fill="rgba(139,92,246,0.1)" />
                  )}
                  {/* Hit area */}
                  <circle cx={x} cy={y} r={20} fill="transparent" />
                  {/* Outer ring */}
                  <circle cx={x} cy={y} r={9}
                    fill="rgba(139,92,246,0.15)" stroke="#8b5cf6" strokeWidth="1.5" />
                  {/* Inner dot */}
                  <circle cx={x} cy={y} r={4} fill="#8b5cf6" />
                  {/* Drag vertical guide */}
                  {dragId === b.id && (
                    <>
                      <line x1={x} y1={0} x2={x} y2={PH}
                        stroke="rgba(139,92,246,0.2)" strokeWidth={0.8} strokeDasharray="3,4" />
                      <line x1={0} y1={y} x2={PW} y2={y}
                        stroke="rgba(139,92,246,0.2)" strokeWidth={0.8} strokeDasharray="3,4" />
                    </>
                  )}
                </g>
              );
            })}

            {/* Answer nodes (result only) */}
            {phase === 'result' && answer.map(b => {
              const x = fToX(b.frequency);
              const y = gToY(b.gain);
              return (
                <g key={b.id}>
                  <circle cx={x} cy={y} r={9}
                    fill="rgba(16,185,129,0.15)" stroke="#10b981" strokeWidth="1.5" />
                  <circle cx={x} cy={y} r={4} fill="#10b981" />
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Score Card */}
      {phase === 'result' && score !== null && (
        <div className="mb-5 rounded-2xl p-5 animate-scale-in flex items-center justify-between gap-6"
          style={{ background: scoreBg, border: `1px solid ${scoreBorder}` }}>
          <div>
            <div className="text-4xl font-black mb-0.5" style={{ color: scoreColor }}>
              {score.toFixed(1)}%
            </div>
            <div className="text-sm" style={{ color: 'var(--tx-muted)' }}>
              {score >= 90 ? '匹配成功 ✓' : score >= 70 ? '接近正確' : '差距較大'}
            </div>
          </div>
          <div className="flex-1 max-w-52">
            <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--tx-muted)' }}>
              <span>匹配度</span>
              <span>目標 90%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${score}%`,
                  background: score >= 90
                    ? 'linear-gradient(90deg,#10b981,#34d399)'
                    : score >= 70
                      ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                      : 'linear-gradient(90deg,#ef4444,#f87171)',
                }} />
            </div>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-3 flex-wrap justify-center">
        {phase === 'idle' && (
          <button onClick={start}
            className="flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg,var(--primary),var(--accent))', color: 'white' }}>
            <Play size={16} /> 開始訓練
          </button>
        )}

        {phase === 'playing' && (
          <div className="flex items-center gap-3 px-6 py-3 rounded-xl"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--bd)' }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--primary)' }} />
            <span className="text-sm" style={{ color: 'var(--tx-muted)' }}>播放題目中…</span>
          </div>
        )}

        {phase === 'answering' && (
          <>
            <button onClick={replay}
              className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer hover:opacity-80 active:scale-95 transition-all btn-ghost">
              <Play size={14} /> 重播題目
            </button>
            <button onClick={previewUser} disabled={previewing}
              className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer hover:opacity-80 active:scale-95 transition-all btn-ghost disabled:opacity-40">
              <Headphones size={14} /> {previewing ? '播放中…' : '試聽 EQ'}
            </button>
            <button onClick={submit}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg,var(--primary),var(--accent))', color: 'white' }}>
              <CheckCircle size={15} /> 提交答案
            </button>
          </>
        )}

        {phase === 'result' && (
          <button onClick={start}
            className="flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg,var(--primary),var(--accent))', color: 'white' }}>
            <SkipForward size={16} /> 下一題
          </button>
        )}
      </div>
    </div>
  );
};

export default FrequencyTraining;
