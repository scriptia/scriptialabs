import * as React from 'react';

import { cn } from '@/lib/utils';

export type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: 'default' | 'subtle' | 'brand';
};

const variantClasses = {
  default: 'text-text-primary hover:text-brand',
  subtle: 'text-text-secondary hover:text-text-primary',
  brand: 'text-brand hover:text-brand-strong'
} as const;

export function Link({ className, variant = 'default', ...props }: LinkProps) {
  return <a className={cn('transition-colors underline-offset-4 hover:underline', variantClasses[variant], className)} {...props} />;
}
