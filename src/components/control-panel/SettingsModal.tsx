import { useState } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { ExportIcon, ImportIcon } from '../../icons';
import { parsePlaylistFile, type ParsedPlaylistFile } from '../../lib/playlist-file';
import { inkHover, muted, overlay } from '../../lib/theme';
import type { AppSettings, PlaylistData } from '../../types';
import { BlankSettings } from './BlankSettings';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  playlist: PlaylistData;
  onImported: (imported: ParsedPlaylistFile) => void | Promise<void>;
  onImportFailed: () => void;
}

const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-paper px-3.5 py-2.5 text-sm font-medium tracking-tight transition-colors hover:bg-base-50 dark:bg-black dark:hover:bg-base-950';

export function SettingsModal({
  open,
  onClose,
  settings,
  onSettingsChange,
  playlist,
  onImported,
  onImportFailed,
}: SettingsModalProps) {
  const [importing, setImporting] = useState(false);

  async function handleImport(): Promise<void> {
    setImporting(true);
    try {
      const raw = await window.mediaShare.importPlaylist();
      if (!raw) return;
      const imported = parsePlaylistFile(raw);
      if (!imported) {
        onImportFailed();
        return;
      }
      await onImported(imported);
    } finally {
      setImporting(false);
    }
  }

  function handleExport(): void {
    void window.mediaShare.exportPlaylist(playlist, settings);
  }

  return (
    <Dialog open={open} onClose={onClose} transition className="relative z-50">
      <DialogBackdrop
        transition
        className={`fixed inset-0 transition data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in ${overlay}`}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="w-full max-w-md rounded-2xl bg-base-100 p-4 shadow-2xl transition data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in dark:bg-base-900"
        >
          <DialogTitle className="text-base font-bold tracking-tight text-base-950 dark:text-paper">
            Settings
          </DialogTitle>

          <section className="mt-4">
            <h3 className={`text-[11px] font-semibold tracking-[0.14em] uppercase ${muted}`}>
              Playlist
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={importing}
                className={`${btnSecondary} ${inkHover.cyan} disabled:opacity-60`}
              >
                <ImportIcon className="size-5" />
                {importing ? 'Opening…' : 'Open'}
              </button>
              <button type="button" onClick={handleExport} className={`${btnSecondary} ${inkHover.orange}`}>
                <ExportIcon className="size-5" />
                Save
              </button>
            </div>
          </section>

          <section className="mt-5">
            <h3 className={`text-[11px] font-semibold tracking-[0.14em] uppercase ${muted}`}>
              Standby / Blank
            </h3>
            <div className="mt-2">
              <BlankSettings settings={settings} onChange={onSettingsChange} />
            </div>
          </section>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
