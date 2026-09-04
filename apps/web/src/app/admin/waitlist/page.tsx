'use client';

import { ClipboardList, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import Breadcrumb from '@/components/ui/Breadcrumb';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/empty-state';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useFormatters } from '@/hooks/useFormatters';
import {
  getWaitlistEntries,
  getWaitlistCount,
  processWaitlistDrips,
  type WaitlistEntry,
} from '@/lib/api/waitlist';

function DripIndicator({ sent }: { sent: boolean }) {
  return (
    <span
      className={`w-3 h-3 rounded-full inline-block ${sent ? 'bg-success' : 'bg-white/10'}`}
      title={sent ? 'Sent' : 'Not sent'}
    />
  );
}

export default function WaitlistPage() {
  const { formatDate } = useFormatters();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDripConfirm, setShowDripConfirm] = useState(false);
  const [isDripProcessing, setIsDripProcessing] = useState(false);

  async function loadData() {
    try {
      setIsLoading(true);
      setError(null);
      const [entriesData, countData] = await Promise.all([
        getWaitlistEntries(),
        getWaitlistCount(),
      ]);
      setEntries(entriesData);
      setCount(countData.count);
    } catch {
      setError('Failed to load waitlist data.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleProcessDrips() {
    try {
      setIsDripProcessing(true);
      const result = await processWaitlistDrips();
      toast.success(`${result.sent} drip ${result.sent === 1 ? 'email' : 'emails'} sent`);
      setShowDripConfirm(false);
      loadData();
    } catch {
      toast.error('Failed to process drips');
    } finally {
      setIsDripProcessing(false);
    }
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10 flex items-center justify-center">
          <LoadingSpinner message="Loading waitlist..." />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb items={[{ label: 'Admin', href: '/admin' }, { label: 'Waitlist' }]} />

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 mt-4">
            <div>
              <h1 className="font-serif text-4xl sm:text-5xl text-dark-primary tracking-tight">Waitlist</h1>
              <p className="text-grey-600 text-lg mt-1 tabular-nums">{count} total signups</p>
            </div>
            <button
              onClick={() => setShowDripConfirm(true)}
              className="w-full sm:w-auto px-6 py-3 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" /> Process Drips
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger/30 rounded-xl">
              <p className="text-danger text-sm">{error}</p>
              <button onClick={loadData} className="mt-2 min-h-[44px] text-sm text-brand hover:underline">Try again</button>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-dark-primary rounded-3xl p-6 border border-white/10">
              <p className="text-text-secondary text-sm">Total Signups</p>
              <p className="text-3xl font-bold text-lime mt-1 tabular-nums">{count}</p>
            </div>
            <div className="bg-dark-primary rounded-3xl p-6 border border-white/10">
              <p className="text-text-secondary text-sm">Confirmed</p>
              <p className="text-3xl font-bold text-white mt-1 tabular-nums">
                {entries.filter((e) => e.confirmationSentAt).length}
              </p>
            </div>
            <div className="bg-dark-primary rounded-3xl p-6 border border-white/10">
              <p className="text-text-secondary text-sm">All Drips Complete</p>
              <p className="text-3xl font-bold text-white mt-1 tabular-nums">
                {entries.filter((e) => e.drip3SentAt).length}
              </p>
            </div>
          </div>

          {/* Entries */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-4 sm:p-8 border border-white/10">
            {entries.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No waitlist entries yet"
                description="When people sign up via the marketing site, they will appear here."
              />
            ) : (
              <>
                {/* Mobile cards */}
                <div className="space-y-3 md:hidden">
                  {entries.map((entry) => (
                    <div key={entry.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-white font-medium">{entry.name || 'No name'}</p>
                        <span className="text-xs text-white/40">{formatDate(entry.createdAt)}</span>
                      </div>
                      <p className="text-sm text-text-secondary">{entry.email}</p>
                      {entry.clubName && (
                        <p className="text-xs text-white/50 mt-1">{entry.clubName}</p>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs text-white/40 mr-1">Drips:</span>
                        <DripIndicator sent={!!entry.confirmationSentAt} />
                        <DripIndicator sent={!!entry.drip1SentAt} />
                        <DripIndicator sent={!!entry.drip2SentAt} />
                        <DripIndicator sent={!!entry.drip3SentAt} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs text-white/50 border-b border-white/10">
                        <th className="pb-3 font-medium">Name</th>
                        <th className="pb-3 font-medium">Email</th>
                        <th className="pb-3 font-medium">Club</th>
                        <th className="pb-3 font-medium">Role</th>
                        <th className="pb-3 font-medium">Source</th>
                        <th className="pb-3 font-medium">Joined</th>
                        <th className="pb-3 font-medium text-center">Drips</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {entries.map((entry) => (
                        <tr key={entry.id} className="text-sm">
                          <td className="py-3 text-white font-medium">{entry.name || '-'}</td>
                          <td className="py-3 text-white/70">{entry.email}</td>
                          <td className="py-3 text-white/70">{entry.clubName || '-'}</td>
                          <td className="py-3 text-white/70">{entry.role || '-'}</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/60 border border-white/10">
                              {entry.source}
                            </span>
                          </td>
                          <td className="py-3 text-white/50">{formatDate(entry.createdAt)}</td>
                          <td className="py-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <DripIndicator sent={!!entry.confirmationSentAt} />
                              <DripIndicator sent={!!entry.drip1SentAt} />
                              <DripIndicator sent={!!entry.drip2SentAt} />
                              <DripIndicator sent={!!entry.drip3SentAt} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDripConfirm}
        onOpenChange={setShowDripConfirm}
        title="Process drip emails"
        description="This will send any pending drip emails to waitlist subscribers based on their signup date. Continue?"
        confirmLabel="Process Drips"
        onConfirm={handleProcessDrips}
        isLoading={isDripProcessing}
      />
    </MainLayout>
  );
}
