import * as React from 'react';

import { cn } from '@/lib/utils';

export type AvatarProps = React.HTMLAttributes<HTMLDivElement> & {
  alt?: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
};

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12'
} as const;

export function Avatar({ className, size = 'md', src, alt, ...props }: AvatarProps) {
  return (
    <div className={cn('inline-flex items-center justify-center overflow-hidden rounded-full bg-surface-subtle text-text-secondary', sizeClasses[size], className)} {...props}>
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external avatar URLs at CSS-driven sizes; next/image needs known dimensions and an allow-listed domain, neither of which fits this primitive */}
      {src ? <img src={src} alt={alt ?? ''} className="h-full w-full object-cover" /> : null}
    </div>
  );
}
