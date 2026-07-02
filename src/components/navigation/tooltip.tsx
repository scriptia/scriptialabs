import * as React from 'react';

export type TooltipProps = React.HTMLAttributes<HTMLSpanElement> & {
  label: React.ReactNode;
};

export function Tooltip({ label, children, ...props }: TooltipProps) {
  return (
    <span title={typeof label === 'string' ? label : undefined} {...props}>
      {children}
    </span>
  );
}
