import * as React from 'react';

import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** Page title, rendered as a serif h1. */
  title: string;
  /** Optional supporting copy shown beneath the title. */
  subtitle?: string;
  /** Optional actions (buttons, links) aligned to the end of the header. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Canonical page header: DM Serif h1, optional secondary subtitle and an
 * actions slot. Additive shared primitive; compose it at the top of a page.
 */
export default function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="space-y-1">
        <h1 className="font-serif text-3xl text-text-primary sm:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="max-w-2xl text-base text-text-secondary">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  );
}
