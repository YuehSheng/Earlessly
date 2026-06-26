
import React from 'react';
import { SCORE_COLORS } from '../../utils/scoring';

export type StatusBarTone = 'idle' | 'playing' | 'answering' | 'correct' | 'incorrect';

interface Props {
  tone: StatusBarTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

// Replaces the near-identical 5-branch status banner that ScaleTraining,
// ProgressionTraining, FrequencyTraining, and RhythmTraining each duplicate.
const StatusBar: React.FC<Props> = ({ tone, icon, children }) => {
  let bg = 'var(--primary-bg)';
  let border = '1px solid rgba(200,149,108,0.18)';
  let color = 'var(--primary-sub)';

  if (tone === 'correct') {
    bg = SCORE_COLORS.successBg;
    border = `1px solid ${SCORE_COLORS.successBorder}`;
    color = SCORE_COLORS.success;
  } else if (tone === 'incorrect') {
    bg = SCORE_COLORS.dangerBg;
    border = `1px solid ${SCORE_COLORS.dangerBorder}`;
    color = SCORE_COLORS.danger;
  }

  const defaultDot = tone === 'playing' ? (
    <div className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: 'var(--primary)' }} />
  ) : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-5 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm min-h-10"
      style={{ background: bg, border }}
    >
      {icon ?? defaultDot}
      <span style={{ color }}>{children}</span>
    </div>
  );
};

export default StatusBar;
