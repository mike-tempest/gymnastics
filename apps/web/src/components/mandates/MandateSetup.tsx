'use client';

import { Loader2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useClubRegion } from '@/hooks/useClubRegion';
import { mandatesApi } from '@/lib/api/mandates';
import { directDebitScheme } from '@/lib/utils/direct-debit';
import { paymentMethodLabel } from '@/lib/utils/region-labels';


interface MandateSetupProps {
  familyId: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function MandateSetup({ familyId, onComplete: _onComplete, onCancel }: MandateSetupProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { country, club, isLoading: clubLoading } = useClubRegion();
  const scheme = directDebitScheme(country);
  const isBacs = scheme === 'bacs';
  const isBecs = scheme === 'becs';
  const methodLabel = paymentMethodLabel(country);
  // Stripe clubs use a Stripe-hosted page where the payer may authorise a
  // card OR a bank debit, so scheme-specific direct-debit copy (Direct Debit
  // Guarantee, DDR) may not apply. GoCardless and unknown providers keep
  // today's scheme-based copy unchanged.
  const isStripe = club?.payment_provider === 'stripe';
  // An explicit null from /clubs/me means the club has no active payment
  // connection: there is nothing to set up, so offering the flow would only
  // end in an error. Strictly null: an absent field (older API payloads) and
  // a still-loading or failed club fetch keep the existing behaviour, so this
  // never flashes while the club is loading.
  const paymentsNotSetUp = !clubLoading && club != null && club.payment_provider === null;

  const handleSetup = async () => {
    try {
      setLoading(true);
      setError(null);

      // Generate a unique session token for this setup flow
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Store session token and family ID in sessionStorage for when we return
      sessionStorage.setItem('gocardless_session_token', sessionToken);
      sessionStorage.setItem('gocardless_family_id', familyId);

      // Create the redirect flow
      const response = await mandatesApi.startSetup({
        family_id: familyId,
        session_token: sessionToken,
        success_redirect_url: `${window.location.origin}/mandates/complete`,
      });

      // Redirect to GoCardless
      window.location.href = response.redirect_url;
    } catch {
      setError(
        isStripe
          ? 'Failed to start payment setup. Please try again.'
          : `Failed to start ${methodLabel} setup. Please try again.`,
      );
      setLoading(false);
    }
  };

  if (paymentsNotSetUp) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Online payments are not available yet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-text-secondary">
            Your club has not set up online payments yet. You will be able to add a payment
            method here once they have. Contact the club if you have questions.
          </p>
          {onCancel && (
            <Button onClick={onCancel} variant="outline">
              Back
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif">
          {isStripe
            ? 'Set up automatic payments'
            : isBacs || isBecs
              ? 'Set Up Direct Debit'
              : `Set up your ${methodLabel} mandate`}
        </CardTitle>
        <CardDescription>
          {isStripe
            ? 'You will be taken to a secure Stripe page to set up your payment method. Depending on your club, you can pay by bank debit or card.'
            : isBacs
              ? 'Set up a Direct Debit mandate to enable automatic monthly payments for swim club fees.'
              : isBecs
                ? 'You will be asked to complete a Direct Debit Request to enable automatic monthly payments for swim club fees.'
                : `Set up your ${methodLabel} mandate to enable automatic monthly payments for swim club fees.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
            <p>Automatic monthly payments - no need to remember to pay</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
            <p>
              {isStripe
                ? 'Protected by your card scheme or bank debit scheme rules'
                : isBacs
                  ? 'Secure and protected by the Direct Debit Guarantee'
                  : isBecs
                    ? 'Secure and protected under the Bulk Electronic Clearing System (BECS) rules and the Direct Debit Request Service Agreement'
                    : "Secure and protected by your country's bank debit scheme rules"}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
            <p>Easy to cancel anytime if your circumstances change</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/40 rounded-md text-danger">
            <XCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="bg-brand/10 border border-brand/30 rounded-md p-4">
          <h4 className="font-medium text-brand mb-2">What happens next?</h4>
          {isStripe ? (
            <ol className="list-decimal list-inside space-y-1 text-sm text-brand/80">
              <li>You&apos;ll be securely redirected to Stripe</li>
              <li>Choose your payment method and enter your details</li>
              <li>Authorise automatic payments</li>
              <li>Return here to complete the setup</li>
            </ol>
          ) : (
            <ol className="list-decimal list-inside space-y-1 text-sm text-brand/80">
              <li>You&apos;ll be securely redirected to GoCardless</li>
              <li>Enter your bank account details</li>
              <li>Authorise the {methodLabel} mandate</li>
              <li>Return here to complete the setup</li>
            </ol>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSetup}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isStripe ? 'Redirecting to Stripe...' : 'Redirecting to GoCardless...'}
              </>
            ) : isStripe ? (
              'Continue to Stripe'
            ) : (
              'Continue to GoCardless'
            )}
          </Button>
          {onCancel && (
            <Button
              onClick={onCancel}
              disabled={loading}
              variant="outline"
            >
              Cancel
            </Button>
          )}
        </div>

        <p className="text-xs text-text-tertiary text-center">
          {isStripe
            ? 'Payments are processed securely through Stripe.'
            : isBacs
              ? 'Payments are processed securely through GoCardless, a UK regulated payment service provider.'
              : 'Payments are processed securely through GoCardless, a regulated payment service provider.'}
        </p>
      </CardContent>
    </Card>
  );
}

export function MandateSetupComplete() {
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
      const redirectFlowId = searchParams.get('redirect_flow_id');
      const sessionToken = sessionStorage.getItem('gocardless_session_token');
      const familyId = sessionStorage.getItem('gocardless_family_id');

      if (!redirectFlowId || !sessionToken || !familyId) {
        throw new Error('Missing required parameters');
      }

      await mandatesApi.completeSetup({
        redirect_flow_id: redirectFlowId,
        session_token: sessionToken,
        family_id: familyId,
      });

      // Clear session storage
      sessionStorage.removeItem('gocardless_session_token');
      sessionStorage.removeItem('gocardless_family_id');

      setSuccess(true);
    } catch {
      setError(`Failed to complete ${methodLabel} setup. Please try again.`);
    } finally {
      setLoading(false);
    }
  }, [searchParams, methodLabel]);

  useEffect(() => {
    completeSetup();
  }, [completeSetup]);

  if (loading) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="py-12">
          <LoadingSpinner message={`Completing your ${methodLabel} setup...`} size="lg" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="py-12">
          <ErrorState message={error} onRetry={completeSetup} />
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h2 className="font-serif text-2xl text-text-primary mb-2">{methodLabel} set up successfully</h2>
          <p className="text-sm text-text-secondary mb-6">
            Your {methodLabel} mandate is now active and ready for automatic payments.
          </p>
          <Button onClick={() => router.push('/')}>
            Return to Dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
