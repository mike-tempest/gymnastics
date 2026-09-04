'use client';

import { CheckCircle, Clock, XCircle, MinusCircle, type LucideIcon } from 'lucide-react';

/**
 * Canonical compliance status keys and their semantic colour mapping:
 * - compliant     -> success (mint)
 * - expiring-soon -> warning (amber)
 * - expired       -> danger (red)
 * - not-required  -> grey
 */
export type ComplianceStatus = 'compliant' | 'expiring-soon' | 'expired' | 'not-required';

const STATUS_CONFIG: Record<
  ComplianceStatus,
  { label: string; icon: LucideIcon; classes: string }
> = {
  compliant: {
    label: 'Compliant',
    icon: CheckCircle,
    classes: 'bg-success/20 text-success border-success/40',
  },
  'expiring-soon': {
    label: 'Expiring soon',
    icon: Clock,
    classes: 'bg-warning/20 text-warning border-warning/40',
  },
  expired: {
    label: 'Expired',
    icon: XCircle,
    classes: 'bg-danger/20 text-danger border-danger/40',
  },
  'not-required': {
    label: 'Not required',
    icon: MinusCircle,
    classes: 'bg-grey-500/20 text-grey-400 border-grey-500/40',
  },
};

interface ComplianceStatusBadgeProps {
  status: ComplianceStatus;
  /** Override the default label for the status (e.g. "Valid", "Missing"). */
  label?: string;
}

export default function ComplianceStatusBadge({ status, label }: ComplianceStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${config.classes}`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {label ?? config.label}
    </span>
  );
}
