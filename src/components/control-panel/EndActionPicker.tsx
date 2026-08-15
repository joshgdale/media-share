import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { ChevronDownIcon, ContinueIcon, FreezeIcon, StopIcon } from '../../icons';
import { allowedEndActions } from '../../lib/cues';
import { ink, menu } from '../../lib/theme';
import type { EndAction, MediaType } from '../../types';

interface EndActionPickerProps {
  type: MediaType;
  value: EndAction;
  active: boolean;
  onChange: (value: EndAction) => void;
}

const ACTION_META: Record<
  EndAction,
  { label: string; icon: typeof ContinueIcon; color: string }
> = {
  continue: { label: 'Continue', icon: ContinueIcon, color: ink.cyan },
  stop: { label: 'Stop', icon: StopIcon, color: ink.red },
  freeze: { label: 'Freeze', icon: FreezeIcon, color: ink.yellow },
};

export function EndActionPicker({ type, value, active, onChange }: EndActionPickerProps) {
  const resolved = type === 'video' && value === 'freeze' ? 'continue' : value;
  const options = allowedEndActions(type);
  const current = ACTION_META[resolved];
  const CurrentIcon = current.icon;

  return (
    <Listbox value={resolved} onChange={onChange}>
      <div className="relative">
        <ListboxButton
          aria-label={`End action: ${current.label}`}
          title={current.label}
          className={`inline-flex h-10 w-[8.5rem] shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold tracking-tight transition-colors duration-150 ${
            active
              ? 'bg-green-400/20 group-hover:bg-green-400/30 hover:bg-green-400/40 dark:bg-green-600/25 dark:group-hover:bg-green-600/35 dark:hover:bg-green-600/45'
              : 'bg-base-100 group-hover:bg-base-200 hover:bg-base-300 dark:bg-base-900 dark:group-hover:bg-base-950 dark:hover:bg-black'
          }`}
        >
          <CurrentIcon className={`size-4 shrink-0 ${current.color}`} />
          <span className="min-w-0 flex-1 truncate text-left">{current.label}</span>
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-50" />
        </ListboxButton>
        <ListboxOptions anchor="bottom end" className={`w-[8.5rem] ${menu}`}>
          {options.map((action) => {
            const meta = ACTION_META[action];
            const Icon = meta.icon;
            return (
              <ListboxOption
                key={action}
                value={action}
                className="flex cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-sm tracking-tight text-base-950 select-none data-focus:bg-base-150 data-selected:font-semibold dark:text-paper dark:data-focus:bg-base-850"
              >
                <Icon className={`size-4 shrink-0 ${meta.color}`} />
                {meta.label}
              </ListboxOption>
            );
          })}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
