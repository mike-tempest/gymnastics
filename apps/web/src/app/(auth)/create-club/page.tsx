'use client';

import {
  AU_STATES,
  COUNTRY_GOVERNING_BODIES,
  GoverningBody,
  defaultGoverningBodyForCountry,
  governingBodyConfig,
} from '@club-manager/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  signinAfterSignupFailed,
  signupFailed,
  signupStarted,
  signupSubmitted,
  signupSucceeded,
  type SignupFailureReason,
} from '@/lib/analytics';
import { storeBackendToken } from '@/lib/api/api-client';
import { registerClub } from '@/lib/api/auth';
import { BRAND } from '@/lib/brand';
import {
  countryName,
  countyLabel,
  SUPPORTED_COUNTRIES,
  timezonesForCountry,
  type SupportedCountry,
} from '@/lib/utils/region-labels';

// Supported club countries. The value is an ISO 3166-1 alpha-2 code sent to
// the backend; the label is what the admin sees in the dropdown. GB is the
// default to match Swimly's primary market. Codes and names come from the
// shared region-labels helpers so the two lists cannot drift apart.
const COUNTRY_OPTIONS = SUPPORTED_COUNTRIES.map((code) => ({
  value: code,
  label: countryName(code),
}));

// Per-country placeholder copy for the address and contact fields, so an
// Australian club is not prompted with a Yorkshire county and a UK phone number.
const COUNTY_PLACEHOLDERS: Record<SupportedCountry, string> = {
  GB: 'North Yorkshire',
  US: 'California',
  CA: 'Ontario',
  AU: 'New South Wales',
  IE: 'County Dublin',
};

const PHONE_PLACEHOLDERS: Record<SupportedCountry, string> = {
  GB: '01947 123456',
  US: '(555) 123-4567',
  CA: '(555) 123-4567',
  AU: '02 9123 4567',
  IE: '01 234 5678',
};

const EMAIL_PLACEHOLDERS: Record<SupportedCountry, string> = {
  GB: 'info@yourclub.co.uk',
  US: 'info@yourclub.com',
  CA: 'info@yourclub.com',
  AU: 'info@yourclub.com.au',
  IE: 'info@yourclub.ie',
};

const WEBSITE_PLACEHOLDERS: Record<SupportedCountry, string> = {
  GB: 'https://yourclub.co.uk',
  US: 'https://yourclub.com',
  CA: 'https://yourclub.com',
  AU: 'https://yourclub.com.au',
  IE: 'https://yourclub.ie',
};

