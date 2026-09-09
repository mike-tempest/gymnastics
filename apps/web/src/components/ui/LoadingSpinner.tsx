interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({
  message = 'Loading...',
  size = 'md',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-8 w-8 border-3',
    md: 'h-12 w-12 border-4',
    lg: 'h-16 w-16 border-4',
  };

  return (
    <div className="text-center py-16">
      <div
        className={`inline-block animate-spin ${sizeClasses[size]} border-brand border-t-transparent rounded-full`}
      ></div>
      {message && <p className="text-text-secondary text-lg mt-4">{message}</p>}
    </div>
  );
}
