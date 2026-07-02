import * as React from 'react';

import { cn } from '@/lib/utils';

export type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: 'info' | 'success' | 'warning' | 'error';
  title?: React.ReactNode;
};

const toneClasses = {
  info: 'border-info/30 bg-info/8 text-text-primary',
  success: 'border-success/30 bg-success/8 text-text-primary',
  warning: 'border-warning/30 bg-warning/8 text-text-primary',
  error: 'border-error/30 bg-error/8 text-text-primary'
} as const;

export function Alert({ className, tone = 'info', title, children, ...props }: AlertProps) {
  return (
    <div role="alert" className={cn('rounded-lg border p-4', toneClasses[tone], className)} {...props}>
      {title ? <div className="text-body font-medium">{title}</div> : null}
      <div className="mt-1 text-body-small text-text-secondary">{children}</div>
    </div>
  );
}