const createClubSchema = z
  .object({
    // Club details
    clubName: z
      .string()
      .min(1, 'Please enter your club name')
      .max(255, 'Club name must be under 255 characters'),
    country: z.enum(SUPPORTED_COUNTRIES),
    timezone: z.string().max(64, 'Timezone must be under 64 characters').optional(),
    governingBody: z.nativeEnum(GoverningBody).optional(),
    swimEnglandRegion: z.string().max(255, 'Region must be under 255 characters').optional(),
    affiliateNumber: z
      .string()
      .max(255, 'Affiliate number must be under 255 characters')
      .optional(),
    county: z.string().max(255, 'County must be under 255 characters').optional(),
    clubContactEmail: z
      .string()
      .email('Please enter a valid club contact email address')
      .optional()
      .or(z.literal('')),
    clubPhone: z.string().max(50, 'Phone must be under 50 characters').optional(),
    website: z.string().max(512, 'Website must be under 512 characters').optional(),
    // Admin account
    firstName: z
      .string()
      .min(1, 'Please enter your first name')
      .max(100, 'First name must be under 100 characters'),
    lastName: z
      .string()
      .min(1, 'Please enter your last name')
      .max(100, 'Last name must be under 100 characters'),
    email: z
      .string()
      .min(1, 'Please enter your email address')
      .email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(128, 'Password must be under 128 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match. Please re-enter your password.',
    path: ['confirmPassword'],
  });

type CreateClubFormData = z.infer<typeof createClubSchema>;

export default function CreateClubPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateClubFormData>({
    resolver: zodResolver(createClubSchema),
    mode: 'onTouched',
    defaultValues: {
      country: 'GB',
    },
  });

  // Countries spanning several timezones get a timezone picker defaulting to
  // the country's first (most common) timezone. Single-timezone countries
  // send no timezone at all; the backend infers it from the country.
  const selectedCountry = watch('country');
  const timezoneOptions = timezonesForCountry(selectedCountry);
  const showTimezonePicker = timezoneOptions.length > 1;

  // Governing-body options follow the selected country. Countries with a
  // single body (everything except GB) hide the picker and use the default.
  const governingBodyOptions = COUNTRY_GOVERNING_BODIES[selectedCountry] ?? [
    GoverningBody.SWIM_ENGLAND,
  ];
  const showGoverningBodyPicker = governingBodyOptions.length > 1;
  const selectedGoverningBody = watch('governingBody');
  const effectiveGoverningBody =
    selectedGoverningBody && governingBodyOptions.includes(selectedGoverningBody)
      ? selectedGoverningBody
      : defaultGoverningBodyForCountry(selectedCountry);
  const governingBodyDetails = governingBodyConfig(effectiveGoverningBody);
  const isSwimEngland = effectiveGoverningBody === GoverningBody.SWIM_ENGLAND;
  // Australian clubs record their state or territory (stored as its code in
  // governing_body_region) instead of a free-text region.
  const isAustralia = selectedCountry === 'AU';

  useEffect(() => {
    const options = timezonesForCountry(selectedCountry);
    setValue('timezone', options.length > 1 ? options[0] : undefined);
  }, [selectedCountry, setValue]);

  // Reset the governing body to the country's default whenever the country
  // changes so a stale selection never persists across countries.
  useEffect(() => {
    setValue('governingBody', defaultGoverningBodyForCountry(selectedCountry));
  }, [selectedCountry, setValue]);

  // Fire once when a visitor lands on the signup form.
  useEffect(() => {
    signupStarted();
  }, []);

  const onSubmit = async (data: CreateClubFormData) => {
    setError('');
    signupSubmitted();

    try {
      const response = await registerClub({
        club: {
          name: data.clubName,
          country: data.country,
          timezone:
            timezonesForCountry(data.country).length > 1
              ? data.timezone || timezonesForCountry(data.country)[0]
              : undefined,
          // New governing-body DTO keys. Sent alongside the legacy keys below
          // so signup works against both the pre- and post-affiliation-backend.
          governing_body: data.governingBody || defaultGoverningBodyForCountry(data.country),
          governing_body_region: data.swimEnglandRegion || undefined,
          affiliation_number: data.affiliateNumber || undefined,
          // Legacy keys, kept until the affiliation-backend PR merges.
          swim_england_region: data.swimEnglandRegion || undefined,
          affiliate_number: data.affiliateNumber || undefined,
          county: data.county || undefined,
          contact_email: data.clubContactEmail || undefined,
          phone: data.clubPhone || undefined,
          website: data.website || undefined,
        },
        admin: {
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email,
          password: data.password,
        },
      });

      // Store the backend JWT (carries the new club_id).
      storeBackendToken(response.access_token);

      // The club is created at this point. Fire success regardless of whether
      // the follow-up signIn step works.
      signupSucceeded({
        club_id: response.user.club_id,
        has_affiliation: Boolean(data.affiliateNumber),
        has_region: Boolean(data.swimEnglandRegion),
      });

      // Establish the NextAuth session.
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        signinAfterSignupFailed();
        setError('Your club was created but we could not sign you in. Please sign in to continue.');
        return;
      }

      // Send the new admin into the onboarding wizard, scoped to their club.
      router.push('/onboarding');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      const reason = classifySignupFailure(message);
      signupFailed(reason);
      setError(
        message || 'We could not create your club. Please check your details and try again.'
      );
    }
  };

  // Map a backend error message to a controlled-vocabulary reason so that
  // PostHog funnels can group by failure mode rather than every unique string.
  function classifySignupFailure(message: string): SignupFailureReason {
    const lower = message.toLowerCase();
    if (lower.includes('email') && lower.includes('exist')) return 'email_taken';
    if (lower.includes('slug')) return 'slug_taken';
    if (lower.includes('valid') || lower.includes('400')) return 'validation';
    return 'server_error';
  }

  const fieldClass =
    'w-full min-h-[48px] px-4 py-3 bg-white/10 border-2 border-white/20 rounded-button text-white text-base placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all';
  const labelClass = 'block text-sm font-bold text-white mb-2';

  return (
    <>
      <div className="bg-dark-primary rounded-3xl shadow-lg p-6 sm:p-10">
        {/* Logo and Header */}
        <div className="text-center mb-6 sm:mb-10">
          <Image
            src="/tumblebase-logo.svg"
            alt={BRAND.name}
            width={200}
            height={64}
            className="h-16 w-auto mx-auto mb-6"
            priority
          />
          <p className="text-white/70 text-lg">Set up your club on {BRAND.name}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-danger/20 border border-danger/30 rounded-button">
            <p className="text-sm text-danger font-semibold">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Step 1: Club details */}
          <fieldset className="space-y-5">
            <legend className="font-serif text-2xl text-white tracking-tight mb-2">
              Your club
            </legend>
            <p className="text-sm text-white/60 mb-4">
              Tell us about your swimming club. You can change these details later in settings.
            </p>

            <div>
              <label htmlFor="clubName" className={labelClass}>
                Club name
              </label>
              <input
                {...register('clubName')}
                id="clubName"
                type="text"
                autoComplete="organization"
                className={fieldClass}
                placeholder="Whitby Seals Swimming Club"
                disabled={isSubmitting}
              />
              {errors.clubName && (
                <p className="mt-2 text-sm text-danger font-semibold">{errors.clubName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="country" className={labelClass}>
                Country
              </label>
              <div className="relative">
                <select
                  {...register('country')}
                  id="country"
                  autoComplete="country"
                  className={`${fieldClass} appearance-none pr-12`}
                  disabled={isSubmitting}
                >
                  {COUNTRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="text-dark-primary">
                      {option.label}
                    </option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {errors.country && (
                <p className="mt-2 text-sm text-danger font-semibold">{errors.country.message}</p>
              )}
            </div>

            {showTimezonePicker && (
              <div>
                <label htmlFor="timezone" className={labelClass}>
                  Timezone
                </label>
                <div className="relative">
                  <select
                    {...register('timezone')}
                    id="timezone"
                    className={`${fieldClass} appearance-none pr-12`}
                    disabled={isSubmitting}
                  >
                    {timezoneOptions.map((tz) => (
                      <option key={tz} value={tz} className="text-dark-primary">
                        {tz}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {errors.timezone && (
                  <p className="mt-2 text-sm text-danger font-semibold">
                    {errors.timezone.message}
                  </p>
                )}
              </div>
            )}

            {showGoverningBodyPicker && (
              <div>
                <label htmlFor="governingBody" className={labelClass}>
                  Governing body
                </label>
                <div className="relative">
                  <select
                    {...register('governingBody')}
                    id="governingBody"
                    className={`${fieldClass} appearance-none pr-12`}
                    disabled={isSubmitting}
                  >
                    {governingBodyOptions.map((body) => (
                      <option key={body} value={body} className="text-dark-primary">
                        {governingBodyConfig(body).label}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {errors.governingBody && (
                  <p className="mt-2 text-sm text-danger font-semibold">
                    {errors.governingBody.message}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="swimEnglandRegion" className={labelClass}>
                  {isAustralia ? 'State or territory' : 'Region'}{' '}
                  <span className="font-normal text-white/50">(optional)</span>
                </label>
                {isAustralia ? (
                  <div className="relative">
                    <select
                      {...register('swimEnglandRegion')}
                      id="swimEnglandRegion"
                      className={`${fieldClass} appearance-none pr-12`}
                      disabled={isSubmitting}
                    >
                      <option value="" className="text-dark-primary">
                        Select state or territory
                      </option>
                      {AU_STATES.map((state) => (
                        <option key={state.code} value={state.code} className="text-dark-primary">
                          {state.label}
                        </option>
                      ))}
                    </select>
                    <svg
                      className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                ) : isSwimEngland ? (
                  <div className="relative">
                    <select
                      {...register('swimEnglandRegion')}
                      id="swimEnglandRegion"
                      className={`${fieldClass} appearance-none pr-12`}
                      disabled={isSubmitting}
                    >
                      <option value="" className="text-dark-primary">
                        Select region
                      </option>
                      <option value="North" className="text-dark-primary">
                        North
                      </option>
                      <option value="South" className="text-dark-primary">
                        South
                      </option>
                      <option value="East" className="text-dark-primary">
                        East
                      </option>
                      <option value="West" className="text-dark-primary">
                        West
                      </option>
                      <option value="Midlands" className="text-dark-primary">
                        Midlands
                      </option>
                      <option value="London" className="text-dark-primary">
                        London
                      </option>
                      <option value="South West" className="text-dark-primary">
                        South West
                      </option>
                    </select>
                    <svg
                      className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                ) : (
                  <input
                    {...register('swimEnglandRegion')}
                    id="swimEnglandRegion"
                    type="text"
                    className={fieldClass}
                    placeholder="Region"
                    disabled={isSubmitting}
                  />
                )}
                {errors.swimEnglandRegion && (
                  <p className="mt-2 text-sm text-danger font-semibold">
                    {errors.swimEnglandRegion.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="county" className={labelClass}>
                  {countyLabel(selectedCountry)}{' '}
                  <span className="font-normal text-white/50">(optional)</span>
                </label>
                <input
                  {...register('county')}
                  id="county"
                  type="text"
                  className={fieldClass}
                  placeholder={COUNTY_PLACEHOLDERS[selectedCountry]}
                  disabled={isSubmitting}
                />
                {errors.county && (
                  <p className="mt-2 text-sm text-danger font-semibold">{errors.county.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="affiliateNumber" className={labelClass}>
                  Affiliate number <span className="font-normal text-white/50">(optional)</span>
                </label>
                <input
                  {...register('affiliateNumber')}
                  id="affiliateNumber"
                  type="text"
                  className={fieldClass}
                  placeholder={
                    isSwimEngland ? 'SE-12345' : governingBodyDetails.registrationNumberLabel
                  }
                  disabled={isSubmitting}
                />
                {errors.affiliateNumber && (
                  <p className="mt-2 text-sm text-danger font-semibold">
                    {errors.affiliateNumber.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="clubPhone" className={labelClass}>
                  Club phone <span className="font-normal text-white/50">(optional)</span>
                </label>
                <input
                  {...register('clubPhone')}
                  id="clubPhone"
                  type="tel"
                  autoComplete="tel"
                  className={fieldClass}
                  placeholder={PHONE_PLACEHOLDERS[selectedCountry]}
                  disabled={isSubmitting}
                />
                {errors.clubPhone && (
                  <p className="mt-2 text-sm text-danger font-semibold">
                    {errors.clubPhone.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="clubContactEmail" className={labelClass}>
                  Club contact email <span className="font-normal text-white/50">(optional)</span>
                </label>
                <input
                  {...register('clubContactEmail')}
                  id="clubContactEmail"
                  type="email"
                  className={fieldClass}
                  placeholder={EMAIL_PLACEHOLDERS[selectedCountry]}
                  disabled={isSubmitting}
                />
                {errors.clubContactEmail && (
                  <p className="mt-2 text-sm text-danger font-semibold">
                    {errors.clubContactEmail.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="website" className={labelClass}>
                  Website <span className="font-normal text-white/50">(optional)</span>
                </label>
                <input
                  {...register('website')}
                  id="website"
                  type="url"
                  autoComplete="url"
                  className={fieldClass}
                  placeholder={WEBSITE_PLACEHOLDERS[selectedCountry]}
                  disabled={isSubmitting}
                />
                {errors.website && (
                  <p className="mt-2 text-sm text-danger font-semibold">{errors.website.message}</p>
                )}
              </div>
            </div>
          </fieldset>

          {/* Step 2: Admin account */}
          <fieldset className="space-y-5 border-t border-white/10 pt-8">
            <legend className="font-serif text-2xl text-white tracking-tight mb-2">
              Your account
            </legend>
            <p className="text-sm text-white/60 mb-4">
              This is your club administrator account. You will use it to sign in and manage your
              club.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className={labelClass}>
                  First name
                </label>
                <input
                  {...register('firstName')}
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  className={fieldClass}
                  placeholder="First name"
                  disabled={isSubmitting}
                />
                {errors.firstName && (
                  <p className="mt-2 text-sm text-danger font-semibold">
                    {errors.firstName.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="lastName" className={labelClass}>
                  Last name
                </label>
                <input
                  {...register('lastName')}
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  className={fieldClass}
                  placeholder="Last name"
                  disabled={isSubmitting}
                />
                {errors.lastName && (
                  <p className="mt-2 text-sm text-danger font-semibold">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>
                Email address
              </label>
              <input
                {...register('email')}
                id="email"
                type="email"
                autoComplete="email"
                className={fieldClass}
                placeholder="you@example.com"
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className="mt-2 text-sm text-danger font-semibold">{errors.email.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="password" className={labelClass}>
                  Password
                </label>
                <input
                  {...register('password')}
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  className={fieldClass}
                  placeholder="Minimum 8 characters"
                  disabled={isSubmitting}
                />
                {errors.password && (
                  <p className="mt-2 text-sm text-danger font-semibold">
                    {errors.password.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="confirmPassword" className={labelClass}>
                  Confirm password
                </label>
                <input
                  {...register('confirmPassword')}
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className={fieldClass}
                  placeholder="Re-enter your password"
                  disabled={isSubmitting}
                />
                {errors.confirmPassword && (
                  <p className="mt-2 text-sm text-danger font-semibold">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>
          </fieldset>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand text-dark-primary py-4 rounded-button font-bold hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-brand focus:ring-opacity-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center space-x-3 text-lg"
          >
            {isSubmitting ? (
              <span className="flex items-center space-x-3">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Creating your club...</span>
              </span>
            ) : (
              <>
                <span>Create club</span>
                <svg
                  className="w-6 h-6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Sign-in link */}
        <div className="mt-8 text-center">
          <p className="text-sm text-white/70">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-bold text-brand-dark hover:text-brand transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-grey-400">
        <p>{BRAND.copyright}</p>
      </div>
    </>
  );
}
