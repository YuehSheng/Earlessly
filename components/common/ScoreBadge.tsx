
import React from 'react';

interface Props {
  correct: number;
  total: number;
  showZero?: boolean;
}

// Right-aligned correct/total counter used by every ear-training sub-mode.
const ScoreBadge: React.FC<Props> = ({ correct, total, showZero = false }) => {
  if (!showZero && total === 0) return null;
  return (
    <div className="text-right">
      <span className="text-lg font-black" style={{ color: 'var(--primary)' }}>{correct}</span>
      <span className="text-tx-muted mx-1 font-bold">/</span>
      <span className="text-tx-sub font-bold">{total}</span>
    </div>
  );
};

export default ScoreBadge;
