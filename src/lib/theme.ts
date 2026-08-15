/** Flexoki accents: light 400 (hover 600), dark 600 (hover 400). */

export const fill = {
  green:
    'bg-green-400 text-paper hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-400',
  red: 'bg-red-400 text-paper hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-400',
  yellow:
    'bg-yellow-400 text-base-950 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-400',
  orange:
    'bg-orange-400 text-paper hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-400',
  cyan: 'bg-cyan-400 text-paper hover:bg-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-400',
  blue: 'bg-blue-400 text-paper hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-400',
  purple:
    'bg-purple-400 text-paper hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-400',
  magenta:
    'bg-magenta-400 text-paper hover:bg-magenta-600 dark:bg-magenta-600 dark:hover:bg-magenta-400',
} as const;

export const ink = {
  green: 'text-green-400 dark:text-green-600',
  red: 'text-red-400 dark:text-red-600',
  yellow: 'text-yellow-400 dark:text-yellow-600',
  orange: 'text-orange-400 dark:text-orange-600',
  cyan: 'text-cyan-400 dark:text-cyan-600',
  blue: 'text-blue-400 dark:text-blue-600',
  purple: 'text-purple-400 dark:text-purple-600',
  magenta: 'text-magenta-400 dark:text-magenta-600',
} as const;

export const inkHover = {
  green:
    'text-green-400 hover:text-green-600 dark:text-green-600 dark:hover:text-green-400',
  red: 'text-red-400 hover:text-red-600 dark:text-red-600 dark:hover:text-red-400',
  yellow:
    'text-yellow-400 hover:text-yellow-600 dark:text-yellow-600 dark:hover:text-yellow-400',
  orange:
    'text-orange-400 hover:text-orange-600 dark:text-orange-600 dark:hover:text-orange-400',
  cyan: 'text-cyan-400 hover:text-cyan-600 dark:text-cyan-600 dark:hover:text-cyan-400',
  blue: 'text-blue-400 hover:text-blue-600 dark:text-blue-600 dark:hover:text-blue-400',
  purple:
    'text-purple-400 hover:text-purple-600 dark:text-purple-600 dark:hover:text-purple-400',
  magenta:
    'text-magenta-400 hover:text-magenta-600 dark:text-magenta-600 dark:hover:text-magenta-400',
} as const;

export const appShell = 'bg-paper text-base-950 dark:bg-black dark:text-paper';
export const contrast = 'bg-base-100 dark:bg-base-900';
export const muted = 'text-base-500 dark:text-base-400';
export const overlay = 'bg-black/45';
export const menu =
  'z-50 rounded-xl bg-base-100 p-1 shadow-lg outline-none dark:bg-base-900';
export const ghostIcon =
  'inline-flex size-10 items-center justify-center rounded-xl transition-colors hover:bg-base-150 dark:hover:bg-base-850';
export const fillIcon =
  'inline-flex size-10 items-center justify-center rounded-xl transition-colors';
