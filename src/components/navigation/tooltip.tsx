'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export type TooltipProps = {
  label: string;
  children: React.ReactElement;
  side?: 'top' | 'bottom';
  className?: string;
};

// Single-child wrapper: clones the trigger to attach hover/focus handlers
// and an aria-describedby link, rather than rendering an extra DOM element
// around it. Shows on hover and keyboard focus (not just hover) and
// dismisses on Escape, matching the WAI-ARIA tooltip pattern.
export function Tooltip({ label, children, side = 'top', className }: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();

  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const trigger = React.cloneElement(children, {
    'aria-describedby': open ? id : undefined,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide
  } as React.HTMLAttributes<HTMLElement>);

  return (
    <span className="relative inline-flex">
      {trigger}
      {open ? (
        <span
          role="tooltip"
          id={id}
          className={cn(
            'pointer-events-none absolute left-1/2 z-50 w-max max-w-[16rem] -translate-x-1/2 rounded-md bg-surface-elevated px-2.5 py-1.5 text-body-small text-text-primary shadow-high',
            side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
            className
          )}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
