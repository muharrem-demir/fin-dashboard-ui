import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
}

export function Card({ className, children, ...rest }: CardProps): React.JSX.Element {
  return (
    <div className={cn('rounded-card border border-border-subtle bg-surface-raised shadow-card', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }: CardProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-4',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLHeadingElement> & { readonly children: ReactNode }): React.JSX.Element {
  return (
    <h2 className={cn('text-base font-semibold text-content-primary', className)} {...rest}>
      {children}
    </h2>
  );
}

export function CardBody({ className, children, ...rest }: CardProps): React.JSX.Element {
  return (
    <div className={cn('px-5 py-4', className)} {...rest}>
      {children}
    </div>
  );
}
