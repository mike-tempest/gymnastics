'use client';

import type { Family, Squad } from '@club-manager/shared-types';
import { ArrowLeft, Send, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import { sendMessage } from '@/lib/api/communications';
import { getFamilies } from '@/lib/api/families';
import { getSquads } from '@/lib/api/squads';

type RecipientType = 'all' | 'squad' | 'family';

export default function ComposeMessagePage() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientType, setRecipientType] = useState<RecipientType>('all');
  const [selectedSquad, setSelectedSquad] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(true);

  useEffect(() => {
    async function fetchRecipients() {
      setIsLoadingRecipients(true);
      try {
        const [squadsData, familiesData] = await Promise.all([
          getSquads(),
          getFamilies(),
        ]);
        setSquads(squadsData);
        setFamilies(familiesData);
      } catch {
        toast.error('Failed to load recipients');
      } finally {
        setIsLoadingRecipients(false);
      }
    }
    fetchRecipients();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sendMessage({
        subject,
        body,
        recipientType,
        squadId: selectedSquad || undefined,
        familyId: selectedFamily || undefined,
      });
      setShowSuccess(true);
      toast.success('Message sent successfully');
    } catch {
      toast.error('Failed to send message. Please try again.');
    }
  };

  const canSubmit =
    subject.trim() !== '' &&
    body.trim() !== '' &&
    (recipientType === 'all' ||
      (recipientType === 'squad' && selectedSquad !== '') ||
      (recipientType === 'family' && selectedFamily !== ''));

  if (showSuccess) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-3xl mx-auto">
            <div className="bg-dark-primary rounded-3xl shadow-lg p-8 sm:p-12 border border-white/10 text-center">
              <div className="flex justify-center mb-6">
                <CheckCircle className="w-16 h-16 text-brand" />
              </div>
              <h2 className="font-serif text-4xl text-dark-primary tracking-tight mb-4">Message Sent Successfully</h2>
              <p className="text-text-secondary text-lg mb-2">
                Your announcement has been sent to{' '}
                {recipientType === 'all'
                  ? 'all members'
                  : recipientType === 'squad'
                    ? squads.find((s) => s.squad_id === selectedSquad)?.squad_name
                    : families.find((f) => f.family_id === selectedFamily)?.family_name}
                .
              </p>
              <p className="text-text-secondary mb-8">
                Recipients will receive a notification shortly.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => {
                    setSubject('');
                    setBody('');
                    setRecipientType('all');
                    setSelectedSquad('');
                    setSelectedFamily('');
                    setShowSuccess(false);
                  }}
                  className="px-6 py-3 min-h-[48px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm"
                >
                  Compose Another
                </button>
                <Link
                  href="/communications"
                  className="px-6 py-3 min-h-[48px] bg-dark-primary/80 text-white rounded-button font-bold hover:bg-white/5 transition-all flex items-center justify-center"
                >
                  Back to Communications
                </Link>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <Link
                href="/communications"
                className="inline-flex items-center space-x-2 text-text-secondary hover:text-white transition-all mb-4 min-h-[48px]"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">Back to Communications</span>
              </Link>
              <h1 className="font-serif text-3xl sm:text-4xl text-dark-primary tracking-tight mb-1">Compose Message</h1>
              <p className="text-text-secondary text-lg">
                Send an announcement to your club members
              </p>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-6 sm:p-8 border border-white/10">
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                {/* Subject */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Subject <span className="text-brand">*</span>
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Pool closure notice"
                    className="w-full px-4 py-3 min-h-[48px] bg-white/5 text-white rounded-xl border border-white/10 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none placeholder:text-text-tertiary"
                  />
                </div>

                {/* Recipients */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Recipients <span className="text-brand">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <button
                      type="button"
                      onClick={() => setRecipientType('all')}
                      className={`px-4 py-3 min-h-[48px] rounded-xl font-semibold transition-all text-sm ${
                        recipientType === 'all'
                          ? 'bg-brand text-dark-primary'
                          : 'bg-white/5 text-text-secondary hover:text-white border border-white/10'
                      }`}
                    >
                      All Members
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecipientType('squad')}
                      className={`px-4 py-3 min-h-[48px] rounded-xl font-semibold transition-all text-sm ${
                        recipientType === 'squad'
                          ? 'bg-brand text-dark-primary'
                          : 'bg-white/5 text-text-secondary hover:text-white border border-white/10'
                      }`}
                    >
                      By Squad
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecipientType('family')}
                      className={`px-4 py-3 min-h-[48px] rounded-xl font-semibold transition-all text-sm ${
                        recipientType === 'family'
                          ? 'bg-brand text-dark-primary'
                          : 'bg-white/5 text-text-secondary hover:text-white border border-white/10'
                      }`}
                    >
                      By Family
                    </button>
                  </div>

                  {recipientType === 'squad' && (
                    <select
                      value={selectedSquad}
                      onChange={(e) => setSelectedSquad(e.target.value)}
                      disabled={isLoadingRecipients}
                      className="w-full px-4 py-3 min-h-[48px] bg-white/5 text-white rounded-xl border border-white/10 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none"
                    >
                      <option value="">
                        {isLoadingRecipients ? 'Loading squads...' : 'Select a squad'}
                      </option>
                      {squads.map((squad) => (
                        <option key={squad.squad_id} value={squad.squad_id}>
                          {squad.squad_name}
                        </option>
                      ))}
                    </select>
                  )}

                  {recipientType === 'family' && (
                    <select
                      value={selectedFamily}
                      onChange={(e) => setSelectedFamily(e.target.value)}
                      disabled={isLoadingRecipients}
                      className="w-full px-4 py-3 min-h-[48px] bg-white/5 text-white rounded-xl border border-white/10 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none"
                    >
                      <option value="">
                        {isLoadingRecipients ? 'Loading families...' : 'Select a family'}
                      </option>
                      {families.map((family) => (
                        <option key={family.family_id} value={family.family_id}>
                          {family.family_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Message Body */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Message <span className="text-brand">*</span>
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write your announcement here..."
                    rows={8}
                    className="w-full px-4 py-3 bg-white/5 text-white rounded-xl border border-white/10 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none resize-y placeholder:text-text-tertiary"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 mt-8 pt-6 border-t border-white/10">
                <Link
                  href="/communications"
                  className="w-full sm:w-auto px-6 py-3 min-h-[48px] bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all text-center"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`w-full sm:w-auto px-8 py-3 min-h-[48px] rounded-xl font-bold transition-all flex items-center justify-center space-x-2 ${
                    canSubmit
                      ? 'bg-brand text-dark-primary hover:bg-brand-light shadow-sm'
                      : 'bg-white/5 text-text-tertiary cursor-not-allowed'
                  }`}
                >
                  <span>Send Message</span>
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
