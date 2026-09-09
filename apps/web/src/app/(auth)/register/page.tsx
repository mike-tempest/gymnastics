'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { storeBackendToken } from '@/lib/api/api-client';
import { registerUser } from '@/lib/api/auth';
import { BRAND } from '@/lib/brand';

const registerSchema = z
  .object({
    first_name: z
      .string()
      .min(1, 'Please enter your first name')
      .max(100, 'First name must be under 100 characters'),
    last_name: z
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

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const inviteToken = searchParams.get('invite');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
  });

  const onSubmit = async (data: RegisterFormData) => {
    setError('');

    try {
      if (!inviteToken) return;

      const response = await registerUser({
        email: data.email,
        password: data.password,
        first_name: data.first_name,
        last_name: data.last_name,
        invite_token: inviteToken,
      });

      // Store the backend JWT
      storeBackendToken(response.access_token);

      setSuccess(true);

      // The backend has already linked the family and consumed the invitation.
      const session = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });
      if (session?.ok) router.push('/parent');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Registration failed. Please check your details and try again.'
      );
    }
  };

  if (!inviteToken) {
    return (
      <div className="bg-dark-primary rounded-3xl shadow-lg p-6 sm:p-10 text-white">
        <h1 className="font-serif text-3xl mb-4">Join your club</h1>
        <p className="text-white/70 mb-6">
          Parents and guardians need an invitation from their club to create an account. Ask your
          club for an invitation link.
        </p>
        <Link href="/create-club" className="flex min-h-[48px] items-center text-brand font-bold">
          Set up a new club
        </Link>
        <Link href="/login" className="flex min-h-[48px] items-center text-brand font-bold">
          Sign in to an existing account
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <>
        <div className="bg-dark-primary rounded-3xl shadow-lg p-6 sm:p-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-brand rounded-full mb-6 shadow-sm">
            <svg
              className="w-10 h-10 text-dark-primary"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-serif text-4xl text-white tracking-tight mb-3">Account Created</h2>
          <p className="text-white/70 text-lg mb-6">
            Your account is ready. Sign in if you are not redirected to your dashboard.
          </p>
          <Link
            href="/login"
            className="text-brand-dark hover:text-brand font-bold transition-colors"
          >
            Go to Sign In
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="bg-dark-primary rounded-3xl shadow-lg p-6 sm:p-10">
        {/* Logo and Header */}
        <div className="text-center mb-6 sm:mb-10">
          <Image
            src="/swimly-logo.svg"
            alt=""
            width={200}
            height={64}
            className="h-16 w-auto mx-auto mb-6"
            priority
          />
          <p className="text-white/70 text-lg">Create your account</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-danger/20 border border-danger/30 rounded-button">
            <p className="text-sm text-danger font-semibold">{error}</p>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Name Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="first_name" className="block text-sm font-bold text-white mb-2">
                First Name
              </label>
              <input
                {...register('first_name')}
                id="first_name"
                type="text"
                autoComplete="given-name"
                className="w-full min-h-[48px] px-4 py-3 bg-white/10 border-2 border-white/20 rounded-button text-white text-base placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all"
                placeholder="First name"
                disabled={isSubmitting}
              />
              {errors.first_name && (
                <p className="mt-2 text-sm text-danger font-semibold">
                  {errors.first_name.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="last_name" className="block text-sm font-bold text-white mb-2">
                Last Name
              </label>
              <input
                {...register('last_name')}
                id="last_name"
                type="text"
                autoComplete="family-name"
                className="w-full min-h-[48px] px-4 py-3 bg-white/10 border-2 border-white/20 rounded-button text-white text-base placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all"
                placeholder="Last name"
                disabled={isSubmitting}
              />
              {errors.last_name && (
                <p className="mt-2 text-sm text-danger font-semibold">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-bold text-white mb-2">
              Email Address
            </label>
            <input
              {...register('email')}
              id="email"
              type="email"
              autoComplete="email"
              className="w-full min-h-[48px] px-4 py-3 bg-white/10 border-2 border-white/20 rounded-button text-white text-base placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all"
              placeholder="you@example.com"
              disabled={isSubmitting}
            />
            {errors.email && (
              <p className="mt-2 text-sm text-danger font-semibold">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-bold text-white mb-2">
              Password
            </label>
            <input
              {...register('password')}
              id="password"
              type="password"
              autoComplete="new-password"
              className="w-full min-h-[48px] px-4 py-3 bg-white/10 border-2 border-white/20 rounded-button text-white text-base placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all"
              placeholder="Minimum 8 characters"
              disabled={isSubmitting}
            />
            {errors.password && (
              <p className="mt-2 text-sm text-danger font-semibold">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-bold text-white mb-2">
              Confirm Password
            </label>
            <input
              {...register('confirmPassword')}
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="w-full min-h-[48px] px-4 py-3 bg-white/10 border-2 border-white/20 rounded-button text-white text-base placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all"
              placeholder="Re-enter your password"
              disabled={isSubmitting}
            />
            {errors.confirmPassword && (
              <p className="mt-2 text-sm text-danger font-semibold">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand text-dark-primary py-4 rounded-button font-bold hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-brand focus:ring-opacity-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center space-x-3 text-lg mt-6"
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
                <span>Creating account...</span>
              </span>
            ) : (
              <>
                <span>Create Account</span>
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

        {/* Login Link */}
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
          <p className="mt-3 text-sm text-white/70">
            Setting up a new club?{' '}
            <Link
              href="/create-club"
              className="font-bold text-brand-dark hover:text-brand transition-colors"
            >
              Create one
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
