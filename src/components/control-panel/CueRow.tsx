import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { GripIcon, MoreIcon, TrashIcon, TriggerIcon, VideoIcon } from '../../icons';
import {
  clampImageDuration,
  formatTimecode,
  parseDurationInput,
  toMediaUrl,
} from '../../lib/media';
import { fill, ink, inkHover, menu } from '../../lib/theme';
import { DEFAULT_IMAGE_DURATION, type CueItem, type EndAction } from '../../types';
import { EndActionPicker } from './EndActionPicker';

export const CUE_DND_TYPE = 'application/x-media-share-cue';

interface CueRowProps {
  cue: CueItem;
  active: boolean;
  dragging: boolean;
  onChange: (cue: CueItem) => void;
  onRequestDelete: () => void;
  onTrigger: () => void;
  onDragStart: (cueId: string) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

export function CueRow({
  cue,
  active,
  dragging,
  onChange,
  onRequestDelete,
  onTrigger,
  onDragStart,
  onDragOver,
  onDragEnd,
}: CueRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cue.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const timedImage = cue.type === 'image' && cue.endAction !== 'freeze';
  const [editingDuration, setEditingDuration] = useState(false);
  const durationRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setDraft(cue.title);
  }, [cue.title]);

  useEffect(() => {
    if (!timedImage) setEditingDuration(false);
  }, [timedImage]);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  useEffect(() => {
    if (!editingDuration) return;
    const el = durationRef.current;
    if (!el) return;
    el.textContent = formatTimecode(cue.duration ?? DEFAULT_IMAGE_DURATION);
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editingDuration, cue.duration]);

  function commitTitle(): void {
    const next = draft.trim();
    if (next && next !== cue.title) {
      onChange({ ...cue, title: next });
    } else {
      setDraft(cue.title);
    }
    setEditing(false);
  }

  function handleGripDragStart(event: DragEvent<HTMLDivElement>): void {
    event.dataTransfer.setData(CUE_DND_TYPE, cue.id);
    event.dataTransfer.setData('text/plain', cue.id);
    event.dataTransfer.effectAllowed = 'move';
    const row = event.currentTarget.closest('[data-cue-row]');
    if (row instanceof HTMLElement) {
      event.dataTransfer.setDragImage(row, 24, 20);
    }
    onDragStart(cue.id);
  }

  function commitDuration(): void {
    const parsed = parseDurationInput(durationRef.current?.textContent ?? '');
    if (parsed != null) {
      const next = clampImageDuration(parsed);
      if (next !== cue.duration) {
        onChange({ ...cue, duration: next });
      }
    }
    setEditingDuration(false);
  }

  function beginDurationEdit(): void {
    if (!timedImage || editingDuration) return;
    setEditing(false);
    setEditingDuration(true);
  }

  function handleEndActionChange(endAction: EndAction): void {
    onChange({
      ...cue,
      endAction,
      duration:
        cue.type === 'image' && endAction !== 'freeze'
          ? (cue.duration ?? DEFAULT_IMAGE_DURATION)
          : cue.duration,
    });
  }

  const durationLabel =
    cue.type === 'video'
      ? formatTimecode(cue.duration ?? 0)
      : timedImage
        ? formatTimecode(cue.duration ?? DEFAULT_IMAGE_DURATION)
        : 'Hold';
  const iconBtn = `inline-flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
    active
      ? 'hover:bg-green-400/20 dark:hover:bg-green-600/20'
      : 'hover:bg-base-150 dark:hover:bg-base-850'
  }`;

  return (
    <div
      data-cue-row
      data-cue-id={cue.id}
      onDragOver={onDragOver}
      className={`group flex w-full items-center gap-3 px-3 py-2.5 transition-colors duration-150 ${
        active
          ? 'bg-base-100 text-base-950 shadow-[inset_3px_0_0_var(--color-green-400)] dark:bg-base-900 dark:text-paper dark:shadow-[inset_3px_0_0_var(--color-green-600)]'
          : 'hover:bg-base-100 dark:hover:bg-base-900'
      } ${dragging ? 'opacity-40' : ''}`}
    >
      <div
        draggable
        onDragStart={handleGripDragStart}
        onDragEnd={onDragEnd}
        aria-label="Reorder cue"
        title="Drag to reorder"
        className="flex cursor-grab items-center self-stretch px-1 text-current opacity-60 hover:opacity-100 active:cursor-grabbing"
      >
        <GripIcon className="size-5" />
      </div>
      {cue.type === 'image' ? (
        <img
          src={toMediaUrl(cue.src)}
          alt=""
          draggable={false}
          className="size-12 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-lg bg-blue-400/15 dark:bg-blue-600/20 ${ink.blue}`}>
          <VideoIcon className="size-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitTitle();
              }
              if (e.key === 'Escape') {
                setDraft(cue.title);
                setEditing(false);
              }
            }}
            className="w-full border-b border-green-400 bg-transparent text-base tracking-tight outline-none dark:border-green-600"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditingDuration(false);
              setEditing(true);
            }}
            title={cue.title}
            className="block w-full truncate text-left text-base font-medium tracking-tight"
          >
            {cue.title}
          </button>
        )}
      </div>
      <span
        ref={durationRef}
        contentEditable={editingDuration}
        suppressContentEditableWarning
        aria-label={timedImage ? 'Image duration' : undefined}
        onClick={beginDurationEdit}
        onBlur={() => {
          if (editingDuration) commitDuration();
        }}
        onKeyDown={(e) => {
          if (!editingDuration) return;
          if (e.key === 'Enter') {
            e.preventDefault();
            commitDuration();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            setEditingDuration(false);
          }
        }}
        className="w-14 shrink-0 text-right font-mono text-xs tabular-nums tracking-tight opacity-80 outline-none"
      >
        {editingDuration ? null : durationLabel}
      </span>
      <EndActionPicker
        type={cue.type}
        value={cue.endAction}
        active={active}
        onChange={handleEndActionChange}
      />
      <button
        type="button"
        aria-label="Trigger cue"
        title="Trigger"
        onClick={onTrigger}
        className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors ${fill.green}`}
      >
        <TriggerIcon className="size-5" />
      </button>
      <Menu>
        <MenuButton aria-label="Cue actions" title="More" className={iconBtn}>
          <MoreIcon className="size-5" />
        </MenuButton>
        <MenuItems anchor="bottom end" className={`w-40 origin-top-right ${menu}`}>
          <MenuItem>
            <button
              type="button"
              onClick={onRequestDelete}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm tracking-tight data-focus:bg-red-400/15 dark:data-focus:bg-red-600/20 ${inkHover.red}`}
            >
              <TrashIcon className="size-4" />
              Delete
            </button>
          </MenuItem>
        </MenuItems>
      </Menu>
    </div>
  );
}
