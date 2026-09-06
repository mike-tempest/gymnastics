'use client';

import { Family } from '@club-manager/shared-types';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { verifyInviteToken, acceptInvite } from '@/lib/api/families';
import { BRAND } from '@/lib/brand';

export default function InviteAcceptancePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [family, setFamily] = useState<Family | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await verifyInviteToken(params.token);

        if (result.valid && result.family) {
          setIsValid(true);
          setFamily(result.family);
        } else {
          setIsValid(false);
          setError('This invitation link is invalid or has expired.');
        }
      } catch {
        setError('Failed to verify invitation. Please try again.');
        setIsValid(false);
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [params.token]);

  const handleAcceptInvitation = async () => {
    if (!session) {
      router.push(`/register?invite=${params.token}`);
      return;
    }

    try {
      setIsAccepting(true);
      setError(null);
      await acceptInvite({
        token: params.token,
        userId: (session.user as { id?: string })?.id,
      });
      router.push('/parent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
      setIsAccepting(false);
    }
  };

  if (isLoading || status === 'loading') {
    return (
      <div className="min-h-dvh bg-canvas flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="bg-dark-primary rounded-3xl shadow-card p-10 border border-white/10">
            <LoadingSpinner message="Verifying invitation..." size="md" />
          </div>
        </div>
      </div>
    );
  }

  if (!isValid || !family) {
    return (
      <div className="min-h-dvh bg-canvas flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="bg-dark-primary rounded-3xl shadow-card p-10 border border-white/10 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-danger/20 rounded-full mb-6">
              <svg className="w-10 h-10 text-danger" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="font-serif text-4xl text-white tracking-tight mb-3">Invalid invitation</h2>
            <p className="text-grey-300 text-lg mb-6">
              {error || 'This invitation link is invalid or has expired.'}
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-8 py-4 min-h-[48px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-dark transition-all shadow-sm"
            >
              Go to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="bg-dark-primary rounded-3xl shadow-card p-10 border border-white/10">
          {/* Logo and Header */}
          <div className="text-center mb-10">
            <Image src="/swimly-logo.svg" alt="" width={200} height={64} className="h-16 w-auto mx-auto mb-6" />
            <p className="text-grey-300 text-lg">Parent invitation</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger/30 rounded-button">
              <p className="text-sm text-danger font-semibold">{error}</p>
            </div>
          )}

          {/* Family Information */}
          <div className="mb-8">
            <h2 className="font-serif text-2xl text-white tracking-tight mb-6">You have been invited to join</h2>
            
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6">
              <div className="mb-4">
                <p className="text-sm text-text-secondary mb-1">Family</p>
                <p className="text-2xl font-semibold text-white">{family.family_name}</p>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-text-secondary mb-1">Primary Contact</p>
                <p className="text-lg text-white">{family.primary_contact_name}</p>
                <p className="text-sm text-text-secondary">{family.primary_contact_email}</p>
              </div>

              {family.members && family.members.length > 0 && (
                <div>
                  <p className="text-sm text-text-secondary mb-2">Children</p>
                  <div className="space-y-2">
                    {family.members.map((member) => (
                      <div key={member.member_id} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-brand rounded-full"></div>
                        <p className="text-white">
                          {member.first_name} {member.last_name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            {!session ? (
              <>
                <p className="text-text-secondary text-sm mb-4">
                  To accept this invitation, please register for an account or sign in if you already have one.
                </p>
                <button
                  onClick={() => router.push(`/register?invite=${params.token}`)}
                  className="w-full min-h-[48px] bg-brand text-dark-primary py-4 rounded-button font-bold hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-brand focus:ring-opacity-50 transition-all shadow-sm flex items-center justify-center space-x-3 text-lg"
                >
                  <span>Register to accept</span>
                  <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
                <Link
                  href={`/login?invite=${params.token}`}
                  className="w-full flex items-center justify-center text-center px-8 py-4 min-h-[48px] bg-dark-primary/80 text-white rounded-button font-bold hover:bg-white/5 transition-all border border-white/10"
                >
                  I already have an account
                </Link>
              </>
            ) : (
              <button
                onClick={handleAcceptInvitation}
                disabled={isAccepting}
                className="w-full min-h-[48px] bg-brand text-dark-primary py-4 rounded-button font-bold hover:bg-brand-dark focus:outline-none focus:ring-4 focus:ring-brand focus:ring-opacity-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center space-x-3 text-lg"
              >
                {isAccepting ? (
                  <span className="flex items-center space-x-3">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Accepting...</span>
                  </span>
                ) : (
                  <>
                    <span>Accept invitation</span>
                    <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-text-tertiary">
          <p>{BRAND.copyright}</p>
        </div>
      </div>
    </div>
  );
}
