import * as React from 'react';

import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'text' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  asChild?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-text-inverse shadow-subtle hover:bg-brand-strong',
  secondary: 'bg-surface text-text-primary border border-border hover:bg-surface-elevated',
  ghost: 'bg-transparent text-text-primary hover:bg-surface-subtle',
  text: 'bg-transparent text-brand hover:text-brand-strong px-0',
  danger: 'bg-error text-text-inverse hover:opacity-95'
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading = false, disabled, children, type = 'button', asChild = false, ...props },
  ref
) {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 rounded-pill font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    className
  );

  if (asChild && React.isValidElement(children)) {
    const { type: _type, ...linkProps } = props;

    return React.cloneElement(children, {
      className: cn(classes, (children.props as { className?: string }).className),
      'aria-busy': loading || undefined,
      'aria-disabled': disabled || loading || undefined,
      ...linkProps
    });
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...props}
    >
      {children}
    </button>
  );
});
