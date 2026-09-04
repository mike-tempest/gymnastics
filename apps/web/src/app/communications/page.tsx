'use client';

import { Mail, Send } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import RecipientBadge from '@/components/communications/RecipientBadge';
import MainLayout from '@/components/layout/MainLayout';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useFormatters } from '@/hooks/useFormatters';
import { api } from '@/lib/api/api-client';
import type { Communication } from '@/lib/api/communications';

export default function CommunicationsPage() {
  const { formatDate } = useFormatters();
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommunications = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<Communication[]>('/communications', { cache: 'no-store' });
      setCommunications(data);
    } catch {
      setError('Failed to load communications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunications();
  }, []);

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="font-serif text-3xl sm:text-4xl text-dark-primary tracking-tight mb-1">Communications</h1>
              <p className="text-text-secondary text-lg">Manage club announcements</p>
            </div>
            <Link
              href="/communications/compose"
              className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 min-h-[48px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-3 text-base sm:text-lg"
            >
              <span>Compose Message</span>
              <Send className="w-5 h-5 sm:w-6 sm:h-6" />
            </Link>
          </div>

          {/* Error */}
          {!isLoading && error && <ErrorState message={error} onRetry={fetchCommunications} />}

          {/* Content */}
          {!error && (
          <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10">
            {isLoading && (
              <div className="p-4 sm:p-8">
                <TableSkeleton />
              </div>
            )}

            {!isLoading && communications.length === 0 && (
              <EmptyState
                icon={Mail}
                title="No messages sent yet"
                description="Once you send an announcement, it will appear here so you can track what has been communicated to your club."
                actionLabel="Compose Message"
                actionHref="/communications/compose"
              />
            )}

            {!isLoading && communications.length > 0 && (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Subject</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Recipients</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-text-tertiary">Count</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-text-tertiary">Sent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {communications.map((comm) => (
                        <tr key={comm.communication_id} className="border-b border-white/5 last:border-b-0 hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <Link
                              href={`/communications/${comm.communication_id}`}
                              className="flex items-center min-h-[48px]"
                            >
                              <span className="font-semibold text-white hover:text-brand transition-colors">{comm.subject}</span>
                            </Link>
                          </td>
                          <td className="px-6 py-4">
                            <RecipientBadge communication={comm} />
                          </td>
                          <td className="px-6 py-4 text-right text-text-secondary tabular-nums">
                            {comm.recipient_count}
                          </td>
                          <td className="px-6 py-4 text-right text-text-secondary text-sm">
                            {formatDate(comm.sent_date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="sm:hidden divide-y divide-white/5">
                  {communications.map((comm) => (
                    <Link
                      key={comm.communication_id}
                      href={`/communications/${comm.communication_id}`}
                      className="block p-4 hover:bg-white/5 transition-colors min-h-[48px]"
                    >
                      <p className="font-semibold text-white mb-2">{comm.subject}</p>
                      <div className="flex items-center justify-between gap-3">
                        <RecipientBadge communication={comm} />
                        <div className="text-right">
                          <p className="text-text-secondary text-xs tabular-nums">{comm.recipient_count} recipients</p>
                          <p className="text-text-tertiary text-xs">{formatDate(comm.sent_date)}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
