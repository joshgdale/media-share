import { useEffect, useState } from 'react';
import { useBroadcastChannel } from '../../hooks/useBroadcastChannel';
import {
  isPlaylistFilePath,
  parsePlaylistFile,
  type ParsedPlaylistFile,
} from '../../lib/playlist-file';
import { defaultEndAction, normalizeCues } from '../../lib/cues';
import { createId } from '../../lib/id';
import { getVideoDuration, mediaTypeFromPath, titleFromPath, toMediaUrl } from '../../lib/media';
import { appShell } from '../../lib/theme';
import {
  DEFAULT_IMAGE_DURATION,
  DEFAULT_PLAYLIST,
  DEFAULT_PLAYER_STATE,
  DEFAULT_SETTINGS,
  type AppSettings,
  type CueItem,
  type PlaylistData,
  type PlayerState,
  type SyncMessage,
  type TransportCommand,
} from '../../types';
import { HeaderBar } from './HeaderBar';
import { PlaylistQueue } from './PlaylistQueue';
import { QuitConfirmDialog } from './QuitConfirmDialog';
import { SettingsModal } from './SettingsModal';
import { TransportBar } from './TransportBar';

export function ControlPanel() {
  const [playlist, setPlaylist] = useState<PlaylistData>(DEFAULT_PLAYLIST);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [playerState, setPlayerState] = useState<PlayerState>(DEFAULT_PLAYER_STATE);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const post = useBroadcastChannel((message: SyncMessage) => {
    switch (message.type) {
      case 'playerState':
        setPlayerState(message.state);
        break;
      case 'hello':
      case 'requestState':
        post({ type: 'playlist', playlist });
        post({ type: 'settings', settings });
        break;
      default:
        break;
    }
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const persisted = await window.mediaShare.loadPersisted();
        if (cancelled) return;
        const opened = parsePlaylistFile(persisted.openedPlaylist);
        const nextPlaylist = opened
          ? { ...opened.playlist, cues: normalizeCues(opened.playlist.cues) }
          : DEFAULT_PLAYLIST;
        const nextSettings = opened?.settings ?? persisted.settings;
        setPlaylist(nextPlaylist);
        setSettings(nextSettings);
        post({ type: 'playlist', playlist: nextPlaylist });
        post({ type: 'settings', settings: nextSettings });
        post({ type: 'requestState' });
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [post]);

  useEffect(() => {
    return window.mediaShare.onPlaylistOpened((raw) => {
      const imported = parsePlaylistFile(raw);
      if (!imported) return;
      setPlaylist({
        ...imported.playlist,
        cues: normalizeCues(imported.playlist.cues),
      });
      if (imported.settings) setSettings(imported.settings);
      setSettingsOpen(false);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    post({ type: 'playlist', playlist });
  }, [playlist, ready, post]);

  useEffect(() => {
    if (!ready) return;
    post({ type: 'settings', settings });
    const timer = window.setTimeout(() => {
      void window.mediaShare.saveSettings(settings);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [settings, ready, post]);

  async function addMediaFromPaths(paths: string[]): Promise<void> {
    let playlistPath: string | undefined;
    for (const filePath of paths) {
      if (isPlaylistFilePath(filePath)) playlistPath = filePath;
    }
    if (playlistPath) {
      const imported = parsePlaylistFile(await window.mediaShare.readPlaylistFile(playlistPath));
      if (imported) handleImported(imported);
      return;
    }

    const created = await Promise.all(
      paths.map(async (src): Promise<CueItem | null> => {
        const type = mediaTypeFromPath(src);
        if (!type) return null;
        const duration =
          type === 'image' ? DEFAULT_IMAGE_DURATION : await getVideoDuration(toMediaUrl(src));
        return {
          id: createId(),
          type,
          title: titleFromPath(src),
          src,
          endAction: defaultEndAction(type),
          duration,
        };
      }),
    );
    const cues = created.filter((cue): cue is CueItem => cue !== null);
    if (cues.length === 0) return;
    setPlaylist((prev) => ({ ...prev, cues: [...prev.cues, ...cues] }));
  }

  async function handleAddMedia(): Promise<void> {
    const paths = await window.mediaShare.pickMediaFiles();
    await addMediaFromPaths(paths);
  }

  function handleImported(imported: ParsedPlaylistFile): void {
    setPlaylist({
      ...imported.playlist,
      cues: normalizeCues(imported.playlist.cues),
    });
    if (imported.settings) {
      setSettings(imported.settings);
    }
    setSettingsOpen(false);
  }

  function handleCommand(command: TransportCommand): void {
    void window.mediaShare.revealPlayer();
    post({ type: 'transport', command });
  }

  return (
    <div className={`flex h-dvh min-h-0 flex-col overflow-hidden ${appShell}`}>
      <HeaderBar
        playlistName={playlist.name}
        onPlaylistNameChange={(name) => setPlaylist((prev) => ({ ...prev, name }))}
        onOpenSettings={() => setSettingsOpen(true)}
        onAddMedia={() => void handleAddMedia()}
      />
      <PlaylistQueue
        cues={playlist.cues}
        currentCueId={playerState.currentCueId}
        onCuesChange={(cues) => setPlaylist((prev) => ({ ...prev, cues }))}
        onCueChange={(cue) =>
          setPlaylist((prev) => ({
            ...prev,
            cues: prev.cues.map((item) => (item.id === cue.id ? cue : item)),
          }))
        }
        onCueDelete={(id) =>
          setPlaylist((prev) => ({
            ...prev,
            cues: prev.cues.filter((item) => item.id !== id),
          }))
        }
        onTrigger={(cueId) => {
          void window.mediaShare.revealPlayer();
          post({ type: 'triggerCue', cueId });
        }}
        onAddPaths={(paths) => void addMediaFromPaths(paths)}
      />
      <TransportBar playerState={playerState} onCommand={handleCommand} />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
        playlist={playlist}
        onImported={handleImported}
      />
      <QuitConfirmDialog />
    </div>
  );
}
