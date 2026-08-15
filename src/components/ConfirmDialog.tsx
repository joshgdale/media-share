import type { ReactNode } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { fill, muted, overlay } from '../lib/theme';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  confirmIcon?: ReactNode;
  confirmClassName?: string;
  confirmHoldProgress?: number;
  onCancel: () => void;
  onConfirm: () => void;
}

const backdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const panelMotion = {
  initial: { opacity: 0, y: 16, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 16, scale: 0.96 },
  transition: { type: 'spring' as const, damping: 26, stiffness: 320 },
};

export function ConfirmDialog({
  open,
  title,
  children,
  cancelLabel = 'Cancel',
  confirmLabel,
  confirmIcon,
  confirmClassName = fill.red,
  confirmHoldProgress,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const holding = confirmHoldProgress != null;

  return (
    <AnimatePresence>
      {open && (
        <Dialog static open={open} onClose={onCancel} className="relative z-50">
          <DialogBackdrop
            as={motion.div}
            {...backdropMotion}
            className={`fixed inset-0 ${overlay}`}
          />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <motion.div {...panelMotion} className="w-full max-w-sm">
              <DialogPanel className="w-full rounded-2xl bg-base-100 p-4 shadow-2xl dark:bg-base-900">
                <DialogTitle className="text-base font-bold tracking-tight text-base-950 dark:text-paper">
                  {title}
                </DialogTitle>
                <p className={`mt-2 text-sm tracking-tight ${muted}`}>{children}</p>
                <div className="mt-4 flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-xl bg-paper px-3.5 py-2 text-sm font-medium tracking-tight text-base-950 transition-colors hover:bg-base-50 dark:bg-black dark:text-paper dark:hover:bg-base-950"
                  >
                    {cancelLabel}
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    className={`relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl px-3.5 py-2 text-sm font-semibold tracking-tight transition-colors ${confirmClassName}`}
                  >
                    {holding ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 left-0 bg-black/20 dark:bg-white/15"
                        style={{ width: `${Math.min(1, Math.max(0, confirmHoldProgress)) * 100}%` }}
                      />
                    ) : null}
                    <span className="relative inline-flex items-center gap-2">
                      {confirmIcon}
                      {confirmLabel}
                    </span>
                  </button>
                </div>
              </DialogPanel>
            </motion.div>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
