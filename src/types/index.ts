export type MediaType = 'video' | 'image';
export type EndAction = 'continue' | 'stop' | 'freeze';

export interface CueItem {
  id: string;
  type: MediaType;
  title: string;
  src: string;
  endAction: EndAction;
  duration?: number;
}

export interface PlaylistData {
  version: string;
  name: string;
  cues: CueItem[];
}

export type BlankType = 'color' | 'custom_image' | 'text';

export interface AppSettings {
  defaultBlankType: BlankType;
  defaultBlankColor: string;
  customBlankSrc?: string;
  blankText: string;
  blankTextSize: number;
}

export type TransportCommand =
  | { action: 'play' }
  | { action: 'pause' }
  | { action: 'seek'; time: number }
  | { action: 'scrubStart' }
  | { action: 'scrub'; time: number }
  | { action: 'scrubEnd'; time: number }
  | { action: 'volume'; value: number }
  | { action: 'stop' }
  | { action: 'next' }
  | { action: 'previous' };

export type PlayerStatus = 'blank' | 'video' | 'image';

export interface PlayerState {
  status: PlayerStatus;
  currentCueId: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  remaining: number | null;
}

export const CHANNEL_NAME = 'media-share-sync';

export type SyncMessage =
  | { type: 'hello' }
  | { type: 'playlist'; playlist: PlaylistData }
  | { type: 'settings'; settings: AppSettings }
  | { type: 'triggerCue'; cueId: string }
  | { type: 'transport'; command: TransportCommand }
  | { type: 'playerState'; state: PlayerState }
  | { type: 'requestState' };

export const QUIT_HOLD_MS = 1000;

export type QuitEvent =
  | { type: 'prompt'; hold: boolean; durationMs: number }
  | { type: 'hold-start'; durationMs: number }
  | { type: 'hold-stop' };

export const DEFAULT_IMAGE_DURATION = 5;

export const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'mov',
  'webm',
  'mkv',
  'm4v',
  'avi',
]);

export const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
]);

export const DEFAULT_PLAYER_STATE: PlayerState = {
  status: 'blank',
  currentCueId: null,
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  remaining: null,
};

export const DEFAULT_BLANK_TEXT_SIZE = 6;

export const DEFAULT_SETTINGS: AppSettings = {
  defaultBlankType: 'color',
  defaultBlankColor: '#000000',
  blankText: '',
  blankTextSize: DEFAULT_BLANK_TEXT_SIZE,
};

export const DEFAULT_PLAYLIST: PlaylistData = {
  version: '1.0.0',
  name: 'Untitled Playlist',
  cues: [],
};
