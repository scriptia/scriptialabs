import * as React from 'react';

import { cn } from '@/lib/utils';

export type RadioProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(function Radio({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="radio"
      className={cn(
        'h-4 w-4 border border-border bg-surface text-brand shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});
