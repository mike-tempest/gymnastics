'use client';

import { StatusKey } from '@/lib/utils/billing';

export type { StatusKey };

const STATUS_CONFIG: Record<StatusKey, { label: string; dotClass: string; badgeBg: string; badgeText: string; badgeBorder: string }> = {
  draft: {
    label: 'Draft',
    dotClass: 'bg-grey-400',
    badgeBg: 'bg-white/10',
    badgeText: 'text-white/60',
    badgeBorder: 'border-white/20',
  },
  sent: {
    label: 'Pending',
    dotClass: 'bg-brand',
    badgeBg: 'bg-dark-primary/20',
    badgeText: 'text-brand',
    badgeBorder: 'border-brand/30',
  },
  paid: {
    label: 'Paid',
    dotClass: 'bg-brand',
    badgeBg: 'bg-brand/20',
    badgeText: 'text-brand',
    badgeBorder: 'border-brand/30',
  },
  overdue: {
    label: 'Overdue',
    dotClass: 'bg-red-400',
    badgeBg: 'bg-red-500/20',
    badgeText: 'text-red-400',
    badgeBorder: 'border-red-500/30',
  },
};

interface InvoiceStatusBadgeProps {
  status: StatusKey;
}

export default function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} aria-hidden="true" />
      {config.label}
    </span>
  );
}
