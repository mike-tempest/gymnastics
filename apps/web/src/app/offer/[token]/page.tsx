'use client';

import { CalendarClock, CheckCircle2, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  acceptPublicOffer,
  declinePublicOffer,
  getPublicOffer,
  type AcceptOfferResult,
  type PublicOfferView,
} from '@/lib/api/waiting-list';
import { MEMBER_NOUN_LOWER } from '@/lib/brand';

/**
 * Answering an offer of a place (TEM-22).
 *
 * Reached from the link in the offer email, with no account and no login: the
 * random token in the path is the credential. Accepting here runs the whole
 * enrolment, which is the single click the product is built around.
 *
 * A `?decline=1` query, which the second link in the email carries, opens the
 * page on the decline note rather than the acceptance.
 */
export default function OfferPage({ params }: { params: { token: string } }) {
  const searchParams = useSearchParams();
  const [offer, setOffer] = useState<PublicOfferView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const [accepted, setAccepted] = useState<AcceptOfferResult | null>(null);
  const [declined, setDeclined] = useState(false);

  const loadOffer = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      setOffer(await getPublicOffer(params.token));
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'This offer link is not valid. It may already have been used.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [params.token]);

  useEffect(() => {
    void loadOffer();
  }, [loadOffer]);

  useEffect(() => {
    if (searchParams.get('decline') === '1') {
      setShowDecline(true);
    }
  }, [searchParams]);

  const handleAccept = async () => {
    setActionError(null);
    setIsAccepting(true);
    try {
      setAccepted(await acceptPublicOffer(params.token));
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'We could not accept the place. Please try again.'
      );
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    setActionError(null);
    setIsDeclining(true);
    try {
      await declinePublicOffer(params.token, declineReason.trim() || undefined);
      setDeclined(true);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'We could not record your reply. Please try again.'
      );
    } finally {
      setIsDeclining(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-dvh bg-canvas flex items-center justify-center p-6">
        <LoadingSpinner message="Loading your offer..." size="lg" />
      </main>
    );
  }

  if (loadError || !offer) {
    return (
      <main className="min-h-dvh bg-canvas flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-surface rounded-3xl border border-grey-200 p-8">
          <ErrorState
            message={loadError ?? 'This offer link is not valid.'}
            onRetry={loadOffer}
          />
        </div>
      </main>
    );
  }

  if (accepted) {
    return (
      <main className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-2xl mx-auto bg-surface rounded-3xl border border-grey-200 p-8 sm:p-10 shadow-lg">
          <div className="w-14 h-14 rounded-2xl bg-brand/20 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-7 h-7 text-brand" aria-hidden="true" />
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl text-dark-primary tracking-tight mb-3">
            That is confirmed
          </h1>
          <p className="text-grey-600 text-lg mb-8">
            {offer.child_name} has a place{offer.squad_name ? ` in ${offer.squad_name}` : ''} at{' '}
            {offer.club_name}.
          </p>

          <h2 className="font-serif text-2xl text-dark-primary mb-4">What we have just done</h2>
          <ul className="space-y-3 text-grey-600 mb-8">
            <li>Created the {MEMBER_NOUN_LOWER} record.</li>
            {accepted.squad_assigned && <li>Added them to the register for their class.</li>}
            <li>Sent the consent forms for you to complete.</li>
            <li>Emailed you a link to set up your parent account.</li>
            {accepted.mandate_setup_required ? (
              <li>Emailed you a separate link to set up the Direct Debit for fees.</li>
            ) : (
              <li>Fees will go on the Direct Debit you already have with the club.</li>
            )}
          </ul>

          {accepted.invite_url && (
            <a
              href={accepted.invite_url}
              className="inline-flex min-h-[48px] px-8 py-4 bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm items-center justify-center gap-3 text-lg"
            >
              Set up your account
            </a>
          )}

          <p className="text-grey-400 text-sm mt-8">
            Check your email for both links. If nothing arrives within a few minutes, look in your
            spam folder, then contact {offer.club_name}.
          </p>
        </div>
      </main>
    );
  }

  if (declined) {
    return (
      <main className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-2xl mx-auto bg-surface rounded-3xl border border-grey-200 p-8 sm:p-10 shadow-lg">
          <h1 className="font-serif text-4xl text-dark-primary tracking-tight mb-3">
            Thank you for letting us know
          </h1>
          <p className="text-grey-600 text-lg">
            The place has gone to the next family on the list. {offer.child_name} stays on the
            waiting list for other classes at {offer.club_name}. Get in touch if you would like us
            to look at this class again.
          </p>
        </div>
      </main>
    );
  }

  const alreadyAnswered = offer.status !== 'pending' || offer.expired;

  return (
    <main className="min-h-dvh bg-canvas p-6 sm:p-10">
      <div className="max-w-2xl mx-auto">
        <div className="bg-surface rounded-3xl border border-grey-200 p-6 sm:p-10 shadow-lg">
          <h1 className="font-serif text-4xl sm:text-6xl text-dark-primary tracking-tight mb-3">
            A place has come up
          </h1>
          <p className="text-grey-600 text-lg mb-8">
            {offer.club_name} has a place for {offer.child_name}
            {offer.squad_name ? ` in ${offer.squad_name}` : ''}.
          </p>

          {offer.training_times && (
            <div className="bg-dark-primary rounded-2xl p-6 mb-8">
              <p className="text-white/70 text-sm font-medium uppercase tracking-wider mb-2">
                Training times
              </p>
              <p className="text-white text-xl">{offer.training_times}</p>
            </div>
          )}

          {alreadyAnswered ? (
            <div className="rounded-xl border border-grey-200 bg-canvas p-6">
              <p className="text-dark-primary font-semibold mb-1">
                {offer.expired ? 'This offer has run out of time' : 'This offer has been answered'}
              </p>
              <p className="text-grey-600 text-sm">
                The place has gone to the next family on the list. {offer.child_name} stays on the
                waiting list. Contact {offer.club_name} if you would still like the place.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 rounded-xl border border-grey-200 bg-canvas p-4 mb-8">
                <CalendarClock className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-grey-600 text-sm">
                  We hold this place until{' '}
                  <span className="font-semibold text-dark-primary">
                    {new Date(offer.expires_at).toLocaleDateString('en-GB', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                  . After that it passes to the next family on the list.
                </p>
              </div>

              {actionError && (
                <div
                  role="alert"
                  className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-danger text-sm mb-6"
                >
                  {actionError}
                </div>
              )}

              {showDecline ? (
                <div className="space-y-4">
                  <label
                    className="block text-sm font-semibold text-dark-primary"
                    htmlFor="decline_reason"
                  >
                    Would you tell us why? (optional)
                  </label>
                  <textarea
                    id="decline_reason"
                    rows={3}
                    maxLength={1000}
                    className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-grey-200 bg-white text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                    value={declineReason}
                    onChange={(event) => setDeclineReason(event.target.value)}
                  />
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleDecline}
                      disabled={isDeclining}
                      className="flex-1 min-h-[48px] px-6 py-3 bg-dark-primary text-white rounded-button font-bold hover:bg-dark-primary/90 transition-all flex items-center justify-center gap-3 disabled:opacity-60"
                    >
                      {isDeclining ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <span>Turn down the place</span>
                      )}
                    </button>
                    <button
                      onClick={() => setShowDecline(false)}
                      disabled={isDeclining}
                      className="flex-1 min-h-[48px] px-6 py-3 bg-white text-dark-primary rounded-button font-bold border border-grey-200 hover:bg-grey-50 transition-all"
                    >
                      Back
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={handleAccept}
                    disabled={isAccepting}
                    className="w-full min-h-[48px] px-8 py-4 bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center gap-3 text-lg disabled:opacity-60"
                  >
                    {isAccepting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                        <span>Setting everything up...</span>
                      </>
                    ) : (
                      <span>Accept the place</span>
                    )}
                  </button>
                  <button
                    onClick={() => setShowDecline(true)}
                    disabled={isAccepting}
                    className="w-full min-h-[48px] px-6 py-3 text-grey-600 rounded-button font-semibold hover:text-dark-primary transition-all"
                  >
                    No thank you, not this time
                  </button>
                  <p className="text-grey-400 text-sm">
                    Accepting sets everything up in one step: the {MEMBER_NOUN_LOWER} record, a
                    place on the register, the consent forms and the Direct Debit for fees.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
