'use client';

import { ArrowRight, Route } from 'lucide-react';
import Link from 'next/link';

import { MIGRATION_JOURNEY_HREF } from '@/lib/import/migration-journey';

interface MigrationStepBannerProps {
  /** False when the page was opened on its own rather than from the wizard. */
  active: boolean;
  /** 1-based position of this importer in the journey. */
  position: number;
  total: number;
}

/**
 * Shown at the top of an importer page that a club reached through the
 * migration wizard, so it always knows where it is and how to get back.
 * Renders nothing when there is no journey covering this importer.
 */
export default function MigrationStepBanner({ active, position, total }: MigrationStepBannerProps) {
  if (!active || position < 1) return null;

  return (
    <div className="mb-6 rounded-xl border border-brand border-opacity-30 bg-brand bg-opacity-10 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div className="flex items-start gap-3">
        <Route className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-brand text-sm font-semibold">
            Step {position} of {total} of your migration
          </p>
          <p className="text-text-secondary text-sm">
            Finish this import and you come straight back to the rest of the journey. Leaving now
            keeps your progress.
          </p>
        </div>
      </div>
      <Link
        href={MIGRATION_JOURNEY_HREF}
        className="min-h-[48px] px-5 py-3 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/5 transition-all flex items-center justify-center gap-2 flex-shrink-0"
      >
        <span>Back to migration</span>
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

/**
 * The counterpart shown once the import has finished, so the obvious next
 * click carries on with the migration rather than ending it here.
 */
export function MigrationStepReturn({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <Link
      href={MIGRATION_JOURNEY_HREF}
      className="px-8 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm min-h-[48px] flex items-center justify-center gap-2"
    >
      <span>Continue your migration</span>
      <ArrowRight className="w-5 h-5" />
    </Link>
  );
}
