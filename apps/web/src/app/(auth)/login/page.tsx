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
import { login } from '@/lib/api/auth';
import { acceptInvite } from '@/lib/api/families';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const inviteToken = searchParams.get('invite');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError('');

    try {
      // Call the backend directly to get and store the access_token
      const backendResponse = await login({
        email: data.email,
        password: data.password,
      });
      storeBackendToken(backendResponse.access_token);

      // Establish NextAuth session (needed for middleware auth checks)
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError('Authentication session could not be established. Please try again.');
        return;
      }

      // Handle invite token if present
      if (inviteToken) {
        try {
          await acceptInvite({
            token: inviteToken,
            userId: backendResponse.user.user_id,
          });
        } catch {
          // Continue even if invite acceptance fails
        }
        router.push('/parent');
        router.refresh();
        return;
      }

      // Redirect based on role from API response (no need to wait for NextAuth session)
      const userRole = backendResponse.user.role;

      if (userRole === 'parent' || userRole === 'PARENT') {
        router.push('/parent');
      } else {
        router.push('/');
      }
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  return (
    <>
      <div className="bg-dark-primary rounded-3xl shadow-lg p-6 sm:p-10">
        {/* Logo and Header */}
        <div className="text-center mb-6 sm:mb-10">
          <Image src="/swimly-logo.svg" alt="Swimly" width={200} height={64} className="h-16 w-auto mx-auto mb-6" priority />
          <p className="text-white/70 text-lg">Sign in to your account</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-danger/20 border border-danger/30 rounded-button">
            <p className="text-sm text-danger font-semibold">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-bold text-white mb-3">
              Email Address
            </label>
            <input
              {...register('email')}
              type="email"
              id="email"
              autoComplete="email"
              className="w-full min-h-[48px] px-5 py-4 bg-white/10 border-2 border-white/20 rounded-button text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all text-base"
              placeholder="you@example.com"
              disabled={isSubmitting}
            />
            {errors.email && (
              <p className="mt-2 text-sm text-danger font-semibold">{errors.email.message}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-bold text-white mb-3">
              Password
            </label>
            <input
              {...register('password')}
              type="password"
              id="password"
              autoComplete="current-password"
              className="w-full min-h-[48px] px-5 py-4 bg-white/10 border-2 border-white/20 rounded-button text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all text-base"
              placeholder="Enter your password"
              disabled={isSubmitting}
            />
            {errors.password && (
              <p className="mt-2 text-sm text-danger font-semibold">{errors.password.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand text-dark-primary py-4 rounded-button font-bold hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-brand focus:ring-opacity-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center space-x-3 text-lg mt-8"
          >
            {isSubmitting ? (
              <span className="flex items-center space-x-3">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Signing in...</span>
              </span>
            ) : (
              <>
                <span>Sign In</span>
                <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Register Link */}
        <div className="mt-8 text-center">
          <p className="text-sm text-white/70">
            New to Swimly?{' '}
            <Link href="/register" className="font-bold text-brand-dark hover:text-brand transition-colors">
              Create an account
            </Link>
          </p>
          <p className="mt-3 text-sm text-white/70">
            Setting up a new club?{' '}
            <Link href="/create-club" className="font-bold text-brand-dark hover:text-brand transition-colors">
              Create one
            </Link>
          </p>
        </div>

        {/* Demo Credentials - only shown when NEXT_PUBLIC_DEMO_MODE is not explicitly "false" */}
        {process.env.NEXT_PUBLIC_DEMO_MODE !== 'false' && (
          <div className="mt-6 text-center">
            <p className="text-sm text-white/60 font-semibold">
              Demo:{' '}
              <span className="font-mono bg-white/10 px-3 py-1.5 rounded-button border border-white/20 text-white">
                admin@rtwmonson.co.uk
              </span>{' '}
              /{' '}
              <span className="font-mono bg-white/10 px-3 py-1.5 rounded-button border border-white/20 text-white">
                Demo2024!
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-grey-400">
        <p>2026 Swimly. All rights reserved.</p>
      </div>
    </>
  );
}
