import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded bg-grey-800', className)} {...props} />;
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-label="Loading...">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 sm:p-6 bg-white/5 border border-white/10 rounded-2xl"
        >
          <div className="flex items-center space-x-3 sm:space-x-5">
            <Skeleton className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex-shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40 sm:w-56" />
              <Skeleton className="h-4 w-28 sm:w-40" />
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Skeleton className="h-7 w-20 rounded-full hidden sm:block" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export { Skeleton, TableSkeleton };
