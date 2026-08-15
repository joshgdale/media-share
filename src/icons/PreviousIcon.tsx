import type { IconProps } from './types';

export function PreviousIcon({ size = 24, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <polygon points="19 4 9 12 19 20" />
      <line x1="5" y1="5" x2="5" y2="19" />
    </svg>
  );
}
