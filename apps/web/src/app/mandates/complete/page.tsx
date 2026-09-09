'use client';

import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect, useCallback } from 'react';

import MainLayout from '@/components/layout/MainLayout';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useClubRegion } from '@/hooks/useClubRegion';
import { mandatesApi } from '@/lib/api/mandates';
import { paymentMethodLabel } from '@/lib/utils/region-labels';

function MandateCompleteContent() {
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { country } = useClubRegion();
  const methodLabel = paymentMethodLabel(country);

  const completeSetup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // GoCardless returns the payer with ?redirect_flow_id=...; Stripe
      // Checkout substitutes ?session_id=... into the success URL. Either one
      // is the provider-side flow id the completion endpoint expects.
      const redirectFlowId = searchParams.get('redirect_flow_id') ?? searchParams.get('session_id');
      const sessionToken = sessionStorage.getItem('gocardless_session_token');
      const familyId = sessionStorage.getItem('gocardless_family_id');

      if (!redirectFlowId || !sessionToken || !familyId) {
        throw new Error(
          'Missing required parameters. Please start the mandate setup process again.'
        );
      }

      await mandatesApi.completeSetup({
        redirect_flow_id: redirectFlowId,
        session_token: sessionToken,
        family_id: familyId,
      });

      sessionStorage.removeItem('gocardless_session_token');
      sessionStorage.removeItem('gocardless_family_id');

      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to complete ${methodLabel} setup. Please try again.`
      );
    } finally {
      setLoading(false);
    }
  }, [searchParams, methodLabel]);

  useEffect(() => {
    completeSetup();
  }, [completeSetup]);

  if (loading) {
    return <LoadingSpinner message={`Completing your ${methodLabel} setup...`} size="lg" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={completeSetup} />;
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h2 className="font-serif text-2xl sm:text-3xl text-dark-primary mb-3">
          {methodLabel} set up successfully
        </h2>
        <p className="text-text-secondary text-base mb-8 max-w-md">
          Your {methodLabel} mandate is now active and ready for automatic payments.
        </p>
        <button
          onClick={() => router.push('/')}
          className="px-8 py-4 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-dark transition-all shadow-sm text-lg flex items-center gap-2"
        >
          Return to Dashboard
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return null;
}

export default function MandateCompletePage() {
  const { country } = useClubRegion();
  const methodLabel = paymentMethodLabel(country);
  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-serif text-4xl text-dark-primary mb-2">{methodLabel} setup</h1>
            <p className="text-grey-600 text-lg">Finalising your mandate with GoCardless</p>
          </div>

          <Suspense fallback={<LoadingSpinner message="Loading..." size="lg" />}>
            <MandateCompleteContent />
          </Suspense>
        </div>
      </div>
    </MainLayout>
  );
}
