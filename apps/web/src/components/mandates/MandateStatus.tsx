'use client';

import { DirectDebitMandate } from '@club-manager/shared-types';
import { Loader2, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useClubRegion } from '@/hooks/useClubRegion';
import { useFormatters } from '@/hooks/useFormatters';
import { mandatesApi } from '@/lib/api/mandates';
import { paymentMethodLabel } from '@/lib/utils/region-labels';

interface MandateStatusProps {
  familyId: string;
  onSetupClick?: () => void;
}

const getStatusColour = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-success text-dark-primary';
    case 'pending':
      return 'bg-warning text-dark-primary';
    case 'cancelled':
    case 'failed':
      return 'bg-danger text-white';
    default:
      return 'bg-grey-500 text-white';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'active':
      return <CheckCircle2 className="h-5 w-5 text-success" />;
    case 'pending':
      return <AlertCircle className="h-5 w-5 text-warning" />;
    case 'cancelled':
    case 'failed':
      return <XCircle className="h-5 w-5 text-danger" />;
    default:
      return null;
  }
};

export function MandateStatus({ familyId, onSetupClick }: MandateStatusProps) {
  const [mandate, setMandate] = useState<DirectDebitMandate | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { country } = useClubRegion();
  const { formatDate } = useFormatters();
  const isGB = country === 'GB';
  const methodLabel = paymentMethodLabel(country);

  const loadMandate = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await mandatesApi.getActiveByFamily(familyId);
      setMandate(data);
    } catch {
      setError(`Failed to load ${methodLabel} status`);
    } finally {
      setLoading(false);
    }
  }, [familyId, methodLabel]);

  const handleSync = async () => {
    if (!mandate) return;

    try {
      setSyncing(true);
      setError(null);
      const updated = await mandatesApi.syncStatus(mandate.mandate_id);
      setMandate(updated);
    } catch {
      setError('Failed to sync mandate status');
    } finally {
      setSyncing(false);
    }
  };

  const handleCancel = async () => {
    if (!mandate) return;

    if (
      !confirm(
        `Are you sure you want to cancel this ${methodLabel} mandate? This will stop all automatic payments.`
      )
    ) {
      return;
    }

    try {
      setCancelling(true);
      setError(null);
      await mandatesApi.cancel(mandate.mandate_id);
      await loadMandate(); // Reload to show updated status
    } catch {
      setError('Failed to cancel mandate');
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    loadMandate();
  }, [familyId, loadMandate]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <LoadingSpinner message="" size="sm" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <ErrorState message={error} onRetry={loadMandate} />
        </CardContent>
      </Card>
    );
  }

  if (!mandate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">{methodLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-text-secondary mb-4">
            No {methodLabel} mandate is set up for this family. Set up {methodLabel} to enable
            automatic monthly payments.
          </p>
          {onSetupClick && (
            <Button onClick={onSetupClick}>
              {isGB ? 'Set Up Direct Debit' : `Set up ${methodLabel}`}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-serif">{methodLabel}</CardTitle>
          <Badge className={getStatusColour(mandate.status)}>{mandate.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          {getStatusIcon(mandate.status)}
          <div className="flex-1">
            <h4 className="font-medium text-text-primary">Mandate Status</h4>
            <p className="text-sm text-text-secondary">
              {mandate.status === 'active' && `${methodLabel} is active and ready for payments`}
              {mandate.status === 'pending' && 'Waiting for mandate to be confirmed by the bank'}
              {mandate.status === 'cancelled' && 'This mandate has been cancelled'}
              {mandate.status === 'failed' && 'Mandate setup failed - please try again'}
            </p>
          </div>
        </div>

        <div className="border-t border-grey-200 pt-4 space-y-2 text-sm">
          {mandate.created_at && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Created:</span>
              <span className="font-medium text-text-primary tabular-nums">
                {formatDate(mandate.created_at, {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}
          {mandate.scheme && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Scheme:</span>
              <span className="font-medium uppercase text-text-primary">{mandate.scheme}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-4 border-t border-grey-200">
          <Button
            onClick={handleSync}
            disabled={syncing || mandate.status === 'cancelled'}
            variant="outline"
            size="sm"
          >
            {syncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Status
              </>
            )}
          </Button>

          {mandate.status === 'active' && (
            <Button onClick={handleCancel} disabled={cancelling} variant="destructive" size="sm">
              {cancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Cancel Mandate'
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
