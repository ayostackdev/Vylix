import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton', className)} {...props} />;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-white p-4 space-y-3">
      <Skeleton className="skeleton-title" />
      <Skeleton className="skeleton-text w-full" />
      <Skeleton className="skeleton-text w-3/4" />
      <Skeleton className="skeleton-text w-1/2" />
    </div>
  );
}

function SkeletonAvatar() {
  return <Skeleton className="skeleton-avatar" />;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3">
      <SkeletonAvatar />
      <div className="flex-1 space-y-2">
        <Skeleton className="skeleton-title" />
        <Skeleton className="skeleton-text w-3/4" />
      </div>
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonAvatar, SkeletonRow };
