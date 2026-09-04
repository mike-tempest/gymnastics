'use client';

interface ReadinessIndicatorProps {
  readiness: 'green' | 'amber' | 'red' | null;
  prefersLandTraining?: boolean;
  size?: 'sm' | 'md';
}

const READINESS_CONFIG = {
  green: {
    colour: 'bg-green-400',
    label: 'Good to go',
  },
  amber: {
    colour: 'bg-yellow-400',
    label: 'May need adjusting',
  },
  red: {
    colour: 'bg-red-400',
    label: 'Prefers land training',
  },
} as const;

export default function ReadinessIndicator({
  readiness,
  prefersLandTraining,
  size = 'sm',
}: ReadinessIndicatorProps) {
  if (!readiness) return null;

  const config = READINESS_CONFIG[readiness];
  const dotSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <div className="flex items-center gap-1.5" title={config.label}>
      <span className={`${dotSize} rounded-full ${config.colour}`} />
      {size === 'md' && (
        <span className="text-xs text-text-secondary">
          {prefersLandTraining ? 'Land' : config.label}
        </span>
      )}
    </div>
  );
}
