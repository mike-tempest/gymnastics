'use client';

import { ORDERED_DISCIPLINES, DISCIPLINE_LABELS, SquadType } from '@club-manager/shared-types';
import { CheckCircle2, ClipboardList, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  getPublicClubDetails,
  joinWaitingList,
  type JoinWaitingListInput,
  type JoinWaitingListResult,
  type PublicClubDetails,
} from '@/lib/api/waiting-list';
import { MEMBER_NOUN, MEMBER_NOUN_LOWER } from '@/lib/brand';

/**
 * The club's public waiting list page (TEM-22).
 *
 * No account, no login: a parent lands here from the club's own website or a
 * poster in the foyer, fills this in, and is on the list. Everything else,
 * family, member record, register place, consents and the Direct Debit, is
 * created only when a place actually comes up and they accept it.
 */

const EMPTY_FORM = {
  child_first_name: '',
  child_last_name: '',
  child_dob: '',
  child_gender: '',
  parent_name: '',
  parent_email: '',
  parent_phone: '',
  desired_discipline: '',
  desired_squad_type: '',
  preferred_squad_id: '',
  notes: '',
};

type FormState = typeof EMPTY_FORM;

const FIELD_CLASSES =
  'w-full min-h-[48px] px-4 py-3 rounded-xl border border-grey-200 bg-white text-dark-primary ' +
  'placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand';

const LABEL_CLASSES = 'block text-sm font-semibold text-dark-primary mb-2';

