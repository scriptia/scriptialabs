import * as React from 'react';

import { cn } from '@/lib/utils';

export type ContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: 'reading' | 'content' | 'hero' | 'full';
};

const sizeClasses = {
  reading: 'mx-auto w-full max-w-reading px-4 sm:px-6',
  content: 'mx-auto w-full max-w-content px-4 sm:px-6 lg:px-8',
  hero: 'mx-auto w-full max-w-hero px-4 sm:px-6 lg:px-8',
  full: 'w-full px-4 sm:px-6 lg:px-8'
} as const;

export function Container({ className, size = 'content', ...props }: ContainerProps) {
  return <div className={cn(sizeClasses[size], className)} {...props} />;
}
