import * as React from 'react';

import { cn } from '@/lib/utils';

export type ChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
};

export function Chip({ className, selected = false, type = 'button', ...props }: ChipProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center rounded-pill border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected ? 'border-brand bg-brand-subtle text-brand-strong' : 'border-border bg-surface text-text-secondary hover:bg-surface-subtle',
        className
      )}
      {...props}
    />
  );
}
