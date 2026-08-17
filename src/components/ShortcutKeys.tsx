interface ShortcutKeysProps {
  keys: string[];
}

export function ShortcutKeys({ keys }: ShortcutKeysProps) {
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {keys.map((key) => (
        <kbd
          key={key}
          className="mx-px inline-flex min-w-[1.25rem] items-center justify-center rounded-md bg-paper px-1.5 py-0.5 text-[11px] font-semibold tracking-tight text-base-950 dark:bg-black dark:text-paper"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
