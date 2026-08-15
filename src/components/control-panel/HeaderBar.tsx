import { AddMediaIcon, SettingsIcon } from '../../icons';
import { contrast, fill, fillIcon, ghostIcon, ink, inkHover } from '../../lib/theme';

interface HeaderBarProps {
  playlistName: string;
  onPlaylistNameChange: (name: string) => void;
  onOpenSettings: () => void;
  onAddMedia: () => void;
}

export function HeaderBar({
  playlistName,
  onPlaylistNameChange,
  onOpenSettings,
  onAddMedia,
}: HeaderBarProps) {
  return (
    <header className={`flex shrink-0 items-center gap-3 px-4 py-3 ${contrast}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <h1 className={`shrink-0 text-lg font-bold tracking-tight ${ink.orange}`}>
          Media Share
        </h1>
        <div className="h-6 w-px shrink-0 bg-base-200 dark:bg-base-800" />
        <input
          value={playlistName}
          onChange={(e) => onPlaylistNameChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          aria-label="Playlist name"
          className="min-w-0 flex-1 border-b border-transparent bg-transparent text-base tracking-tight text-base-950 outline-none hover:border-base-300 focus:border-orange-400 dark:text-paper dark:hover:border-base-700 dark:focus:border-orange-600"
        />
      </div>
      <button
        type="button"
        onClick={onOpenSettings}
        aria-label="Settings"
        title="Settings"
        className={`${ghostIcon} ${inkHover.purple}`}
      >
        <SettingsIcon className="size-5" />
      </button>
      <button
        type="button"
        onClick={onAddMedia}
        aria-label="Add media"
        title="Add media"
        className={`${fillIcon} ${fill.blue}`}
      >
        <AddMediaIcon className="size-5" />
      </button>
    </header>
  );
}
