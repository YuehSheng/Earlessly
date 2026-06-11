
import { NoteName, TunerData } from '../../types';

export const NOTE_STRINGS = [
  NoteName.C, NoteName.CSharp, NoteName.D, NoteName.DSharp, NoteName.E,
  NoteName.F, NoteName.FSharp, NoteName.G, NoteName.GSharp, NoteName.A,
  NoteName.ASharp, NoteName.B
];

export const getNoteFromFrequency = (frequency: number): TunerData => {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return { note: NoteName.A, octave: 4, cents: 0, frequency: 440, isSilent: true };
  }
  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2)) + 69;
  const midi = Math.round(noteNum);
  const cents = Math.floor((noteNum - midi) * 100);
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return {
    note: NOTE_STRINGS[noteIndex],
    octave,
    cents,
    frequency,
    isSilent: false
  };
};

export const autoCorrelate = (buf: Float32Array, sampleRate: number, rmsThreshold: number = 0.01): number => {
  const SIZE = buf.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);
  let bestOffset = -1;
  let bestCorrelation = 0;
  let rms = 0;
  let foundGoodCorrelation = false;
  const correlations = new Float32Array(MAX_SAMPLES);

  for (let i = 0; i < SIZE; i++) {
    const val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < rmsThreshold) return -1;

  let lastCorrelation = 1;
  for (let offset = 2; offset < MAX_SAMPLES - 1; offset++) {
    let correlation = 0;
    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs((buf[i]) - (buf[i + offset]));
    }
    correlation = 1 - (correlation / MAX_SAMPLES);
    correlations[offset] = correlation;

    if ((correlation > 0.9) && (correlation > lastCorrelation)) {
      foundGoodCorrelation = true;
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    } else if (foundGoodCorrelation) {
      const denom = (2 * correlations[bestOffset] - correlations[bestOffset + 1] - correlations[bestOffset - 1]);
      if (Math.abs(denom) < 0.0001) return sampleRate / (bestOffset || 1);
      const shift = (correlations[bestOffset + 1] - correlations[bestOffset - 1]) / (2 * denom);
      return sampleRate / (bestOffset + shift);
    }
    lastCorrelation = correlation;
  }
  if (bestCorrelation > 0.01 && bestOffset > 0) {
    return sampleRate / bestOffset;
  }
  return -1;
};
