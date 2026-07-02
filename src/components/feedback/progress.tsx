import * as React from 'react';

import { cn } from '@/lib/utils';

export type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value: number;
  label?: string;
};

export function Progress({ className, value, label = 'Progress', ...props }: ProgressProps) {
  return (
    <div aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} role="progressbar" className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-subtle', className)} {...props}>
      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
