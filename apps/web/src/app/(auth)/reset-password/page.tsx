'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { ApiError, clearBackendToken } from '@/lib/api/api-client';
import { resetPassword } from '@/lib/api/password-recovery';
import { BRAND } from '@/lib/brand';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(72, 'Use no more than 72 characters')
      .refine(
        (value) => new TextEncoder().encode(value).length <= 72,
        'Use a shorter password: the maximum is 72 bytes'
      ),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match',
  });

export default function ResetPasswordPage() {
  const token = useRef('');
  const [ready, setReady] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  useEffect(() => {
    // Retain the link only in this page's memory, never in storage or analytics.
    const fragment = window.location.hash.slice(1);
    if (fragment) token.current = /^[a-f0-9]{64}$/.test(fragment) ? fragment : '';
    window.history.replaceState(window.history.state, '', window.location.pathname);
    setReady(true);
  }, []);
  const recovery = useMutation({
    mutationFn: (password: string) => resetPassword(token.current, password),
    onSuccess: () => {
      token.current = '';
      clearBackendToken();
      reset();
      // The server already revoked every old token. Clear this browser's cookie too.
      void signOut({ redirect: false }).catch(() => undefined);
    },
  });
  const invalid = ready && !token.current && !recovery.isSuccess;

  return (
    <section className="rounded-3xl bg-white p-6 shadow-lg sm:p-10" aria-labelledby="reset-title">
      <p className="mb-2 font-semibold text-text-secondary">{BRAND.name}</p>
      <h1 id="reset-title" className="text-2xl font-bold text-text-primary">
        Choose a new password
      </h1>
      {recovery.isSuccess ? (
        <p role="status" className="mt-6 text-text-primary">
          Your password has been reset. Sign in with your new password.
        </p>
      ) : invalid ? (
        <p role="alert" className="mt-6 text-coral">
          This reset link is missing or invalid. Request a new link below.
        </p>
      ) : ready ? (
        <form
          onSubmit={handleSubmit((data) => recovery.mutate(data.password))}
          className="mt-6 space-y-4"
          noValidate
        >
          <p id="password-help" className="text-text-secondary">
            Use at least 8 characters. Resetting your password signs you out on all devices.
          </p>
          <label htmlFor="password" className="block font-semibold text-text-primary">
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
            aria-invalid={!!errors.password}
            aria-describedby="password-help password-error"
            className="min-h-[48px] w-full rounded-button border border-grey-300 px-4 text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
            disabled={recovery.isPending}
          />
          <p
            id="password-error"
            role={errors.password ? 'alert' : undefined}
            className="text-coral"
          >
            {errors.password?.message}
          </p>
          <label htmlFor="confirmPassword" className="block font-semibold text-text-primary">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword')}
            aria-invalid={!!errors.confirmPassword}
            aria-describedby="confirm-error"
            className="min-h-[48px] w-full rounded-button border border-grey-300 px-4 text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
            disabled={recovery.isPending}
          />
          <p
            id="confirm-error"
            role={errors.confirmPassword ? 'alert' : undefined}
            className="text-coral"
          >
            {errors.confirmPassword?.message}
          </p>
          {recovery.isError && (
            <p role="alert" className="text-coral">
              {recovery.error instanceof ApiError && recovery.error.status === 400
                ? 'This reset link is invalid or has expired. Request a new link below.'
                : recovery.error instanceof ApiError && recovery.error.status === 429
                  ? 'Too many attempts. Please wait 15 minutes before trying again.'
                  : 'We could not reset your password. Please try again.'}
            </p>
          )}
          <Button
            variant="brand"
            type="submit"
            className="min-h-[48px] w-full"
            disabled={recovery.isPending}
          >
            {recovery.isPending ? 'Resetting password...' : 'Reset password'}
          </Button>
        </form>
      ) : (
        <p role="status" className="mt-6 text-text-primary">
          Checking your link...
        </p>
      )}
      {!recovery.isSuccess && (
        <Link
          href="/forgot-password"
          className="mt-4 flex min-h-[48px] items-center text-text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
        >
          Request a new reset link
        </Link>
      )}
      <Link
        href="/login"
        className="mt-4 inline-flex min-h-[48px] items-center text-text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
      >
        Back to sign in
      </Link>
    </section>
  );
}
