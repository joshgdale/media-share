import {
  DEFAULT_BLANK_TEXT_SIZE,
  DEFAULT_SETTINGS,
  type AppSettings,
  type BlankType,
} from '../types';

export const MIN_BLANK_TEXT_SIZE = 1;
export const MAX_BLANK_TEXT_SIZE = 12;

const BLANK_TYPES = new Set<BlankType>(['color', 'custom_image', 'text']);

type SettingsInput = Partial<AppSettings> & { blankTextSizeRem?: number };

export function clampBlankTextSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BLANK_TEXT_SIZE;
  return Math.min(
    MAX_BLANK_TEXT_SIZE,
    Math.max(MIN_BLANK_TEXT_SIZE, Math.round(value * 100) / 100),
  );
}

function readBlankTextSize(data: SettingsInput): number {
  if (typeof data.blankTextSize === 'number') {
    return clampBlankTextSize(data.blankTextSize);
  }
  if (typeof data.blankTextSizeRem === 'number') {
    return clampBlankTextSize(data.blankTextSizeRem);
  }
  return DEFAULT_SETTINGS.blankTextSize;
}

export function normalizeSettings(raw: unknown): AppSettings | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const data = raw as SettingsInput;
  const blankType = BLANK_TYPES.has(data.defaultBlankType as BlankType)
    ? (data.defaultBlankType as BlankType)
    : DEFAULT_SETTINGS.defaultBlankType;

  return {
    defaultBlankType: blankType,
    defaultBlankColor:
      typeof data.defaultBlankColor === 'string'
        ? data.defaultBlankColor
        : DEFAULT_SETTINGS.defaultBlankColor,
    customBlankSrc:
      typeof data.customBlankSrc === 'string' ? data.customBlankSrc : undefined,
    blankText: typeof data.blankText === 'string' ? data.blankText : DEFAULT_SETTINGS.blankText,
    blankTextSize: readBlankTextSize(data),
  };
}