export default function JoinWaitingListPage({ params }: { params: { clubSlug: string } }) {
  const [club, setClub] = useState<PublicClubDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<JoinWaitingListResult | null>(null);

  const loadClub = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      setClub(await getPublicClubDetails(params.clubSlug));
    } catch {
      setLoadError('We could not find that club. Check the link and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [params.clubSlug]);

  useEffect(() => {
    void loadClub();
  }, [loadClub]);

  const setField = (field: keyof FormState) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const payload: JoinWaitingListInput = {
        child_first_name: form.child_first_name.trim(),
        child_last_name: form.child_last_name.trim(),
        child_dob: form.child_dob,
        child_gender: form.child_gender,
        parent_name: form.parent_name.trim(),
        parent_email: form.parent_email.trim(),
        ...(form.parent_phone.trim() ? { parent_phone: form.parent_phone.trim() } : {}),
        ...(form.desired_discipline
          ? { desired_discipline: form.desired_discipline as JoinWaitingListInput['desired_discipline'] }
          : {}),
        ...(form.desired_squad_type
          ? { desired_squad_type: form.desired_squad_type as SquadType }
          : {}),
        ...(form.preferred_squad_id ? { preferred_squad_id: form.preferred_squad_id } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      };
      setResult(await joinWaitingList(params.clubSlug, payload));
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'We could not add you to the list. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-dvh bg-canvas flex items-center justify-center p-6">
        <LoadingSpinner message="Loading..." size="lg" />
      </main>
    );
  }

  if (loadError || !club) {
    return (
      <main className="min-h-dvh bg-canvas flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-surface rounded-3xl border border-grey-200 p-8">
          <ErrorState message={loadError ?? 'Club not found'} onRetry={loadClub} />
        </div>
      </main>
    );
  }

  if (result) {
    return (
      <main className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-2xl mx-auto">
          <div className="bg-surface rounded-3xl border border-grey-200 p-8 sm:p-10 shadow-lg">
            <div className="w-14 h-14 rounded-2xl bg-brand/20 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-7 h-7 text-brand" aria-hidden="true" />
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl text-dark-primary tracking-tight mb-3">
              {result.already_on_list
                ? `${form.child_first_name} is already on the list`
                : `${form.child_first_name} is on the waiting list`}
            </h1>
            <p className="text-grey-600 text-lg mb-8">
              {result.already_on_list
                ? `We already had this ${MEMBER_NOUN_LOWER} down for a place at ${result.club_name}, so nothing has been added twice.`
                : `Thank you. ${result.club_name} has your details.`}
            </p>

            <div className="bg-dark-primary rounded-2xl p-6 mb-8">
              <p className="text-white/70 text-sm font-medium uppercase tracking-wider mb-2">
                Current position
              </p>
              <p className="text-white text-6xl font-serif tabular-nums">{result.position}</p>
            </div>

            <h2 className="font-serif text-2xl text-dark-primary mb-4">What happens next</h2>
            <ol className="space-y-4 text-grey-600 list-decimal list-inside">
              <li>
                When a place comes up in a suitable class, we email you an offer. Families already
                at the club and siblings of current {MEMBER_NOUN_LOWER}s are offered places first.
              </li>
              <li>
                The email holds the place for you for a set number of days. Accept it from the link
                and the place is yours.
              </li>
              <li>
                Accepting sets everything up in one step: the {MEMBER_NOUN_LOWER} record, a place on
                the register, the consent forms and the Direct Debit for fees.
              </li>
              <li>
                If the offer runs out of time, the place goes to the next family and{' '}
                {form.child_first_name} stays on the list.
              </li>
            </ol>

            <p className="text-grey-400 text-sm mt-8">
              Your position can change: it is not simply first come, first served. Contact{' '}
              {result.club_name} if anything changes at your end.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-canvas p-6 sm:p-10">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="w-12 h-12 rounded-2xl bg-brand/20 flex items-center justify-center mb-5">
            <ClipboardList className="w-6 h-6 text-brand" aria-hidden="true" />
          </div>
          <h1 className="font-serif text-4xl sm:text-6xl text-dark-primary tracking-tight mb-3">
            Join the waiting list
          </h1>
          <p className="text-grey-600 text-lg">
            {club.club_name} keeps a waiting list for its classes. Add your child below and we will
            be in touch as soon as a place comes up. You do not need an account.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface rounded-3xl border border-grey-200 p-6 sm:p-8 shadow-lg space-y-8"
        >
          <fieldset className="space-y-5">
            <legend className="font-serif text-2xl text-dark-primary mb-4">
              About the {MEMBER_NOUN_LOWER}
            </legend>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={LABEL_CLASSES} htmlFor="child_first_name">
                  First name
                </label>
                <input
                  id="child_first_name"
                  className={FIELD_CLASSES}
                  required
                  maxLength={100}
                  value={form.child_first_name}
                  onChange={(event) => setField('child_first_name')(event.target.value)}
                />
              </div>
              <div>
                <label className={LABEL_CLASSES} htmlFor="child_last_name">
                  Last name
                </label>
                <input
                  id="child_last_name"
                  className={FIELD_CLASSES}
                  required
                  maxLength={100}
                  value={form.child_last_name}
                  onChange={(event) => setField('child_last_name')(event.target.value)}
                />
              </div>
              <div>
                <label className={LABEL_CLASSES} htmlFor="child_dob">
                  Date of birth
                </label>
                <input
                  id="child_dob"
                  type="date"
                  className={FIELD_CLASSES}
                  required
                  value={form.child_dob}
                  onChange={(event) => setField('child_dob')(event.target.value)}
                />
                <p className="text-grey-400 text-xs mt-2">
                  Classes have age ranges, so we need this to know which ones fit.
                </p>
              </div>
              <div>
                <label className={LABEL_CLASSES} htmlFor="child_gender">
                  Gender
                </label>
                <select
                  id="child_gender"
                  className={FIELD_CLASSES}
                  required
                  value={form.child_gender}
                  onChange={(event) => setField('child_gender')(event.target.value)}
                >
                  <option value="">Please choose</option>
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-5">
            <legend className="font-serif text-2xl text-dark-primary mb-4">
              How we reach you
            </legend>

            <div>
              <label className={LABEL_CLASSES} htmlFor="parent_name">
                Your name
              </label>
              <input
                id="parent_name"
                className={FIELD_CLASSES}
                required
                maxLength={200}
                value={form.parent_name}
                onChange={(event) => setField('parent_name')(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={LABEL_CLASSES} htmlFor="parent_email">
                  Email address
                </label>
                <input
                  id="parent_email"
                  type="email"
                  className={FIELD_CLASSES}
                  required
                  maxLength={255}
                  value={form.parent_email}
                  onChange={(event) => setField('parent_email')(event.target.value)}
                />
                <p className="text-grey-400 text-xs mt-2">
                  Offers of a place come to this address, so use one you check.
                </p>
              </div>
              <div>
                <label className={LABEL_CLASSES} htmlFor="parent_phone">
                  Phone number (optional)
                </label>
                <input
                  id="parent_phone"
                  type="tel"
                  className={FIELD_CLASSES}
                  maxLength={20}
                  value={form.parent_phone}
                  onChange={(event) => setField('parent_phone')(event.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-5">
            <legend className="font-serif text-2xl text-dark-primary mb-2">
              What you are looking for
            </legend>
            <p className="text-grey-600 text-sm mb-4">
              All optional. Leave anything blank and we will consider every class with a free place.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={LABEL_CLASSES} htmlFor="desired_squad_type">
                  Kind of class
                </label>
                <select
                  id="desired_squad_type"
                  className={FIELD_CLASSES}
                  value={form.desired_squad_type}
                  onChange={(event) => setField('desired_squad_type')(event.target.value)}
                >
                  <option value="">No preference</option>
                  <option value={SquadType.RECREATIONAL}>Recreational</option>
                  <option value={SquadType.COMPETITIVE}>Competitive</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLASSES} htmlFor="desired_discipline">
                  Discipline
                </label>
                <select
                  id="desired_discipline"
                  className={FIELD_CLASSES}
                  value={form.desired_discipline}
                  onChange={(event) => setField('desired_discipline')(event.target.value)}
                >
                  <option value="">No preference</option>
                  {ORDERED_DISCIPLINES.map((discipline) => (
                    <option key={discipline} value={discipline}>
                      {DISCIPLINE_LABELS[discipline]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {club.squads.length > 0 && (
              <div>
                <label className={LABEL_CLASSES} htmlFor="preferred_squad_id">
                  A particular class
                </label>
                <select
                  id="preferred_squad_id"
                  className={FIELD_CLASSES}
                  value={form.preferred_squad_id}
                  onChange={(event) => setField('preferred_squad_id')(event.target.value)}
                >
                  <option value="">Any class that suits</option>
                  {club.squads.map((squad) => (
                    <option key={squad.squad_id} value={squad.squad_id}>
                      {squad.squad_name}
                    </option>
                  ))}
                </select>
                <p className="text-grey-400 text-xs mt-2">
                  Naming one class means you will only be offered that class, which can mean a
                  longer wait.
                </p>
              </div>
            )}

            <div>
              <label className={LABEL_CLASSES} htmlFor="notes">
                Anything we should know (optional)
              </label>
              <textarea
                id="notes"
                rows={4}
                maxLength={2000}
                className={FIELD_CLASSES}
                placeholder="Previous experience, days that do not work, anything else"
                value={form.notes}
                onChange={(event) => setField('notes')(event.target.value)}
              />
            </div>
          </fieldset>

          {submitError && (
            <div
              role="alert"
              className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-danger text-sm"
            >
              {submitError}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[48px] px-8 py-4 bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center gap-3 text-lg disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  <span>Adding to the list...</span>
                </>
              ) : (
                <span>Join the waiting list</span>
              )}
            </button>
            <p className="text-grey-400 text-xs mt-4">
              {club.club_name} uses these details only to contact you about a place. The{' '}
              {MEMBER_NOUN} record, consent forms and payment details are set up later, and only if
              you accept a place.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
