import * as React from 'react';

import { cn } from '@/lib/utils';

export type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
};

export function Surface({ className, elevated = false, ...props }: SurfaceProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface text-text-primary',
        elevated && 'bg-surface-elevated shadow-low',
        className
      )}
      {...props}
    />
  );
}
