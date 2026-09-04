'use client';

import {
  AU_STATES,
  COUNTRY_GOVERNING_BODIES,
  GoverningBody,
  defaultGoverningBodyForCountry,
  governingBodyConfig,
} from '@swim-nexus/shared-types';
import {
  Settings,
  Building2,
  Globe,
  MapPin,
  CreditCard,
  Bell,
  ExternalLink,
  Plus,
  Trash2,
  Upload,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import { PaymentsConnectionCard } from '@/components/settings/PaymentsConnectionCard';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useClubRegion } from '@/hooks/useClubRegion';
import {
  getClubSettings,
  updateClubSettings,
  type ClubSettingsData,
} from '@/lib/api/settings';

interface Location {
  id: string;
  name: string;
  address: string;
  laneCount: number;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const SECTION_CARD = 'mb-8 rounded-card bg-dark-primary border border-white/10 p-6 sm:p-8 shadow-card';
const SECTION_HEADING = 'font-serif text-2xl sm:text-3xl text-white';
const FIELD_LABEL = 'block text-sm font-medium text-white/70 mb-2';
const FIELD_INPUT =
  'w-full px-4 py-3 min-h-[44px] rounded-button bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand';
const SAVE_BUTTON =
  'flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-button font-semibold bg-brand text-dark-primary hover:bg-brand-dark transition-colors disabled:opacity-50';

// Conventional tax name per country, used only as a placeholder hint so admins
// know what to enter. Falls back to a neutral label for unlisted countries.
const TAX_NAME_HINT: Record<string, string> = {
  GB: 'VAT',
  US: 'Sales tax',
  CA: 'GST',
  AU: 'GST',
  IE: 'VAT',
};

// Label for the tax registration identifier field, following the same
// per-country pattern as TAX_NAME_HINT. Falls back to a neutral label.
const TAX_REGISTRATION_LABEL: Record<string, string> = {
  GB: 'VAT number',
  US: 'Tax registration number',
  CA: 'GST/HST number',
  AU: 'ABN',
  IE: 'VAT number',
};

// Conventional standard tax rate per country, used only as a placeholder hint.
const TAX_RATE_PLACEHOLDER: Record<string, string> = {
  GB: '20',
  CA: '5',
  AU: '10',
  IE: '23',
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  // Region State. The hook resolves the club's country, currency and
  // timezone options, falling back to GB defaults when the backend does not
  // return regional fields yet.
  const clubRegion = useClubRegion();
  const [timezone, setTimezone] = useState('');

  // Club Details State
  const [clubName, setClubName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');

  // Governing body affiliation State. The governing body drives which region
  // control and heading are shown; it defaults to the club country's primary
  // body until the club has saved a choice.
  const [governingBody, setGoverningBody] = useState<string>('');
  const [affiliationNumber, setAffiliationNumber] = useState('');
  const [region, setRegion] = useState('');
  const [county, setCounty] = useState('');

  // Session Locations State
  const [locations, setLocations] = useState<Location[]>([]);
  const [newLocation, setNewLocation] = useState({ name: '', address: '', laneCount: 6 });
  const [isAddingLocation, setIsAddingLocation] = useState(false);

  // Tax State. Empty strings mean "no tax configured"; saved as null so the
  // backend clears the columns and invoices are issued without tax.
  const [taxRate, setTaxRate] = useState('');
  const [taxLabel, setTaxLabel] = useState('');
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [taxRegistrationNumber, setTaxRegistrationNumber] = useState('');

  // Notifications State
  const [notifyNewMember, setNotifyNewMember] = useState(true);
  const [notifyPaymentReceived, setNotifyPaymentReceived] = useState(true);
  const [notifyAttendanceAlerts, setNotifyAttendanceAlerts] = useState(false);

  const populateFromData = useCallback((data: ClubSettingsData) => {
    setClubName(data.club_name || '');
    setContactEmail(data.contact_email || '');
    setPhone(data.phone || '');
    setWebsite(data.website || '');

    setTimezone(data.timezone || '');

    // Prefer the new top-level affiliation fields; fall back to the legacy
    // swim_england JSONB so the page works before the affiliation-backend PR.
    setGoverningBody(data.governing_body || '');
    setAffiliationNumber(data.affiliation_number || data.swim_england?.affiliationNumber || '');
    setRegion(data.governing_body_region || data.swim_england?.region || '');
    setCounty(data.swim_england?.county || '');

    setLocations(data.locations || []);

    setTaxRate(data.tax_rate != null ? String(data.tax_rate) : '');
    setTaxLabel(data.tax_label || '');
    setTaxInclusive(data.tax_inclusive ?? false);
    setTaxRegistrationNumber(data.tax_registration_number || '');

    setNotifyNewMember(data.notification_prefs?.notifyNewMember ?? true);
    setNotifyPaymentReceived(data.notification_prefs?.notifyPaymentReceived ?? true);
    setNotifyAttendanceAlerts(data.notification_prefs?.notifyAttendanceAlerts ?? false);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const data = await getClubSettings();
        populateFromData(data);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [populateFromData]);

  // Governing bodies available in the club's country. GB clubs can choose
  // between Swim England, Scottish Swimming and Swim Wales; every other
  // supported country has a single body.
  const governingBodyOptions = COUNTRY_GOVERNING_BODIES[clubRegion.country] ?? [
    GoverningBody.SWIM_ENGLAND,
  ];
  // The effective body is the saved choice when it is valid for the country,
  // otherwise the country's default. This keeps the heading and controls
  // sensible before any body has been saved.
  const effectiveGoverningBody =
    governingBody && governingBodyOptions.includes(governingBody as GoverningBody)
      ? (governingBody as GoverningBody)
      : defaultGoverningBodyForCountry(clubRegion.country);
  const governingBodyLabel = governingBodyConfig(effectiveGoverningBody).label;
  const isSwimEngland = effectiveGoverningBody === GoverningBody.SWIM_ENGLAND;
  // Australian clubs record their state or territory (stored as its code in
  // governing_body_region) instead of a free-text region.
  const isAustralia = clubRegion.country === 'AU';

  const showSaveResult = (status: 'saved' | 'error', message: string) => {
    setSaveStatus(status);
    setSaveMessage(message);
    if (status === 'saved') {
      toast.success(message);
    } else {
      toast.error(message);
    }
    setTimeout(() => {
      setSaveStatus('idle');
      setSaveMessage('');
    }, 3000);
  };

  const handleSaveClubDetails = async () => {
    try {
      setSaveStatus('saving');
      const data = await updateClubSettings({
        club_name: clubName,
        contact_email: contactEmail,
        phone,
        website,
      });
      populateFromData(data);
      showSaveResult('saved', 'Club details saved successfully');
    } catch (err) {
      showSaveResult('error', err instanceof Error ? err.message : 'Failed to save club details');
    }
  };

  const handleSaveTimezone = async () => {
    try {
      setSaveStatus('saving');
      const data = await updateClubSettings({
        timezone: timezone || clubRegion.timezone,
      });
      populateFromData(data);
      showSaveResult('saved', 'Timezone saved successfully');
    } catch (err) {
      showSaveResult('error', err instanceof Error ? err.message : 'Failed to save timezone');
    }
  };

  const handleSaveAffiliation = async () => {
    try {
      setSaveStatus('saving');
      const data = await updateClubSettings({
        governing_body: effectiveGoverningBody,
        governing_body_region: region,
        affiliation_number: affiliationNumber,
        // Keep writing the legacy swim_england shape so county round-trips and
        // the settings save works against the pre-affiliation-backend API.
        swim_england: { affiliationNumber, region, county },
      });
      populateFromData(data);
      showSaveResult('saved', `${governingBodyLabel} details saved successfully`);
    } catch (err) {
      showSaveResult(
        'error',
        err instanceof Error ? err.message : `Failed to save ${governingBodyLabel} details`,
      );
    }
  };

  const handleAddLocation = async () => {
    if (!newLocation.name || !newLocation.address) return;

    const updatedLocations = [
      ...locations,
      { id: Date.now().toString(), ...newLocation },
    ];

    try {
      setSaveStatus('saving');
      const data = await updateClubSettings({ locations: updatedLocations });
      populateFromData(data);
      setNewLocation({ name: '', address: '', laneCount: 6 });
      setIsAddingLocation(false);
      showSaveResult('saved', 'Location added successfully');
    } catch (err) {
      showSaveResult('error', err instanceof Error ? err.message : 'Failed to add location');
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this location?')) return;

    const updatedLocations = locations.filter((loc) => loc.id !== id);

    try {
      setSaveStatus('saving');
      const data = await updateClubSettings({ locations: updatedLocations });
      populateFromData(data);
      showSaveResult('saved', 'Location removed successfully');
    } catch (err) {
      showSaveResult('error', err instanceof Error ? err.message : 'Failed to remove location');
    }
  };

  const handleSaveTax = async () => {
    const trimmedRate = taxRate.trim();
    const trimmedLabel = taxLabel.trim();
    const parsedRate = trimmedRate === '' ? null : Number(trimmedRate);
    if (parsedRate !== null && (!Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 100)) {
      showSaveResult('error', 'Tax rate must be a number between 0 and 100');
      return;
    }
    // Registration numbers are stored without spaces (ABNs and VAT numbers
    // are often typed with grouping spaces); the stripped value must fit the
    // backend's 32-character column.
    const strippedRegistration = taxRegistrationNumber.replace(/\s+/g, '');
    if (strippedRegistration.length > 32) {
      showSaveResult('error', 'Tax registration number must be 32 characters or fewer');
      return;
    }
    try {
      setSaveStatus('saving');
      const data = await updateClubSettings({
        tax_rate: parsedRate,
        tax_label: trimmedLabel === '' ? null : trimmedLabel,
        tax_inclusive: taxInclusive,
        tax_registration_number: strippedRegistration === '' ? null : strippedRegistration,
      });
      populateFromData(data);
      showSaveResult('saved', 'Tax settings saved successfully');
    } catch (err) {
      showSaveResult('error', err instanceof Error ? err.message : 'Failed to save tax settings');
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setSaveStatus('saving');
      const data = await updateClubSettings({
        notification_prefs: { notifyNewMember, notifyPaymentReceived, notifyAttendanceAlerts },
      });
      populateFromData(data);
      showSaveResult('saved', 'Notification preferences saved successfully');
    } catch (err) {
      showSaveResult('error', err instanceof Error ? err.message : 'Failed to save notification preferences');
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-7xl mx-auto">
            <LoadingSpinner message="Loading settings..." />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (loadError) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-7xl mx-auto">
            <ErrorState message={loadError} onRetry={() => window.location.reload()} />
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Save Status Toast */}
          {saveStatus !== 'idle' && (
            <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-button text-sm font-medium shadow-card-hover transition-all ${
              saveStatus === 'saving' ? 'bg-dark-primary text-white/80 border border-white/10' :
              saveStatus === 'saved' ? 'bg-dark-primary text-success border border-success/40' :
              'bg-dark-primary text-danger border border-danger/40'
            }`}>
              {saveStatus === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
              {saveStatus === 'saved' && <CheckCircle2 className="w-4 h-4" />}
              {saveStatus === 'error' && <AlertCircle className="w-4 h-4" />}
              {saveStatus === 'saving' ? 'Saving...' : saveMessage}
            </div>
          )}

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Settings className="w-9 h-9 text-brand hidden sm:block" />
              <h1 className="font-serif text-4xl text-dark-primary tracking-tight">Club Configuration</h1>
            </div>
            <p className="text-grey-600 text-lg">Manage your swim club settings and preferences</p>
          </div>

          {/* Region Section */}
          <div className={SECTION_CARD}>
            <div className="flex items-center gap-3 mb-6">
              <Globe className="w-6 h-6 text-brand" />
              <h2 className={SECTION_HEADING}>Region</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className={FIELD_LABEL}>Country</span>
                  <p className="text-white px-4 py-3 min-h-[44px] rounded-button bg-white/5 border border-white/10">
                    {clubRegion.countryName}
                  </p>
                </div>
                <div>
                  <span className={FIELD_LABEL}>Currency</span>
                  <p className="text-white px-4 py-3 min-h-[44px] rounded-button bg-white/5 border border-white/10">
                    {clubRegion.currency}
                  </p>
                </div>
              </div>
              <p className="text-white/60 text-sm">
                Contact support to change your club&apos;s country or currency.
              </p>

              <div>
                <label className={FIELD_LABEL} htmlFor="club-timezone">Timezone</label>
                <select
                  id="club-timezone"
                  value={timezone || clubRegion.timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className={FIELD_INPUT}
                >
                  {clubRegion.timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveTimezone} disabled={saveStatus === 'saving'} className={SAVE_BUTTON}>
                {saveStatus === 'saving' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Changes
              </button>
            </div>
          </div>

          {/* Club Details Section */}
          <div className={SECTION_CARD}>
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="w-6 h-6 text-brand" />
              <h2 className={SECTION_HEADING}>Club Details</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className={FIELD_LABEL}>Club Name</label>
                <input
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  className={FIELD_INPUT}
                  placeholder="Enter club name"
                />
              </div>

              <div>
                <label className={FIELD_LABEL}>Club Logo</label>
                <button className="flex items-center gap-2 px-4 py-3 min-h-[44px] rounded-button bg-white/5 border border-white/10 text-white/80 hover:border-brand transition-colors">
                  <Upload className="w-5 h-5" />
                  Upload Logo
                </button>
              </div>

              <div>
                <label className={FIELD_LABEL}>Contact Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className={FIELD_INPUT}
                  placeholder="contact@example.com"
                />
              </div>

              <div>
                <label className={FIELD_LABEL}>Phone Number</label>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={FIELD_INPUT}
                  placeholder="+44 1234 567890"
                />
              </div>

              <div>
                <label className={FIELD_LABEL}>Website URL</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className={FIELD_INPUT}
                  placeholder="https://www.example.com"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveClubDetails} disabled={saveStatus === 'saving'} className={SAVE_BUTTON}>
                {saveStatus === 'saving' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Changes
              </button>
            </div>
          </div>

          {/* Governing Body Section. Rendered for every country: the heading,
              region control and placeholders follow the club's governing body.
              A GB club on Swim England sees the exact same heading and fields
              as before. */}
          <div className={SECTION_CARD}>
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="w-6 h-6 text-brand" />
              <h2 className={SECTION_HEADING}>{governingBodyLabel}</h2>
            </div>

            <div className="space-y-4">
              {governingBodyOptions.length > 1 && (
                <div>
                  <label className={FIELD_LABEL} htmlFor="governing-body">Governing body</label>
                  <select
                    id="governing-body"
                    value={effectiveGoverningBody}
                    onChange={(e) => setGoverningBody(e.target.value)}
                    className={FIELD_INPUT}
                  >
                    {governingBodyOptions.map((body) => (
                      <option key={body} value={body}>
                        {governingBodyConfig(body).label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className={FIELD_LABEL} htmlFor="affiliation-number">Affiliation Number</label>
                <input
                  id="affiliation-number"
                  type="text"
                  value={affiliationNumber}
                  onChange={(e) => setAffiliationNumber(e.target.value)}
                  className={FIELD_INPUT}
                  placeholder="Enter affiliation number"
                />
              </div>

              <div>
                <label className={FIELD_LABEL} htmlFor="governing-body-region">
                  {isAustralia ? 'State or territory' : 'Region'}
                </label>
                {isAustralia ? (
                  <select
                    id="governing-body-region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className={FIELD_INPUT}
                  >
                    <option value="">Select state or territory</option>
                    {AU_STATES.map((state) => (
                      <option key={state.code} value={state.code}>
                        {state.label}
                      </option>
                    ))}
                  </select>
                ) : isSwimEngland ? (
                  <select
                    id="governing-body-region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className={FIELD_INPUT}
                  >
                    <option value="">Select region</option>
                    <option value="North">North</option>
                    <option value="South">South</option>
                    <option value="East">East</option>
                    <option value="West">West</option>
                    <option value="Midlands">Midlands</option>
                    <option value="London">London</option>
                    <option value="South West">South West</option>
                  </select>
                ) : (
                  <input
                    id="governing-body-region"
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className={FIELD_INPUT}
                    placeholder="Enter region"
                  />
                )}
              </div>

              {isSwimEngland && (
                <div>
                  <label className={FIELD_LABEL} htmlFor="governing-body-county">County</label>
                  <input
                    id="governing-body-county"
                    type="text"
                    value={county}
                    onChange={(e) => setCounty(e.target.value)}
                    className={FIELD_INPUT}
                    placeholder="Enter county"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveAffiliation} disabled={saveStatus === 'saving'} className={SAVE_BUTTON}>
                {saveStatus === 'saving' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Changes
              </button>
            </div>
          </div>

          {/* Session Locations Section */}
          <div className={SECTION_CARD}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <MapPin className="w-6 h-6 text-brand" />
                <h2 className={SECTION_HEADING}>Session Locations</h2>
              </div>
              <button
                onClick={() => setIsAddingLocation(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] rounded-button font-semibold bg-brand text-dark-primary hover:bg-brand-dark transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Location
              </button>
            </div>

            {isAddingLocation && (
              <div className="mb-6 p-4 rounded-button bg-white/5 border border-brand">
                <h3 className="text-lg font-semibold text-white mb-4">New Location</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newLocation.name}
                    onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                    className={FIELD_INPUT}
                    placeholder="Location name"
                  />
                  <input
                    type="text"
                    value={newLocation.address}
                    onChange={(e) =>
                      setNewLocation({ ...newLocation, address: e.target.value })
                    }
                    className={FIELD_INPUT}
                    placeholder="Address"
                  />
                  <input
                    type="number"
                    value={newLocation.laneCount}
                    onChange={(e) =>
                      setNewLocation({ ...newLocation, laneCount: parseInt(e.target.value) })
                    }
                    className={`${FIELD_INPUT} tabular-nums`}
                    placeholder="Lane count"
                    min="1"
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleAddLocation}
                    disabled={saveStatus === 'saving'}
                    className="px-4 py-2 min-h-[44px] rounded-button font-semibold bg-brand text-dark-primary hover:bg-brand-dark transition-colors disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setIsAddingLocation(false)}
                    className="px-4 py-2 min-h-[44px] rounded-button bg-dark-secondary text-white font-semibold hover:bg-dark-tertiary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {locations.length === 0 && (
                <p className="text-white/60 text-sm py-4">No locations configured yet. Add your first training venue above.</p>
              )}
              {locations.map((location) => (
                <div
                  key={location.id}
                  className="flex items-center justify-between p-4 rounded-button bg-white/5 border border-white/10"
                >
                  <div>
                    <h3 className="text-white font-semibold">{location.name}</h3>
                    <p className="text-white/60 text-sm">{location.address}</p>
                    <p className="text-white/60 text-xs mt-1 tabular-nums">
                      {location.laneCount} {location.laneCount === 1 ? 'lane' : 'lanes'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteLocation(location.id)}
                    className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-button bg-danger/20 text-danger hover:bg-danger/30 transition-colors"
                    aria-label={`Remove ${location.name}`}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Fee Structures Section */}
          <div className={SECTION_CARD}>
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="w-6 h-6 text-brand" />
              <h2 className={SECTION_HEADING}>Fee Structures</h2>
            </div>
            <p className="text-white/60 mb-6">
              Manage your club&apos;s billing fee structures and pricing plans.
            </p>
            <Link
              href="/fee-structures"
              className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-button font-semibold bg-brand text-dark-primary hover:bg-brand-dark transition-colors"
            >
              Manage Fee Structures
              <ExternalLink className="w-5 h-5" />
            </Link>
          </div>

          {/* Payment Settings Section. The id anchors "connect your Stripe
              account" nudges from the billing surfaces. */}
          <div id="payments" className={SECTION_CARD}>
            <div className="flex items-center gap-3 mb-6">
              <CreditCard className="w-6 h-6 text-brand" />
              <h2 className={SECTION_HEADING}>Payment Settings</h2>
            </div>

            <PaymentsConnectionCard />
          </div>

          {/* Tax Section */}
          <div className={SECTION_CARD}>
            <div className="flex items-center gap-3 mb-6">
              <CreditCard className="w-6 h-6 text-brand" />
              <h2 className={SECTION_HEADING}>Tax</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className={FIELD_LABEL} htmlFor="tax-rate">Tax rate (%)</label>
                <input
                  id="tax-rate"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className={`${FIELD_INPUT} tabular-nums`}
                  placeholder={TAX_RATE_PLACEHOLDER[clubRegion.country] ?? '0'}
                />
                {clubRegion.country === 'AU' && (
                  <p className="text-white/60 text-sm mt-2">
                    Most clubs registered for GST use 10%. Leave blank if your club is not
                    registered for GST.
                  </p>
                )}
              </div>

              <div>
                <label className={FIELD_LABEL} htmlFor="tax-label">Tax name</label>
                <input
                  id="tax-label"
                  type="text"
                  value={taxLabel}
                  onChange={(e) => setTaxLabel(e.target.value)}
                  className={FIELD_INPUT}
                  placeholder={TAX_NAME_HINT[clubRegion.country] ?? 'Tax'}
                />
              </div>

              <div>
                <label className={FIELD_LABEL} htmlFor="tax-registration-number">
                  {TAX_REGISTRATION_LABEL[clubRegion.country] ?? 'Tax registration number'}
                </label>
                <input
                  id="tax-registration-number"
                  type="text"
                  value={taxRegistrationNumber}
                  onChange={(e) => setTaxRegistrationNumber(e.target.value)}
                  className={FIELD_INPUT}
                  placeholder={`Enter ${TAX_REGISTRATION_LABEL[clubRegion.country] ?? 'tax registration number'}`}
                />
                <p className="text-white/60 text-sm mt-2">
                  Shown on invoices when tax is applied. Leave blank if your club is not
                  registered.
                </p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-button bg-white/5 border border-white/10">
                <div>
                  <h3 className="text-white font-semibold">
                    Prices include {taxLabel.trim() || TAX_NAME_HINT[clubRegion.country] || 'tax'}
                  </h3>
                  <p className="text-white/60 text-sm">
                    When on, your fees are treated as the final price and the tax portion is
                    shown within the total. When off, tax is added on top of the subtotal.
                  </p>
                </div>
                <button
                  onClick={() => setTaxInclusive(!taxInclusive)}
                  aria-pressed={taxInclusive}
                  aria-label="Toggle tax-inclusive pricing"
                  className={`relative w-14 h-8 shrink-0 rounded-full transition-colors ${
                    taxInclusive ? 'bg-brand' : 'bg-white/30'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-6 h-6 bg-surface rounded-full transition-transform ${
                      taxInclusive ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>

              <p className="text-white/60 text-sm">
                Leave blank to issue invoices without tax.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveTax} disabled={saveStatus === 'saving'} className={SAVE_BUTTON}>
                {saveStatus === 'saving' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Changes
              </button>
            </div>
          </div>

          {/* Notifications Section */}
          <div className={SECTION_CARD}>
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-6 h-6 text-brand" />
              <h2 className={SECTION_HEADING}>Notifications</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-button bg-white/5 border border-white/10">
                <div>
                  <h3 className="text-white font-semibold">New Member Registration</h3>
                  <p className="text-white/60 text-sm">
                    Receive email when a new member registers
                  </p>
                </div>
                <button
                  onClick={() => setNotifyNewMember(!notifyNewMember)}
                  aria-pressed={notifyNewMember}
                  aria-label="Toggle new member registration emails"
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    notifyNewMember ? 'bg-brand' : 'bg-white/30'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-6 h-6 bg-surface rounded-full transition-transform ${
                      notifyNewMember ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-button bg-white/5 border border-white/10">
                <div>
                  <h3 className="text-white font-semibold">Payment Received</h3>
                  <p className="text-white/60 text-sm">
                    Receive email when a payment is received
                  </p>
                </div>
                <button
                  onClick={() => setNotifyPaymentReceived(!notifyPaymentReceived)}
                  aria-pressed={notifyPaymentReceived}
                  aria-label="Toggle payment received emails"
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    notifyPaymentReceived ? 'bg-brand' : 'bg-white/30'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-6 h-6 bg-surface rounded-full transition-transform ${
                      notifyPaymentReceived ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-button bg-white/5 border border-white/10">
                <div>
                  <h3 className="text-white font-semibold">Attendance Alerts</h3>
                  <p className="text-white/60 text-sm">
                    Receive email for low attendance warnings
                  </p>
                </div>
                <button
                  onClick={() => setNotifyAttendanceAlerts(!notifyAttendanceAlerts)}
                  aria-pressed={notifyAttendanceAlerts}
                  aria-label="Toggle attendance alert emails"
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    notifyAttendanceAlerts ? 'bg-brand' : 'bg-white/30'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-6 h-6 bg-surface rounded-full transition-transform ${
                      notifyAttendanceAlerts ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveNotifications} disabled={saveStatus === 'saving'} className={SAVE_BUTTON}>
                {saveStatus === 'saving' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
