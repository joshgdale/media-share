import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { CheckIcon } from '../icons';
import { ink } from '../lib/theme';

export type ToastKind = 'loading' | 'success' | 'error';

export interface ToastPillState {
  kind: ToastKind;
  message: string;
}

interface ToastPillProps {
  toast: ToastPillState | null;
}

function SpinnerIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      className={`size-4 animate-spin ${ink.cyan}`}
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={2}
      />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ToastIcon({ kind }: { kind: ToastKind }) {
  if (kind === 'loading') return <SpinnerIcon />;
  if (kind === 'success') {
    return <CheckIcon className={`size-4 ${ink.green}`} />;
  }
  return (
    <span className={`text-sm font-bold leading-none ${ink.red}`} aria-hidden="true">
      !
    </span>
  );
}

export function ToastPill({ toast }: ToastPillProps) {
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center pt-3">
      <AnimatePresence>
        {toast ? (
          <motion.div
            key="toast-pill"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 380 }}
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-2 rounded-full bg-base-100 px-3.5 py-2 text-sm font-medium tracking-tight text-base-950 shadow-lg dark:bg-base-900 dark:text-paper"
          >
            <ToastIcon kind={toast.kind} />
            {toast.message}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
