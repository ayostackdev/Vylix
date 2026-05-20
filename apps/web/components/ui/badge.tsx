import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'destructive' | 'success' | 'info' | 'warning';
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'border-blue-200 bg-blue-50 text-blue-950 ring-1 ring-blue-100',
    destructive: 'border-orange-200 bg-orange-50 text-orange-800 ring-1 ring-orange-100',
    success: 'border-green-200 bg-green-100 text-green-800 ring-1 ring-green-100',
    info: 'border-blue-200 bg-blue-100 text-blue-800 ring-1 ring-blue-100',
    warning: 'border-amber-200 bg-amber-50 text-amber-800 ring-1 ring-amber-100'
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
