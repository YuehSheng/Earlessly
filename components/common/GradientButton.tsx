
import React from 'react';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
}

const sizeClass: Record<NonNullable<Props['size']>, string> = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-base',
};

// Single source of truth for the warm-gradient CTA that previously appeared
// inline (`linear-gradient(135deg,var(--primary),var(--accent))`) across
// half a dozen training components.
const GradientButton: React.FC<Props> = ({
  size = 'md',
  className = '',
  children,
  ...rest
}) => (
  <button
    {...rest}
    className={`btn-gradient flex items-center justify-center gap-2 ${sizeClass[size]} ${className}`}
  >
    {children}
  </button>
);

export default GradientButton;
