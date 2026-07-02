import * as React from 'react';

export type ProductLogoProps = React.HTMLAttributes<HTMLSpanElement> & {
  label: string;
};

export function ProductLogo({ label, ...props }: ProductLogoProps) {
  return <span aria-label={label} {...props}>{label}</span>;
}
