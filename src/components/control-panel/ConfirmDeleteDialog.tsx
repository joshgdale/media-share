import { TrashIcon } from '../../icons';
import { ConfirmDialog } from '../ConfirmDialog';

interface ConfirmDeleteDialogProps {
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteDialog({
  open,
  title,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Delete cue"
      confirmLabel="Delete"
      confirmIcon={<TrashIcon className="size-4" />}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      Remove{' '}
      <span className="font-medium text-base-950 dark:text-paper">{title}</span> from the
      playlist? This cannot be undone.
    </ConfirmDialog>
  );
}
