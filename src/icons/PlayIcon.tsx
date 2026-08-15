import type { IconProps } from './types';

export function PlayIcon({ size = 24, className = '', ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <polygon points="6 3 21 12 6 21" />
    </svg>
  );
}
