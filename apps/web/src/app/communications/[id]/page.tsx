'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import RecipientBadge from '@/components/communications/RecipientBadge';
import MainLayout from '@/components/layout/MainLayout';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useFormatters } from '@/hooks/useFormatters';
import { Communication, getCommunication } from '@/lib/api/communications';

export default function CommunicationDetailPage() {
  const params = useParams<{ id: string }>();
  const { formatDate } = useFormatters();
  const [communication, setCommunication] = useState<Communication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCommunication(params.id);
      setCommunication(data);
    } catch {
      setError('Failed to load this communication. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [params.id]);

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <Link
              href="/communications"
              className="inline-flex items-center space-x-2 text-text-secondary hover:text-white transition-all min-h-[48px]"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Communications</span>
            </Link>
          </div>

          {isLoading && <LoadingSpinner message="Loading communication..." />}

          {!isLoading && error && <ErrorState message={error} onRetry={fetchDetail} />}

          {!isLoading && !error && communication && (
            <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 p-6 sm:p-8">
              <h1 className="font-serif text-3xl sm:text-4xl text-white tracking-tight mb-6">
                {communication.subject}
              </h1>

              <div className="flex flex-wrap items-center gap-4 mb-8 pb-6 border-b border-white/10">
                <RecipientBadge communication={communication} />
                <span className="text-text-secondary text-sm">
                  {communication.recipient_count} {communication.recipient_count === 1 ? 'recipient' : 'recipients'}
                </span>
                <span className="text-text-tertiary text-sm">
                  Sent {formatDate(communication.sent_date)}
                </span>
              </div>

              <div className="whitespace-pre-wrap text-text-secondary leading-relaxed">
                {communication.body}
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
