'use client';

import { Info } from 'lucide-react';

/**
 * Shown to Australian clubs only: how to get a roster out of Swim Central
 * and into the import wizard. Swim Central's Full Members Report is queued
 * and emailed as a zipped file, so the upload may be .csv or .xlsx and the
 * column names are not fixed; the mapping step absorbs both.
 */
export default function SwimCentralHint({ country }: { country: string }) {
  if (country !== 'AU') return null;

  return (
    <div className="bg-brand bg-opacity-10 border border-brand border-opacity-30 rounded-xl p-4 flex items-start space-x-3">
      <Info className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
      <p className="text-text-secondary text-sm">
        <span className="text-white font-semibold">Importing from Swim Central?</span> Download
        your Full Members Report (Administration &gt; Members), unzip the emailed file, and
        upload it here. Column names are matched automatically and you can adjust them before
        importing.
      </p>
    </div>
  );
}
