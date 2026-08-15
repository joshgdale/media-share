import { useRef, useState, type DragEvent } from 'react';
import { ImageIcon, VideoIcon } from '../../icons';
import { ink, muted } from '../../lib/theme';
import type { CueItem } from '../../types';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { CUE_DND_TYPE, CueRow } from './CueRow';

interface PlaylistQueueProps {
  cues: CueItem[];
  currentCueId: string | null;
  onCuesChange: (cues: CueItem[]) => void;
  onCueChange: (cue: CueItem) => void;
  onCueDelete: (id: string) => void;
  onTrigger: (id: string) => void;
  onAddPaths: (paths: string[]) => void;
}

function pathFromFile(file: File): string {
  try {
    const fromApi = window.mediaShare.getPathForFile(file);
    if (fromApi) return fromApi;
  } catch {
    // Fall through to the deprecated File.path getter.
  }
  const legacy = (file as File & { path?: string }).path;
  return typeof legacy === 'string' ? legacy : '';
}

function pathsFromDataTransfer(dataTransfer: DataTransfer): string[] {
  const paths: string[] = [];
  for (const file of Array.from(dataTransfer.files)) {
    const filePath = pathFromFile(file);
    if (filePath) paths.push(filePath);
  }
  return paths;
}

function reorderCues(cues: CueItem[], fromId: string, toIndex: number): CueItem[] {
  const fromIndex = cues.findIndex((cue) => cue.id === fromId);
  if (fromIndex < 0) return cues;
  const next = [...cues];
  const [item] = next.splice(fromIndex, 1);
  if (!item) return cues;
  let insertAt = toIndex;
  if (fromIndex < toIndex) insertAt -= 1;
  insertAt = Math.max(0, Math.min(next.length, insertAt));
  if (insertAt === fromIndex) return cues;
  next.splice(insertAt, 0, item);
  return next;
}

export function PlaylistQueue({
  cues,
  currentCueId,
  onCuesChange,
  onCueChange,
  onCueDelete,
  onTrigger,
  onAddPaths,
}: PlaylistQueueProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [fileOver, setFileOver] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CueItem | null>(null);

  function startDrag(id: string): void {
    dragIdRef.current = id;
    setDragId(id);
  }

  function clearDrag(): void {
    dragIdRef.current = null;
    setDragId(null);
    setDropIndex(null);
    setFileOver(false);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    const hasFiles = Array.from(event.dataTransfer.types).includes('Files');
    setFileOver(hasFiles);
    event.dataTransfer.dropEffect = hasFiles ? 'copy' : 'move';
    if (
      !hasFiles &&
      dragIdRef.current &&
      !(event.target instanceof Element && event.target.closest('[data-cue-row]'))
    ) {
      setDropIndex(cues.length);
    }
  }

  function handleRowDragOver(event: DragEvent<HTMLDivElement>, index: number): void {
    event.preventDefault();
    event.stopPropagation();
    const hasFiles = Array.from(event.dataTransfer.types).includes('Files');
    setFileOver(hasFiles);
    event.dataTransfer.dropEffect = hasFiles ? 'copy' : 'move';
    if (hasFiles || !dragIdRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const before = event.clientY < rect.top + rect.height / 2;
    setDropIndex(before ? index : index + 1);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    const filePaths = pathsFromDataTransfer(event.dataTransfer);
    if (filePaths.length > 0) {
      onAddPaths(filePaths);
      clearDrag();
      return;
    }
    const cueId =
      event.dataTransfer.getData(CUE_DND_TYPE) || event.dataTransfer.getData('text/plain');
    if (cueId) {
      const target = dropIndex ?? cues.length;
      const next = reorderCues(cues, cueId, target);
      if (next !== cues) onCuesChange(next);
    }
    clearDrag();
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>): void {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setFileOver(false);
    if (!dragId) setDropIndex(null);
  }

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${
        fileOver ? 'ring-1 ring-inset ring-cyan-400 dark:ring-cyan-600' : ''
      }`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      {cues.length === 0 ? (
        <div className={`flex h-full flex-col items-center justify-center gap-3 ${muted}`}>
          <div className="flex items-center gap-2">
            <VideoIcon className={`size-8 ${ink.blue}`} />
            <ImageIcon className={`size-8 ${ink.magenta}`} />
          </div>
          <p className="text-sm tracking-tight">Drop video, image, or playlist files here</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {cues.map((cue, index) => (
            <div key={cue.id}>
              {dragId && dropIndex === index ? (
                <div className="h-0.5 bg-cyan-400 dark:bg-cyan-600" />
              ) : null}
              <CueRow
                cue={cue}
                active={currentCueId === cue.id}
                dragging={dragId === cue.id}
                onChange={onCueChange}
                onRequestDelete={() => setPendingDelete(cue)}
                onTrigger={() => onTrigger(cue.id)}
                onDragStart={startDrag}
                onDragOver={(event) => handleRowDragOver(event, index)}
                onDragEnd={clearDrag}
              />
            </div>
          ))}
          {dragId && dropIndex === cues.length ? (
            <div className="h-0.5 bg-cyan-400 dark:bg-cyan-600" />
          ) : null}
        </div>
      )}
      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title={pendingDelete?.title ?? ''}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) onCueDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
