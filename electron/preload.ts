import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { AppSettings, PlaylistData, QuitEvent } from '../src/types';

const api = {
  getPathForFile: (file: File): string => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  },
  pickMediaFiles: (): Promise<string[]> => ipcRenderer.invoke('media:pick-files'),
  pickBlankImage: (): Promise<string | null> => ipcRenderer.invoke('media:pick-blank-image'),
  exportPlaylist: (playlist: PlaylistData, settings: AppSettings): Promise<boolean> =>
    ipcRenderer.invoke('playlist:export', playlist, settings),
  importPlaylist: (): Promise<unknown> => ipcRenderer.invoke('playlist:import'),
  readPlaylistFile: (filePath: string): Promise<unknown> =>
    ipcRenderer.invoke('playlist:read-file', filePath),
  onPlaylistOpened: (callback: (data: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown) => {
      callback(data);
    };
    ipcRenderer.on('playlist:opened', listener);
    return () => {
      ipcRenderer.removeListener('playlist:opened', listener);
    };
  },
  loadPersisted: (): Promise<{ settings: AppSettings; openedPlaylist: unknown | null }> =>
    ipcRenderer.invoke('persist:load'),
  saveSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke('persist:save-settings', settings),
  revealPlayer: (): Promise<void> => ipcRenderer.invoke('player:reveal'),
  startPlayerResize: (edge: string): void => ipcRenderer.send('player:resize-start', edge),
  endPlayerResize: (): void => ipcRenderer.send('player:resize-end'),
  confirmQuit: (): void => ipcRenderer.send('app:quit-confirm'),
  cancelQuit: (): void => ipcRenderer.send('app:quit-cancel'),
  onQuitEvent: (callback: (event: QuitEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: QuitEvent) => {
      callback(data);
    };
    ipcRenderer.on('app:quit-event', listener);
    return () => {
      ipcRenderer.removeListener('app:quit-event', listener);
    };
  },
};

contextBridge.exposeInMainWorld('mediaShare', api);

export type MediaShareAPI = typeof api;
