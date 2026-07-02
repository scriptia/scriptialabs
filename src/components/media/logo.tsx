import * as React from 'react';

export type LogoProps = React.HTMLAttributes<HTMLSpanElement> & {
  label?: string;
};

export function Logo({ label = 'Scriptia Labs', ...props }: LogoProps) {
  return <span aria-label={label} {...props}>{label}</span>;
}
