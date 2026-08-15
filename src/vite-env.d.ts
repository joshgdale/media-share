/// <reference types="vite/client" />

import type { AppSettings, PlaylistData, QuitEvent } from './types';

interface MediaShareAPI {
  getPathForFile: (file: File) => string;
  pickMediaFiles: () => Promise<string[]>;
  pickBlankImage: () => Promise<string | null>;
  exportPlaylist: (playlist: PlaylistData, settings: AppSettings) => Promise<boolean>;
  importPlaylist: () => Promise<unknown>;
  readPlaylistFile: (filePath: string) => Promise<unknown>;
  onPlaylistOpened: (callback: (data: unknown) => void) => () => void;
  loadPersisted: () => Promise<{ settings: AppSettings; openedPlaylist: unknown | null }>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  revealPlayer: () => Promise<void>;
  startPlayerResize: (edge: string) => void;
  endPlayerResize: () => void;
  confirmQuit: () => void;
  cancelQuit: () => void;
  onQuitEvent: (callback: (event: QuitEvent) => void) => () => void;
}

declare global {
  interface Window {
    mediaShare: MediaShareAPI;
  }
}

export {};
