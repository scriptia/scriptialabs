import * as React from 'react';

import { cn } from '@/lib/utils';

export type SectionProps = React.HTMLAttributes<HTMLElement> & {
  spacing?: 'sm' | 'md' | 'lg';
};

const spacingClasses = {
  sm: 'py-16 md:py-20',
  md: 'py-20 md:py-28',
  lg: 'py-24 md:py-32'
} as const;

export function Section({ className, spacing = 'md', ...props }: SectionProps) {
  return <section className={cn(spacingClasses[spacing], className)} {...props} />;
}
