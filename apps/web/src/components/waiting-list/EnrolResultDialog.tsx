'use client';

import { AlertTriangle, CheckCircle2, Copy } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import type { EnrolmentResult } from '@/lib/api/waiting-list';
import { MEMBER_NOUN, MEMBER_NOUN_LOWER } from '@/lib/brand';

interface EnrolResultDialogProps {
  result: EnrolmentResult | null;
  onClose: () => void;
}

/**
 * What the one click actually did (TEM-22).
 *
 * The enrolment does six things at once, so it says which of them happened
 * rather than a bare "done". Anything that did not happen is listed with what
 * a person has to do about it, because a silent half-enrolment is worse than
 * a slow one.
 */
export default function EnrolResultDialog({ result, onClose }: EnrolResultDialogProps) {
  if (!result) return null;

  const done: string[] = [
    result.family_created ? 'Created the family record' : 'Added them to the existing family',
    `Created the ${MEMBER_NOUN_LOWER} record`,
  ];
  if (result.squad_assigned) {
    done.push('Gave them their place on the register');
  }
  if (result.consents_requested > 0) {
    done.push(
      `Requested ${result.consents_requested} consent${result.consents_requested === 1 ? '' : 's'} from the parent`
    );
  }
  if (result.invite_url) {
    done.push('Created the parent portal invitation');
  }
  if (result.mandate_already_active) {
    done.push('Fees go on the family existing Direct Debit');
  } else if (result.mandate_email_sent) {
    done.push('Emailed the parent to set up the Direct Debit');
  }
  if (result.enrolment_email_sent) {
    done.push('Emailed the family to confirm the place');
  }

  const copyInvite = async () => {
    if (!result.invite_url) return;
    try {
      await navigator.clipboard.writeText(result.invite_url);
      toast.success('Invitation link copied');
    } catch {
      toast.error('Could not copy the link. Select and copy it by hand.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-dark-primary rounded-3xl border border-white/20 shadow-lg p-6 sm:p-8 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-start gap-3 mb-6">
          <CheckCircle2 className="w-6 h-6 text-brand flex-shrink-0 mt-1" aria-hidden="true" />
          <h2 className="font-serif text-3xl text-white">Enrolled</h2>
        </div>

        <ul className="space-y-2 mb-6">
          {done.map((item) => (
            <li key={item} className="text-text-secondary text-sm flex items-start gap-2">
              <span className="text-brand" aria-hidden="true">
                &bull;
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {result.needs_attention.length > 0 && (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 mb-6">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle
                className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="text-yellow-200 font-semibold text-sm">Still needs you</p>
            </div>
            <ul className="space-y-2">
              {result.needs_attention.map((item) => (
                <li key={item} className="text-yellow-200 text-sm">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.invite_url && (
          <div className="rounded-xl border border-white/20 bg-white/5 p-4 mb-6">
            <p className="text-white font-semibold text-sm mb-2">Parent portal invitation</p>
            <p className="text-text-secondary text-xs mb-3 break-all">{result.invite_url}</p>
            <button
              onClick={copyInvite}
              className="px-4 py-2 min-h-[44px] bg-white/5 text-white rounded-xl font-semibold border border-white/20 hover:bg-white/10 transition-all text-sm inline-flex items-center gap-2"
            >
              <Copy className="w-4 h-4" aria-hidden="true" />
              <span>Copy the link</span>
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/members/${result.member_id}`}
            className="flex-1 min-h-[48px] px-6 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all flex items-center justify-center"
          >
            Open the {MEMBER_NOUN} record
          </Link>
          <button
            onClick={onClose}
            className="flex-1 min-h-[48px] px-6 py-3 bg-white/5 text-white rounded-xl font-semibold border border-white/20 hover:bg-white/10 transition-all"
          >
            Back to the list
          </button>
        </div>
      </div>
    </div>
  );
}
