import * as React from 'react';

export type PopoverProps = React.HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode;
};

export function Popover({ children, ...props }: PopoverProps) {
  return <div role="dialog" aria-modal="false" {...props}>{children}</div>;
}
