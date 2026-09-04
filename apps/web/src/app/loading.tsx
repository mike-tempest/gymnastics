import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function Loading() {
  return (
    <div className="flex h-dvh items-center justify-center bg-dark-primary">
      <LoadingSpinner size="lg" />
    </div>
  );
}
