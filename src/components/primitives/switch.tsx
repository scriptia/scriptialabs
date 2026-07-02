import * as React from 'react';

import { cn } from '@/lib/utils';

export type SwitchProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(function Switch({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="checkbox"
      role="switch"
      className={cn(
        'peer h-6 w-11 rounded-full border border-border bg-surface-subtle shadow-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});
