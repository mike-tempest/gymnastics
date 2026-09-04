import MainLayout from '@/components/layout/MainLayout';

export default function Loading() {
  return (
    <MainLayout>
      <div className="min-h-full bg-canvas p-4 md:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          {/* Breadcrumb skeleton */}
          <div className="mb-6 flex items-center gap-2">
            <div className="h-4 w-20 bg-surface-secondary rounded animate-pulse" />
            <div className="h-4 w-4 bg-surface-secondary rounded animate-pulse" />
            <div className="h-4 w-24 bg-surface-secondary rounded animate-pulse" />
          </div>

          {/* Header skeleton */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <div className="h-12 w-48 bg-surface-secondary rounded animate-pulse mb-2" />
              <div className="h-6 w-80 bg-surface-secondary rounded animate-pulse" />
            </div>
            <div className="h-11 w-28 bg-surface-secondary rounded-lg animate-pulse" />
          </div>

          {/* Session selector skeleton */}
          <div className="mb-6">
            <div className="h-4 w-32 bg-surface-secondary rounded animate-pulse mb-2" />
            <div className="h-14 w-full bg-surface-secondary rounded-xl animate-pulse" />
          </div>

          {/* Session info card skeleton */}
          <div className="mb-6 p-4 rounded-3xl border border-grey-200 bg-surface-primary shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex-1">
                <div className="h-6 w-56 bg-surface-secondary rounded animate-pulse mb-2" />
                <div className="h-4 w-72 bg-surface-secondary rounded animate-pulse" />
              </div>
              <div className="md:text-right">
                <div className="h-7 w-32 bg-surface-secondary rounded-lg animate-pulse mb-1" />
                <div className="h-3 w-24 bg-surface-secondary rounded animate-pulse" />
              </div>
            </div>
          </div>

          {/* Roster skeleton */}
          <div className="bg-surface-primary rounded-3xl shadow-lg border border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10">
              <div className="h-7 w-40 bg-surface-secondary rounded animate-pulse" />
            </div>
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-dark-primary rounded-xl">
                  <div className="h-5 w-5 bg-surface-secondary rounded animate-pulse" />
                  <div className="flex-1 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="h-5 w-32 bg-surface-secondary rounded animate-pulse mb-1" />
                      <div className="h-3 w-24 bg-surface-secondary rounded animate-pulse" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 w-20 bg-surface-secondary rounded-lg animate-pulse" />
                      <div className="h-8 w-20 bg-surface-secondary rounded-lg animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
