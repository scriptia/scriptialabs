import * as React from 'react';

export type ToastProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: 'neutral' | 'success' | 'warning' | 'error';
};

export function Toast({ tone = 'neutral', ...props }: ToastProps) {
  return <div role="status" aria-live="polite" data-tone={tone} {...props} />;
}
