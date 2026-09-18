'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/api-client';
import { requestPasswordReset } from '@/lib/api/password-recovery';
import { BRAND } from '@/lib/brand';

const schema = z.object({ email: z.string().trim().email('Enter a valid email address').max(254) });

export default function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const recovery = useMutation({ mutationFn: requestPasswordReset });

  return (
    <section
      className="rounded-3xl bg-white p-6 shadow-lg sm:p-10"
      aria-labelledby="recovery-title"
    >
      <p className="mb-2 font-semibold text-text-secondary">{BRAND.name}</p>
      <h1 id="recovery-title" className="text-2xl font-bold text-text-primary">
        Forgot your password?
      </h1>
      <p className="mt-3 text-text-secondary">
        Enter the email address you use to sign in. We will send you a link to choose a new
        password.
      </p>
      {recovery.isSuccess ? (
        <p role="status" className="mt-6 text-text-primary">
          {recovery.data.message}
        </p>
      ) : (
        <form
          onSubmit={handleSubmit((data) => recovery.mutate(data.email))}
          className="mt-6 space-y-4"
          noValidate
        >
          <label htmlFor="email" className="block font-semibold text-text-primary">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className="min-h-[48px] w-full rounded-button border border-grey-300 px-4 text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
            disabled={recovery.isPending}
          />
          {errors.email && (
            <p id="email-error" role="alert" className="text-coral">
              {errors.email.message}
            </p>
          )}
          {recovery.isError && (
            <p role="alert" className="text-coral">
              {recovery.error instanceof ApiError && recovery.error.status === 429
                ? 'Too many requests. Please wait 15 minutes before trying again.'
                : 'We could not process your request. Please try again.'}
            </p>
          )}
          <Button
            variant="brand"
            type="submit"
            className="min-h-[48px] w-full"
            disabled={recovery.isPending}
          >
            {recovery.isPending ? 'Requesting link...' : 'Send reset link'}
          </Button>
        </form>
      )}
      <Link
        href="/login"
        className="mt-6 inline-flex min-h-[48px] items-center text-text-primary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
      >
        Back to sign in
      </Link>
    </section>
  );
}
