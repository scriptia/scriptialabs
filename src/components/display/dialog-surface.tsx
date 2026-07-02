'use client';

import * as React from 'react';

export type DialogSurfaceProps = React.DialogHTMLAttributes<HTMLDialogElement> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function DialogSurface({ open = false, onOpenChange, children, ...props }: DialogSurfaceProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      return;
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange?.(false);
      }}
      onClose={() => onOpenChange?.(false)}
      {...props}
    >
      {children}
    </dialog>
  );
}
