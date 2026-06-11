
export interface ScorePalette {
  color: string;
  bg: string;
  border: string;
  gradient: string;
}

// String values resolve to CSS custom properties defined in index.html.
// Both `--status-*` and `--status-*-bg/border` are theme-aware (dark vs light),
// so inline styles automatically follow the active theme.
export const SCORE_COLORS = {
  success: 'var(--status-success)',
  successBg: 'var(--status-success-bg)',
  successBorder: 'var(--status-success-border)',
  warning: 'var(--status-warning)',
  warningBg: 'var(--status-warning-bg)',
  warningBorder: 'var(--status-warning-border)',
  danger: 'var(--status-danger)',
  dangerBg: 'var(--status-danger-bg)',
  dangerBorder: 'var(--status-danger-border)',
} as const;

// Default thresholds: >= 80 success, >= 50 warning, else danger.
export function getScorePalette(score: number, thresholds: [number, number] = [80, 50]): ScorePalette {
  const [hi, mid] = thresholds;
  if (score >= hi) {
    return {
      color: SCORE_COLORS.success,
      bg: SCORE_COLORS.successBg,
      border: SCORE_COLORS.successBorder,
      gradient: 'linear-gradient(90deg, var(--status-success), var(--status-success-soft))',
    };
  }
  if (score >= mid) {
    return {
      color: SCORE_COLORS.warning,
      bg: SCORE_COLORS.warningBg,
      border: SCORE_COLORS.warningBorder,
      gradient: 'linear-gradient(90deg, var(--status-warning), var(--status-warning-soft))',
    };
  }
  return {
    color: SCORE_COLORS.danger,
    bg: SCORE_COLORS.dangerBg,
    border: SCORE_COLORS.dangerBorder,
    gradient: 'linear-gradient(90deg, var(--status-danger), var(--status-danger-soft))',
  };
}
