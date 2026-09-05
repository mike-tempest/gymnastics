import { notFound } from 'next/navigation';

import { isCompetitionsEnabled } from '@/lib/features';

/**
 * Gates every route under /competitions while the swimming times/strokes
 * module is feature-flagged off (TEM-15). New pages added to this segment are
 * gated automatically; no per-page wrapper is needed.
 */
export default function CompetitionsLayout({ children }: { children: React.ReactNode }) {
  if (!isCompetitionsEnabled()) {
    notFound();
  }
  return children;
}
