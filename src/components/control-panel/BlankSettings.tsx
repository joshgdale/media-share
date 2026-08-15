import { ImageIcon } from '../../icons';
import { fill, inkHover, muted } from '../../lib/theme';
import {
  clampBlankTextSize,
  MAX_BLANK_TEXT_SIZE,
  MIN_BLANK_TEXT_SIZE,
} from '../../lib/settings';
import {
  DEFAULT_BLANK_TEXT_SIZE,
  type AppSettings,
  type BlankType,
} from '../../types';

interface BlankSettingsProps {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
}

function filenameFromPath(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? filePath;
}

const selected =
  `rounded-lg px-3 py-1.5 text-xs font-semibold tracking-tight transition-colors ${fill.cyan}`;
const idle =
  `rounded-lg px-3 py-1.5 text-xs font-medium tracking-tight transition-colors ${muted} hover:text-cyan-400 dark:hover:text-cyan-600`;

const BLANK_OPTIONS: { type: BlankType; label: string }[] = [
  { type: 'color', label: 'Solid black' },
  { type: 'custom_image', label: 'Custom still' },
  { type: 'text', label: 'Text' },
];

export function BlankSettings({ settings, onChange }: BlankSettingsProps) {
  const blankType = settings.defaultBlankType;
  const textSize = settings.blankTextSize;
  const atDefaultSize = textSize === DEFAULT_BLANK_TEXT_SIZE;

  async function pickImage(): Promise<void> {
    const src = await window.mediaShare.pickBlankImage();
    if (!src) return;
    onChange({
      ...settings,
      defaultBlankType: 'custom_image',
      customBlankSrc: src,
    });
  }

  function setBlankType(type: BlankType): void {
    onChange({
      ...settings,
      defaultBlankType: type,
      ...(type === 'color' ? { defaultBlankColor: '#000000' } : {}),
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex rounded-xl bg-paper p-0.5 dark:bg-black">
        {BLANK_OPTIONS.map((option) => (
          <button
            key={option.type}
            type="button"
            onClick={() => setBlankType(option.type)}
            className={`min-w-0 flex-1 whitespace-nowrap ${blankType === option.type ? selected : idle}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {blankType === 'custom_image' ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void pickImage()}
            className={`inline-flex items-center gap-2 rounded-xl bg-paper px-3 py-2 text-sm font-medium tracking-tight transition-colors hover:bg-base-50 dark:bg-black dark:hover:bg-base-950 ${inkHover.magenta}`}
          >
            <ImageIcon className="size-4" />
            Choose image
          </button>
          {settings.customBlankSrc ? (
            <span
              className={`min-w-0 truncate text-[11px] tracking-tight ${muted}`}
              title={settings.customBlankSrc}
            >
              {filenameFromPath(settings.customBlankSrc)}
            </span>
          ) : null}
        </div>
      ) : null}
      {blankType === 'text' ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={settings.blankText}
            rows={4}
            spellCheck={false}
            placeholder="Standby message"
            aria-label="Standby text"
            onChange={(event) =>
              onChange({
                ...settings,
                blankText: event.target.value,
              })
            }
            className="w-full resize-none rounded-xl bg-paper px-3 py-2 text-sm tracking-tight text-base-950 outline-none placeholder:text-base-400 dark:bg-black dark:text-paper dark:placeholder:text-base-500"
          />
          <div className="flex items-center gap-2">
            <label
              htmlFor="blank-text-size"
              className={`text-[11px] font-semibold tracking-[0.14em] uppercase ${muted}`}
            >
              Size
            </label>
            <input
              id="blank-text-size"
              type="number"
              min={MIN_BLANK_TEXT_SIZE}
              max={MAX_BLANK_TEXT_SIZE}
              step={0.25}
              value={textSize}
              aria-label="Standby text size in vmin"
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) return;
                onChange({
                  ...settings,
                  blankTextSize: clampBlankTextSize(next),
                });
              }}
              className="w-16 rounded-lg bg-paper px-2 py-1.5 text-sm tabular-nums tracking-tight text-base-950 outline-none dark:bg-black dark:text-paper"
            />
            <button
              type="button"
              disabled={atDefaultSize}
              onClick={() =>
                onChange({
                  ...settings,
                  blankTextSize: DEFAULT_BLANK_TEXT_SIZE,
                })
              }
              className={`ml-auto rounded-lg px-3 py-1.5 text-xs font-medium tracking-tight transition-colors disabled:pointer-events-none disabled:opacity-40 ${muted} hover:text-cyan-400 dark:hover:text-cyan-600`}
            >
              Reset
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
