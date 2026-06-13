
import { DrumVoice } from '../../types';

// Shared white-noise buffer — generated once, reused across hi-hat/snare/clap voices.
let noiseBuffer: AudioBuffer | null = null;
const getNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const len = Math.floor(ctx.sampleRate * 0.5);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
};

type Voice = (ctx: AudioContext, time: number, dest: AudioNode, gain: number) => void;

const playKick: Voice = (ctx, time, dest, gain) => {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.18);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(gain, time + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);
  osc.connect(g);
  g.connect(dest);
  osc.start(time);
  osc.stop(time + 0.35);
};

const playSnare: Voice = (ctx, time, dest, gain) => {
  // Body: triangle around 200Hz
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(200, time);
  oscGain.gain.setValueAtTime(0.0001, time);
  oscGain.gain.linearRampToValueAtTime(gain * 0.55, time + 0.003);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
  osc.connect(oscGain);
  oscGain.connect(dest);
  osc.start(time);
  osc.stop(time + 0.15);

  // Snap: band-passed white noise
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'highpass';
  bp.frequency.value = 1500;
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.0001, time);
  nGain.gain.linearRampToValueAtTime(gain * 0.9, time + 0.003);
  nGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
  noise.connect(bp);
  bp.connect(nGain);
  nGain.connect(dest);
  noise.start(time);
  noise.stop(time + 0.2);
};

const playHat = (decay: number): Voice => (ctx, time, dest, gain) => {
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 10000;
  bp.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(gain * 0.6, time + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, time + decay);
  noise.connect(hp);
  hp.connect(bp);
  bp.connect(g);
  g.connect(dest);
  noise.start(time);
  noise.stop(time + decay + 0.05);
};

const playClap: Voice = (ctx, time, dest, gain) => {
  // Three quick noise bursts to fake the human handclap stack.
  const bursts = [0, 0.012, 0.025];
  bursts.forEach((offset, idx) => {
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1200;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    const start = time + offset;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(gain * (idx === bursts.length - 1 ? 0.8 : 0.5), start + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, start + (idx === bursts.length - 1 ? 0.22 : 0.04));
    noise.connect(bp);
    bp.connect(g);
    g.connect(dest);
    noise.start(start);
    noise.stop(start + 0.25);
  });
};

const playCowbell: Voice = (ctx, time, dest, gain) => {
  const freqs = [540, 800];
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(gain * 0.45, time + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
  freqs.forEach(f => {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    o.connect(g);
    o.start(time);
    o.stop(time + 0.2);
  });
  g.connect(dest);
};

export const DRUM_PLAYERS: Record<DrumVoice, Voice> = {
  kick: playKick,
  snare: playSnare,
  closedHat: playHat(0.06),
  openHat: playHat(0.32),
  clap: playClap,
  cowbell: playCowbell,
};

export const DRUM_VOICE_ORDER: DrumVoice[] = ['kick', 'snare', 'closedHat', 'openHat', 'clap', 'cowbell'];

export const DRUM_VOICE_LABELS: Record<DrumVoice, string> = {
  kick: 'Kick',
  snare: 'Snare',
  closedHat: 'Hat',
  openHat: 'Open',
  clap: 'Clap',
  cowbell: 'Bell',
};
