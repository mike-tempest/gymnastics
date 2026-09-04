'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

import ProfileEditForm, { ProfileFormData } from '@/components/parent/ProfileEditForm';
import Breadcrumb from '@/components/ui/Breadcrumb';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { getParentProfile, updateParentProfile, ParentProfile } from '@/lib/api/parent';

type EmailFrequency = 'immediate' | 'daily' | 'weekly';

interface NotificationPreferences {
  emailFrequency: EmailFrequency;
  sessionReminders: boolean;
  invoiceNotifications: boolean;
  clubAnnouncements: boolean;
  smsEnabled: boolean;
}

const defaultPreferences: NotificationPreferences = {
  emailFrequency: 'immediate',
  sessionReminders: true,
  invoiceNotifications: true,
  clubAnnouncements: true,
  smsEnabled: false,
};

function ToggleSwitch({
  enabled,
  onToggle,
  label,
}: {
  enabled: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onToggle}
      className={`relative inline-flex h-7 w-12 min-h-[44px] min-w-[44px] items-center rounded-full transition-all ${
        enabled
          ? 'bg-brand shadow-glow-sm'
          : 'bg-white/5 border border-white/10'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    getParentProfile()
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load profile');
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleProfileSave = useCallback(async (data: ProfileFormData) => {
    try {
      const updatedFamily = await updateParentProfile(data);
      setProfile((prev) => prev ? { ...prev, family: updatedFamily } : prev);
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
      throw new Error('Save failed');
    }
  }, []);

  const updatePreference = useCallback(
    <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSave = useCallback(() => {
    setSaveMessage('Settings saved locally');
    const timer = setTimeout(() => setSaveMessage(null), 3000);
    return () => clearTimeout(timer);
  }, []);

  const activeEmailCount = [
    preferences.sessionReminders,
    preferences.invoiceNotifications,
    preferences.clubAnnouncements,
  ].filter(Boolean).length;

  const frequencyLabel =
    preferences.emailFrequency === 'immediate'
      ? 'Immediate'
      : preferences.emailFrequency === 'daily'
        ? 'Daily digest'
        : 'Weekly digest';

  return (
    <div className="min-h-dvh bg-canvas p-6 sm:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Breadcrumb items={[{ label: 'Parent Portal', href: '/parent' }, { label: 'Settings' }]} />
          <h1 className="font-serif text-4xl sm:text-5xl text-dark-primary tracking-tight mb-2">Notification settings</h1>
          <p className="text-text-secondary text-lg">
            Manage how and when you receive updates from the club.
          </p>
        </div>

        {/* Contact Details */}
        <div className="bg-dark-primary rounded-card shadow-card border border-white/10 mb-8">
          <div className="p-4 md:p-6 border-b border-white/10">
            <h2 className="font-serif text-2xl text-white">Contact details</h2>
            <p className="text-text-secondary text-sm mt-1">
              Update your family contact information and address.
            </p>
          </div>
          <div className="p-4 md:p-6">
            {profileLoading ? (
              <LoadingSpinner size="sm" message="Loading your details..." />
            ) : profile ? (
              <ProfileEditForm
                initialData={{
                  primary_contact_name: profile.family.primary_contact_name || '',
                  primary_contact_email: profile.family.primary_contact_email || '',
                  primary_contact_phone: profile.family.primary_contact_phone || '',
                  address_line1: profile.family.address_line1 || '',
                  address_line2: profile.family.address_line2 || '',
                  city: profile.family.city || '',
                  postcode: profile.family.postcode || '',
                }}
                onSave={handleProfileSave}
                isLoading={false}
              />
            ) : (
              <p className="text-text-tertiary py-8 text-center">
                Unable to load profile. Please try refreshing the page.
              </p>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-dark-primary rounded-card p-6 md:p-8 shadow-card border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-brand/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-brand" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-2">Active notifications</p>
            <p className="text-4xl font-bold text-brand tabular-nums">{activeEmailCount}</p>
          </div>

          <div className="bg-dark-primary rounded-card p-6 md:p-8 shadow-card border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-brand/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-brand" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-2">Email frequency</p>
            <p className="text-2xl font-bold text-brand">{frequencyLabel}</p>
          </div>

          <div className="bg-dark-primary rounded-card p-6 md:p-8 shadow-card border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-brand/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-brand" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-2">SMS status</p>
            <p className={`text-4xl font-bold ${preferences.smsEnabled ? 'text-brand' : 'text-text-tertiary'}`}>
              {preferences.smsEnabled ? 'On' : 'Off'}
            </p>
          </div>
        </div>

        {/* Email Notifications Card */}
        <div className="bg-dark-primary rounded-card shadow-card border border-white/10 mb-6">
          <div className="p-4 md:p-6 border-b border-white/10">
            <h2 className="font-serif text-2xl text-white">Email notifications</h2>
          </div>
          <div className="p-4 md:p-6 space-y-6">
            {/* Email Frequency Selector */}
            <div className="bg-white/5 rounded-2xl p-5">
              <p className="text-white font-semibold mb-1">Email frequency</p>
              <p className="text-text-tertiary text-sm mb-4">Choose how often you receive email notifications.</p>
              <div className="flex flex-wrap gap-3">
                {([
                  { value: 'immediate' as const, label: 'Immediate' },
                  { value: 'daily' as const, label: 'Daily digest' },
                  { value: 'weekly' as const, label: 'Weekly digest' },
                ]).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updatePreference('emailFrequency', option.value)}
                    className={`px-5 py-2.5 min-h-[44px] rounded-full font-semibold text-sm transition-all ${
                      preferences.emailFrequency === option.value
                        ? 'bg-brand text-dark-primary'
                        : 'bg-white/5 text-text-secondary hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Session Reminders Toggle */}
            <div className="bg-white/5 rounded-2xl p-5">
              <div className="flex justify-between items-start">
                <div className="mr-4">
                  <p className="text-white font-semibold">Session reminders</p>
                  <p className="text-text-tertiary text-sm mt-1">
                    Remind me before each training session.
                  </p>
                </div>
                <ToggleSwitch
                  enabled={preferences.sessionReminders}
                  onToggle={() => updatePreference('sessionReminders', !preferences.sessionReminders)}
                  label="Session reminders"
                />
              </div>
            </div>

            {/* Invoice Notifications Toggle */}
            <div className="bg-white/5 rounded-2xl p-5">
              <div className="flex justify-between items-start">
                <div className="mr-4">
                  <p className="text-white font-semibold">Invoice and payment notifications</p>
                  <p className="text-text-tertiary text-sm mt-1">
                    Receive notifications for new invoices and payment confirmations.
                  </p>
                </div>
                <ToggleSwitch
                  enabled={preferences.invoiceNotifications}
                  onToggle={() => updatePreference('invoiceNotifications', !preferences.invoiceNotifications)}
                  label="Invoice and payment notifications"
                />
              </div>
            </div>

            {/* Club Announcements Toggle */}
            <div className="bg-white/5 rounded-2xl p-5">
              <div className="flex justify-between items-start">
                <div className="mr-4">
                  <p className="text-white font-semibold">Club announcements</p>
                  <p className="text-text-tertiary text-sm mt-1">
                    General club news and updates.
                  </p>
                </div>
                <ToggleSwitch
                  enabled={preferences.clubAnnouncements}
                  onToggle={() => updatePreference('clubAnnouncements', !preferences.clubAnnouncements)}
                  label="Club announcements"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SMS Notifications Card */}
        <div className="bg-dark-primary rounded-card shadow-card border border-white/10 mb-6">
          <div className="p-4 md:p-6 border-b border-white/10">
            <h2 className="font-serif text-2xl text-white">SMS notifications</h2>
          </div>
          <div className="p-4 md:p-6">
            <div className="bg-white/5 rounded-2xl p-5">
              <div className="flex justify-between items-start">
                <div className="mr-4">
                  <p className="text-white font-semibold">Enable SMS notifications</p>
                  <p className="text-text-tertiary text-sm mt-1">
                    Receive important updates via text message. Message rates may apply. You can opt out at any time.
                  </p>
                </div>
                <ToggleSwitch
                  enabled={preferences.smsEnabled}
                  onToggle={() => updatePreference('smsEnabled', !preferences.smsEnabled)}
                  label="SMS notifications"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notification Summary Card */}
        <div className="bg-dark-primary rounded-card shadow-card border border-white/10 mb-8">
          <div className="p-4 md:p-6 border-b border-white/10">
            <h2 className="font-serif text-2xl text-white">Notification summary</h2>
          </div>
          <div className="p-4 md:p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                <span className="text-white font-medium">Email frequency</span>
                <span className="text-text-secondary">{frequencyLabel}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                <span className="text-white font-medium">Session reminders</span>
                <span className={preferences.sessionReminders ? 'text-brand' : 'text-text-tertiary'}>
                  {preferences.sessionReminders ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                <span className="text-white font-medium">Invoice notifications</span>
                <span className={preferences.invoiceNotifications ? 'text-brand' : 'text-text-tertiary'}>
                  {preferences.invoiceNotifications ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                <span className="text-white font-medium">Club announcements</span>
                <span className={preferences.clubAnnouncements ? 'text-brand' : 'text-text-tertiary'}>
                  {preferences.clubAnnouncements ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                <span className="text-white font-medium">SMS notifications</span>
                <span className={preferences.smsEnabled ? 'text-brand' : 'text-text-tertiary'}>
                  {preferences.smsEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-3 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-dark transition-all"
          >
            Save preferences
          </button>
          {saveMessage && (
            <span className="text-brand font-semibold">{saveMessage}</span>
          )}
        </div>
      </div>
    </div>
  );
}
