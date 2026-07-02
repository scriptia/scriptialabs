import * as React from 'react';

export type DropdownProps = React.HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode;
};

export function Dropdown({ children, ...props }: DropdownProps) {
  return <div role="menu" {...props}>{children}</div>;
}
