import * as React from 'react';

import { cn } from '@/lib/utils';

export type BodyProps = React.HTMLAttributes<HTMLParagraphElement> & {
  size?: 'large' | 'base' | 'small' | 'caption';
};

const sizeClasses = {
  large: 'text-body-large leading-[1.7]',
  base: 'text-body leading-[1.65]',
  small: 'text-body-small leading-[1.55]',
  caption: 'text-caption leading-[1.45]'
} as const;

export function Body({ className, size = 'base', ...props }: BodyProps) {
  return <p className={cn('font-sans text-text-secondary', sizeClasses[size], className)} {...props} />;
}
