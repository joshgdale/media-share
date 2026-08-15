import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, type MediaType } from '../types';

export function toMediaUrl(filePath: string): string {
  return `media-share://local/?p=${encodeURIComponent(filePath)}`;
}

export function extensionOf(filePath: string): string {
  const base = filePath.split(/[/\\]/).pop() ?? filePath;
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
}

export function mediaTypeFromPath(filePath: string): MediaType | null {
  const ext = extensionOf(filePath);
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  return null;
}

export function titleFromPath(filePath: string): string {
  const base = filePath.split(/[/\\]/).pop() ?? filePath;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

export const MIN_IMAGE_DURATION = 0.5;
export const MAX_IMAGE_DURATION = 60 * 60;

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function parseDurationInput(value: string): number | null {
  const trimmed = value.trim().replace(/s$/i, '');
  if (!trimmed) return null;

  const colon = trimmed.split(':');
  if (colon.length === 2 || colon.length === 3) {
    const parts = colon.map((part) => Number(part));
    if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
    return parts.reduce((total, part) => total * 60 + part, 0);
  }

  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function clampImageDuration(seconds: number): number {
  return Math.min(MAX_IMAGE_DURATION, Math.max(MIN_IMAGE_DURATION, seconds));
}

export function getVideoDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      cleanup();
      resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      resolve(0);
    };
    video.src = url;
  });
}
