import { api } from './api-client';

export interface ClubSettingsData {
  settings_id: string;
  club_name: string;
  address: string | null;
  contact_email: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  swim_england: {
    affiliationNumber?: string;
    region?: string;
    county?: string;
  };
  locations: Array<{
    id: string;
    name: string;
    address: string;
    laneCount: number;
  }>;
  // Provider credentials are never stored here. Clubs connect their own payment
  // provider account instead, so Swimly never holds a club's API keys.
  billing_config: {
    payment_due_days?: number;
  };
  notification_prefs: {
    notifyNewMember?: boolean;
    notifyPaymentReceived?: boolean;
    notifyAttendanceAlerts?: boolean;
  };
  // Regional fields. Optional because the backend only returns (and accepts)
  // them once the regional-backend PR is deployed; callers must tolerate
  // their absence and fall back to GB defaults.
  country?: string;
  currency?: string;
  timezone?: string;
  locale?: string;
  // Governing-body affiliation fields. Optional for the same reason: the
  // affiliation-backend PR adds them to the settings GET/PUT. Until it merges
  // callers read from the legacy swim_england JSONB shape above and fall back.
  governing_body?: string;
  governing_body_region?: string;
  affiliation_number?: string;
  // Tax fields. Optional because the backend only returns (and accepts) them
  // once the tax-backend PR is deployed; callers must tolerate their absence.
  // A null tax_rate means the club issues invoices without tax.
  tax_rate?: number | null;
  tax_label?: string | null;
  // True when the club's prices already include tax (the Australian GST
  // convention); false or absent means tax is added on top of the subtotal.
  tax_inclusive?: boolean;
  // Tax registration identifier (ABN for AU, VAT number for GB, GST/HST
  // number for CA). Null or absent means not registered or not supplied.
  tax_registration_number?: string | null;
  created_at: string;
  updated_at: string;
}

export type UpdateClubSettingsPayload = Partial<
  Omit<ClubSettingsData, 'settings_id' | 'created_at' | 'updated_at'>
>;

export async function getClubSettings(): Promise<ClubSettingsData> {
  return api.get<ClubSettingsData>('/admin/settings', {
    cache: 'no-store',
    credentials: 'include',
  });
}

export async function updateClubSettings(
  data: UpdateClubSettingsPayload
): Promise<ClubSettingsData> {
  return api.put<ClubSettingsData>('/admin/settings', data, {
    credentials: 'include',
  });
}
