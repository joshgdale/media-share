import type { IconProps } from './types';

export function ContinueIcon({ size = 24, className = '', ...props }: IconProps) {
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
      <polygon points="4 5 14 12 4 19" fill="currentColor" stroke="none" />
      <polygon points="12 5 22 12 12 19" fill="currentColor" stroke="none" />
    </svg>
  );
}
