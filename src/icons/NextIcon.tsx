import type { IconProps } from './types';

export function NextIcon({ size = 24, className = '', ...props }: IconProps) {
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
      <polygon points="5 4 15 12 5 20" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  );
}
