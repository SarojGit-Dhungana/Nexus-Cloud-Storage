import { Skeleton } from './ui/skeleton';

export function FileGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4"
        >
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-lg" />
            <div className="w-full space-y-2">
              <Skeleton className="h-4 w-3/4 mx-auto" />
              <Skeleton className="h-3 w-1/2 mx-auto" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
