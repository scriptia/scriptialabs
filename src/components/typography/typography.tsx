import * as React from 'react';

export type TypographyProps = React.HTMLAttributes<HTMLElement>;

export function Typography({ children, ...props }: TypographyProps) {
  return <div {...props}>{children}</div>;
}
