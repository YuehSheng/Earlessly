
import React from 'react';
import { SCORE_COLORS } from '../../utils/scoring';

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed';

export interface OptionStyleParts {
  background: string;
  border: string;
  color: string;
  boxShadow?: string;
  opacity?: number;
}

// Single source of truth for the answer-button colors that ScaleTraining,
// ProgressionTraining, and EarTraining each redefined inline.
export function optionStyle(state: OptionState): OptionStyleParts {
  switch (state) {
    case 'correct':
      return {
        background: 'var(--status-success-bg-strong)',
        border: `1px solid ${SCORE_COLORS.successBorder}`,
        color: SCORE_COLORS.success,
        boxShadow: '0 0 12px var(--status-success-border-soft)',
      };
    case 'wrong':
      return {
        background: 'var(--status-danger-bg-strong)',
        border: `1px solid ${SCORE_COLORS.dangerBorder}`,
        color: SCORE_COLORS.danger,
      };
    case 'selected':
      return {
        background: 'var(--primary-bg)',
        border: '1px solid var(--primary)',
        color: 'var(--primary-sub)',
        boxShadow: '0 2px 10px rgba(200,149,108,0.15)',
      };
    case 'dimmed':
      return {
        background: 'var(--input-bg)',
        border: '1px solid var(--bd)',
        color: 'var(--tx-muted)',
        opacity: 0.5,
      };
    default:
      return {
        background: 'var(--input-bg)',
        border: '1px solid var(--bd)',
        color: 'var(--tx-sub)',
      };
  }
}

interface GridProps {
  columns?: number;
  children: React.ReactNode;
  className?: string;
}

const OptionsGrid: React.FC<GridProps> = ({ columns = 2, children, className = '' }) => {
  const colClass = columns === 3 ? 'grid-cols-3' : columns === 4 ? 'grid-cols-4' : 'grid-cols-2';
  return (
    <div className={`grid ${colClass} gap-2.5 mb-6 ${className}`}>
      {children}
    </div>
  );
};

export default OptionsGrid;
