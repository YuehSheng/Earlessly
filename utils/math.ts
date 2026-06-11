
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

export const midiToFreq = (midi: number): number =>
  440 * Math.pow(2, (midi - 69) / 12);

export const freqToMidi = (freq: number): number =>
  12 * Math.log2(freq / 440) + 69;

export const centsBetween = (targetHz: number, actualHz: number): number =>
  1200 * Math.log2(actualHz / targetHz);

export const noteIndex = (midi: number): number =>
  ((midi % 12) + 12) % 12;

export const midiOctave = (midi: number): number =>
  Math.floor(midi / 12) - 1;

export const randInt = (min: number, max: number): number =>
  min + Math.floor(Math.random() * (max - min + 1));

export const pickRandom = <T>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];
