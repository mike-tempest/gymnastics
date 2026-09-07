'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useClubRegion } from '@/hooks/useClubRegion';
import { completeParentMandateSetup, startParentMandateSetup } from '@/lib/api/parent-mandate';
import { directDebitScheme } from '@/lib/utils/direct-debit';
import { paymentMethodLabel } from '@/lib/utils/region-labels';

/**
 * Direct Debit setup for the parent who is paying (TEM-22).
 *
 * This is where the mandate setup email lands. Everything about the family is
 * resolved server-side from the session, so nothing on this page names a
 * family, and the session token that ties the two halves of the provider
 * redirect together is minted by the server, not here.
 *
 * The provider sends the payer back to this same page with a redirect_flow_id
 * in the query, which is the signal to finish the setup.
 */
export default function ParentMandateSetupPage() {
  const searchParams = useSearchParams();
  const { country, club, isLoading: clubLoading } = useClubRegion();
  const scheme = directDebitScheme(country);
  const isBacs = scheme === 'bacs';
  const methodLabel = paymentMethodLabel(country);
  const isStripe = club?.payment_provider === 'stripe';
  // An explicit null from /clubs/me means the club has no payment connection
  // at all, so there is nothing to set up and offering the flow would only end
  // in an error.
  const paymentsNotSetUp = !clubLoading && club != null && club.payment_provider === null;

  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectFlowId = searchParams.get('redirect_flow_id');

  const complete = useCallback(async (flowId: string) => {
    setIsCompleting(true);
    setError(null);
    try {
      await completeParentMandateSetup(flowId);
      setSucceeded(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'We could not finish the setup. Please start again.'
      );
    } finally {
      setIsCompleting(false);
    }
  }, []);

  useEffect(() => {
    if (redirectFlowId) {
      void complete(redirectFlowId);
    }
  }, [redirectFlowId, complete]);

  const start = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const response = await startParentMandateSetup(
        `${window.location.origin}/parent/billing/setup`
      );
      window.location.href = response.redirect_url;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `We could not start the ${methodLabel} setup. Please try again.`
      );
      setIsStarting(false);
    }
  };

  if (isCompleting) {
    return (
      <div className="min-h-dvh bg-canvas flex items-center justify-center p-6">
        <LoadingSpinner message={`Finishing your ${methodLabel} setup...`} size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas p-6 sm:p-10">
      <div className="max-w-2xl mx-auto bg-surface rounded-3xl border border-grey-200 p-6 sm:p-10 shadow-lg">
        {succeeded ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-brand/20 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-7 h-7 text-brand" aria-hidden="true" />
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl text-dark-primary tracking-tight mb-3">
              That is set up
            </h1>
            <p className="text-grey-600 text-lg">
              Your {methodLabel} is in place. Club fees will be collected automatically, and every
              invoice appears in your portal before it is taken.
            </p>
          </>
        ) : paymentsNotSetUp ? (
          <>
            <h1 className="font-serif text-4xl text-dark-primary tracking-tight mb-3">
              Online payments are not available yet
            </h1>
            <p className="text-grey-600 text-lg">
              Your club has not finished setting up online payments. You will be able to add a
              payment method here once they have. Contact the club if you have questions.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-serif text-4xl sm:text-6xl text-dark-primary tracking-tight mb-3">
              {isStripe ? 'Set up automatic payments' : `Set up your ${methodLabel}`}
            </h1>
            <p className="text-grey-600 text-lg mb-8">
              {isStripe
                ? 'You will be taken to a secure Stripe page to set up your payment method. Depending on your club, you can pay by bank debit or card.'
                : `Club fees are collected by ${methodLabel}. It takes a couple of minutes, and you can cancel at any time.`}
            </p>

            <ul className="space-y-3 text-grey-600 mb-8">
              <li>Nothing to remember: fees are collected on the day they are due.</li>
              <li>
                {isBacs
                  ? 'Protected by the Direct Debit Guarantee.'
                  : "Protected by your country's bank debit scheme rules."}
              </li>
              <li>Every invoice appears in your portal before it is collected.</li>
            </ul>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-danger text-sm mb-6"
              >
                {error}
              </div>
            )}

            <button
              onClick={start}
              disabled={isStarting || clubLoading}
              className="w-full min-h-[48px] px-8 py-4 bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center gap-3 text-lg disabled:opacity-60"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  <span>Taking you there...</span>
                </>
              ) : (
                <span>{isStripe ? 'Continue to Stripe' : 'Continue to GoCardless'}</span>
              )}
            </button>

            <p className="text-grey-400 text-sm mt-6">
              {isStripe
                ? 'Payments are processed securely through Stripe.'
                : 'Payments are processed securely through GoCardless, a regulated payment service provider.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
