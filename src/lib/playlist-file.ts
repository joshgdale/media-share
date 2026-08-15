import {
  DEFAULT_PLAYLIST,
  type AppSettings,
  type CueItem,
  type PlaylistData,
} from '../types';
import { normalizeSettings } from './settings';

export const PLAYLIST_EXTENSION = 'msplaylist';

export const PLAYLIST_OPEN_EXTENSIONS = [PLAYLIST_EXTENSION, 'json'] as const;

export const PLAYLIST_DIALOG_FILTERS = [
  { name: 'Media Share Playlist', extensions: [PLAYLIST_EXTENSION] },
  { name: 'JSON', extensions: ['json'] },
];

export interface ParsedPlaylistFile {
  playlist: PlaylistData;
  settings?: AppSettings;
}

export function isPlaylistFilePath(filePath: string): boolean {
  const base = filePath.split(/[/\\]/).pop() ?? filePath;
  const dot = base.lastIndexOf('.');
  const ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
  return (PLAYLIST_OPEN_EXTENSIONS as readonly string[]).includes(ext);
}

export function playlistSaveFileName(name: string): string {
  const base = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim() || 'playlist';
  return `${base}.${PLAYLIST_EXTENSION}`;
}

function playlistFromUnknown(raw: Record<string, unknown>): PlaylistData | null {
  if (!Array.isArray(raw.cues)) return null;
  return {
    version: typeof raw.version === 'string' ? raw.version : DEFAULT_PLAYLIST.version,
    name: typeof raw.name === 'string' ? raw.name : DEFAULT_PLAYLIST.name,
    cues: raw.cues as CueItem[],
  };
}

export function parsePlaylistFile(raw: unknown): ParsedPlaylistFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  const nested = data.playlist;
  if (nested && typeof nested === 'object') {
    const playlist = playlistFromUnknown(nested as Record<string, unknown>);
    if (playlist) {
      const settings = normalizeSettings(data.settings);
      return settings ? { playlist, settings } : { playlist };
    }
  }

  const playlist = playlistFromUnknown(data);
  if (!playlist) return null;
  const settings = normalizeSettings(data.settings);
  return settings ? { playlist, settings } : { playlist };
}
