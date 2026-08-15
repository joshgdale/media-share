import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../ConfirmDialog';
import { QUIT_HOLD_MS } from '../../types';

function quitShortcutLabel(): string {
  return navigator.platform.includes('Mac') ? '⌘Q' : 'Ctrl+Q';
}

function useHoldProgress(active: boolean, durationMs: number, generation: number): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const next = Math.min(1, (now - started) / durationMs);
      setProgress(next);
      if (next < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, durationMs, generation]);

  return active ? progress : 0;
}

export function QuitConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [holding, setHolding] = useState(false);
  const [holdGeneration, setHoldGeneration] = useState(0);
  const [holdDurationMs, setHoldDurationMs] = useState(QUIT_HOLD_MS);
  const progress = useHoldProgress(holding, holdDurationMs, holdGeneration);
  const shortcut = quitShortcutLabel();

  useEffect(() => {
    return window.mediaShare.onQuitEvent((event) => {
      switch (event.type) {
        case 'prompt':
          setOpen(true);
          setHoldDurationMs(event.durationMs);
          setHolding(event.hold);
          if (event.hold) setHoldGeneration((n) => n + 1);
          break;
        case 'hold-start':
          setOpen(true);
          setHoldDurationMs(event.durationMs);
          setHolding(true);
          setHoldGeneration((n) => n + 1);
          break;
        case 'hold-stop':
          setHolding(false);
          break;
        default:
          break;
      }
    });
  }, []);

  function handleCancel(): void {
    setOpen(false);
    setHolding(false);
    window.mediaShare.cancelQuit();
  }

  return (
    <ConfirmDialog
      open={open}
      title="Quit Media Share?"
      confirmLabel={holding ? `Hold ${shortcut}` : 'Quit'}
      confirmHoldProgress={holding ? progress : undefined}
      onCancel={handleCancel}
      onConfirm={() => window.mediaShare.confirmQuit()}
    >
      {holding ? (
        <>
          Keep holding {shortcut} to quit, or click Quit. Playback will stop and the output
          window will close.
        </>
      ) : (
        <>Playback will stop and the output window will close.</>
      )}
    </ConfirmDialog>
  );
}
