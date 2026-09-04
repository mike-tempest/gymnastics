import MainLayout from '@/components/layout/MainLayout';

export default function Loading() {
  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb skeleton */}
          <div className="mb-6 flex items-center gap-2">
            <div className="h-4 w-20 bg-surface-secondary rounded animate-pulse" />
            <div className="h-4 w-4 bg-surface-secondary rounded animate-pulse" />
            <div className="h-4 w-16 bg-surface-secondary rounded animate-pulse" />
          </div>

          {/* Header skeleton */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
            <div>
              <div className="h-10 w-32 bg-surface-secondary rounded animate-pulse mb-2" />
              <div className="h-6 w-64 bg-surface-secondary rounded animate-pulse" />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="h-11 w-44 bg-surface-secondary rounded-xl animate-pulse" />
              <div className="h-11 w-36 bg-surface-secondary rounded-full animate-pulse" />
            </div>
          </div>

          {/* Stats cards skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-surface-primary rounded-2xl p-6 border border-white/10">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="h-4 w-24 bg-surface-secondary rounded animate-pulse mb-3" />
                    <div className="h-8 w-28 bg-surface-secondary rounded animate-pulse" />
                  </div>
                  <div className="h-10 w-10 bg-surface-secondary rounded-lg animate-pulse" />
                </div>
              </div>
            ))}
          </div>

          {/* Filter bar skeleton */}
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-11 w-20 bg-surface-secondary rounded-xl animate-pulse" />
                ))}
              </div>
              <div className="h-11 w-48 bg-surface-secondary rounded-xl animate-pulse" />
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="h-11 w-40 bg-surface-secondary rounded-xl animate-pulse" />
              <div className="h-11 w-40 bg-surface-secondary rounded-xl animate-pulse" />
            </div>
          </div>

          {/* Table skeleton */}
          <div className="bg-surface-primary rounded-3xl shadow-lg border border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10">
              <div className="h-7 w-32 bg-surface-secondary rounded animate-pulse" />
            </div>
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-dark-primary rounded-xl">
                  <div className="h-5 w-5 bg-surface-secondary rounded animate-pulse" />
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="h-4 w-24 bg-surface-secondary rounded animate-pulse" />
                    <div className="h-4 w-32 bg-surface-secondary rounded animate-pulse" />
                    <div className="h-4 w-20 bg-surface-secondary rounded animate-pulse" />
                    <div className="h-4 w-24 bg-surface-secondary rounded animate-pulse" />
                    <div className="h-6 w-16 bg-surface-secondary rounded-full animate-pulse" />
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
