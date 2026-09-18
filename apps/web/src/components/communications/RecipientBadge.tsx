import { Users } from 'lucide-react';

import type { Communication } from '@/lib/api/communications';

const BADGE_STYLES = {
  ALL: 'bg-info/20 text-info border border-info/30',
  SQUAD: 'bg-brand/20 text-brand border border-brand/30',
  FAMILY: 'bg-coral/20 text-coral-light border border-coral/30',
} as const;

const BADGE_LABELS: Record<keyof typeof BADGE_STYLES, (c: Communication) => string> = {
  ALL: () => 'All Families',
  SQUAD: (c) => c.squad?.squad_name ?? 'Squad',
  FAMILY: (c) => c.family?.family_name ?? 'Family',
};

export default function RecipientBadge({ communication }: { communication: Communication }) {
  const type = communication.recipient_type.toUpperCase() as keyof typeof BADGE_STYLES;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${BADGE_STYLES[type]}`}
    >
      <Users className="h-3 w-3" />
      {BADGE_LABELS[type](communication)}
    </span>
  );
}
