
let audioCtx: AudioContext | null = null;

export const getAudioContext = (): AudioContext => {
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctor();
  }
  return audioCtx;
};

// iOS / Safari require an explicit resume after a user gesture
export const resumeAudio = (): void => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => { /* swallow autoplay rejection */ });
};
