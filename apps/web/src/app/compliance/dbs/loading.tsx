import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex h-dvh items-center justify-center bg-dark-primary">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-brand mx-auto mb-4" />
        <p className="text-text-secondary text-lg">Loading background check records...</p>
      </div>
    </div>
  );
}
