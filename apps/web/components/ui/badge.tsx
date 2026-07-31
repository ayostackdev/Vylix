import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'destructive' | 'success' | 'info' | 'warning' | 'live';
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'border-indigo-100 bg-indigo-50 text-violet-700 ring-1 ring-indigo-100/70',
    destructive: 'border-orange-100 bg-orange-50 text-orange-900 ring-1 ring-orange-100/70',
    success: 'border-green-100 bg-green-50 text-emerald-700 ring-1 ring-green-100/70',
    info: 'border-indigo-100 bg-indigo-100 text-indigo-900 ring-1 ring-indigo-100/70',
    warning: 'border-amber-100 bg-amber-50 text-amber-900 ring-1 ring-amber-100/70',
    live: 'border-emerald-200 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70 flex items-center gap-1.5'
  };

  return (
    <span
      className={cn(
        'cp-pill inline-flex items-center rounded-full border px-3 py-1',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
