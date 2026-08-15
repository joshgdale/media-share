import type { IconProps } from './types';

export function VideoIcon({ size = 24, className = '', ...props }: IconProps) {
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
      <rect x="2" y="6" width="14" height="12" />
      <polygon points="16 10 22 7 22 17 16 14" />
    </svg>
  );
}
