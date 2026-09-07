'use client';

import { AlertTriangle, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { BRAND, MEMBER_NOUN_PLURAL } from '@/lib/brand';
import { type MigrationJourney, journeyTotals, stepStatus } from '@/lib/import/migration-journey';

interface NextAction {
  title: string;
  detail: string;
  href: string;
  cta: string;
}

/**
 * The finish page: what actually came across, and the handful of things a club
 * still has to do itself. Counts come from what each importer reported, so a
 * step that was skipped or that failed shows as nothing rather than as success.
 */
export default function MigrationChecklist({ journey }: { journey: MigrationJourney }) {
  const totals = journeyTotals(journey);
  const { counts } = totals;

  const ranGoCardless = stepStatus(journey, 'gocardless') === 'done';
  const hasLiveMandates = counts.activeMandates > 0;

  const tiles: { label: string; value: number; emphasis?: boolean }[] = [
    { label: MEMBER_NOUN_PLURAL, value: counts.members, emphasis: true },
    { label: 'Families', value: counts.families, emphasis: true },
    { label: 'Squads created', value: counts.squadsCreated },
    { label: 'Squads matched', value: counts.squadsMatched },
    { label: 'Coaches and committee', value: counts.staff },
    { label: 'Fee structures', value: counts.feeStructures },
    { label: 'Mandates imported', value: counts.mandates, emphasis: true },
    { label: 'Live Direct Debits', value: counts.activeMandates, emphasis: true },
  ];

  const nextActions: NextAction[] = [
    {
      title: 'Invite your parents',
      detail:
        'Open a family and send its invitation link. Parents get the portal, their invoices and their own contact details to keep up to date.',
      href: '/families',
      cta: 'Go to families',
    },
    ranGoCardless && hasLiveMandates
      ? {
          title: 'Connect GoCardless so collections run',
          detail: `Your mandates are recorded here but ${BRAND.name} still needs the connection to your own GoCardless organisation before it can collect against them.`,
          href: '/admin/settings',
          cta: 'Open settings',
        }
      : {
          title: 'Set up Direct Debits',
          detail:
            'Card details cannot be moved between systems, and nor can a Direct Debit on a rail you do not control. Invited parents set theirs up once from the parent portal.',
          href: '/admin/settings',
          cta: 'Open settings',
        },
    {
      title: 'Add your compliance records',
      detail:
        'No incumbent export carries DBS, first aid or safeguarding training, so these start empty. Add them with their expiry dates and the alerts take over.',
      href: '/compliance',
      cta: 'Go to compliance',
    },
    {
      title: 'Check your squads and sessions',
      detail:
        'Squads created from your files carry a name and little else. Add training times, capacity and a coach so registers work.',
      href: '/squads',
      cta: 'Go to squads',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-dark-primary border border-white/10 p-6 sm:p-8">
        <div className="flex items-start gap-3 mb-6">
          {totals.isEmpty ? (
            <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
          ) : (
            <CheckCircle2 className="w-6 h-6 text-brand flex-shrink-0 mt-1" />
          )}
          <div>
            <h2 className="font-serif text-3xl text-white tracking-tight mb-1">
              {totals.isEmpty ? 'Nothing has been imported yet' : 'What came across'}
            </h2>
            <p className="text-text-secondary text-sm">
              {totals.isEmpty
                ? 'Every step was skipped, or the imports that ran brought no rows across. Reopen a step below and run it again, or check the errors the importer reported.'
                : 'Counted from what each importer reported as it finished. Rows that failed are not counted here.'}
            </p>
          </div>
        </div>

        {!totals.isEmpty && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {tiles.map((tile) => (
              <div
                key={tile.label}
                className="bg-dark-primary/80 rounded-xl border border-white/20 p-3 text-center"
              >
                <p className={`text-2xl font-bold ${tile.emphasis ? 'text-brand' : 'text-white'}`}>
                  {tile.value}
                </p>
                <p className="text-text-secondary text-xs">{tile.label}</p>
              </div>
            ))}
          </div>
        )}

        {totals.errorCount > 0 && (
          <div className="mt-6 rounded-xl border border-red-500 bg-red-500 bg-opacity-10 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm">
              {totals.errorCount} row{totals.errorCount !== 1 ? 's' : ''} could not be imported.
              Reopen the step that reported them to see the detail and try those rows again.
            </p>
          </div>
        )}

        {totals.warningCount > 0 && (
          <div className="mt-4 rounded-xl border border-yellow-500 bg-yellow-500 bg-opacity-10 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-yellow-200 text-sm">
              {totals.warningCount} row{totals.warningCount !== 1 ? 's' : ''} were skipped on
              purpose, usually because they were already here.
            </p>
          </div>
        )}

        {ranGoCardless && !hasLiveMandates && (
          <div className="mt-4 rounded-xl border border-yellow-500 bg-yellow-500 bg-opacity-10 p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-yellow-200 text-sm">
              No live Direct Debit came across. Check the mandate statuses in your GoCardless
              export: only active mandates can be collected against.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-3xl bg-dark-primary border border-white/10 p-6 sm:p-8">
        <h2 className="font-serif text-3xl text-white tracking-tight mb-2">What to do next</h2>
        <p className="text-text-secondary text-sm mb-6">
          Four things no import can do for you. None of them takes long.
        </p>
        <ul className="space-y-4">
          {nextActions.map((action) => (
            <li
              key={action.title}
              className="rounded-xl border border-white/20 bg-dark-primary/80 p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
            >
              <div>
                <p className="text-white font-semibold mb-1">{action.title}</p>
                <p className="text-text-secondary text-sm">{action.detail}</p>
              </div>
              <Link
                href={action.href}
                className="min-h-[48px] px-6 py-3 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/5 transition-all flex items-center justify-center gap-2 flex-shrink-0"
              >
                <span>{action.cta}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
