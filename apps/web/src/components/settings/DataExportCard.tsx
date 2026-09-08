'use client';

import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ApiError } from '@/lib/api/api-client';
import { downloadClubExport } from '@/lib/api/export';
import { MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';

const DOWNLOAD_BUTTON =
  'inline-flex items-center gap-2 px-6 py-3 min-h-[48px] rounded-button font-semibold bg-brand text-dark-primary hover:bg-brand-dark transition-colors disabled:opacity-50';

/** What the archive contains, in the order the files appear inside it. */
const INCLUDED = [
  `Your club record, settings and logins`,
  `Families, ${MEMBER_NOUN_PLURAL_LOWER}, squads, squad rosters, sessions and every register mark`,
  `Fee structures, invoices, invoice lines, payments and Direct Debit mandates`,
  `Award schemes, levels, progress and assessments`,
  `Consents, background checks, safeguarding records and your checklist`,
  `Waiting list entries and the places you have offered`,
  `Everything you have sent from the communications tools`,
];

/**
 * Export your data.
 *
 * A one-click full export is a product feature here, not a support request
 * (docs/05-Build-Brief-Positioning-and-Product-Rules.md, rule 6). The copy
 * says plainly that the data is the club's, because the point of the feature
 * is the promise as much as the file.
 */
export function DataExportCard() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await downloadClubExport();
      toast.success('Your export has been downloaded');
    } catch (err) {
      // The archive holds medical notes and safeguarding records, so the
      // service only lets a club administrator take it. Say so plainly rather
      // than showing a coach a bare "Forbidden".
      if (err instanceof ApiError && err.status === 403) {
        toast.error('Only a club administrator can download the full export');
      } else if (err instanceof ApiError && err.status === 429) {
        toast.error('An export was started very recently. Please try again in a few minutes.');
      } else {
        toast.error(err instanceof Error ? err.message : 'Could not build your export');
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      <p className="text-white/70 mb-4">
        This is your data, and you can take a complete copy of it whenever you like. No request, no
        charge and no waiting. You get a ZIP of plain CSV files that open in any spreadsheet, with
        the identifier columns you need to join them back together.
      </p>

      <ul className="mb-4 space-y-2">
        {INCLUDED.map((item) => (
          <li key={item} className="flex gap-3 text-sm text-white/70">
            <span aria-hidden="true" className="text-brand">
              &bull;
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <p className="text-white/50 text-sm mb-6">
        Passwords and single-use invitation links are left out, because they are secrets rather than
        records. Wellbeing and cycle logs are left out too: those are health records the{' '}
        {MEMBER_NOUN_PLURAL_LOWER} enter for themselves, so who may read them in bulk is a decision
        to make with us rather than a default. A note inside the archive lists all of this.
      </p>

      <p className="text-white/50 text-sm mb-6">
        Because the archive holds medical notes and safeguarding records, only a club administrator
        can download it.
      </p>

      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        className={DOWNLOAD_BUTTON}
      >
        {isExporting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Download className="w-5 h-5" />
        )}
        {isExporting ? 'Preparing your export' : 'Download all your data'}
      </button>
    </div>
  );
}
