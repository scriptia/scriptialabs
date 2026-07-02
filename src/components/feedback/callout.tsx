import * as React from 'react';

import { cn } from '@/lib/utils';

export type CalloutProps = React.HTMLAttributes<HTMLDivElement> & {
  title?: React.ReactNode;
};

export function Callout({ className, title, children, ...props }: CalloutProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface-subtle p-4', className)} {...props}>
      {title ? <div className="text-body font-medium text-text-primary">{title}</div> : null}
      <div className="mt-1 text-body-small text-text-secondary">{children}</div>
    </div>
  );
}
