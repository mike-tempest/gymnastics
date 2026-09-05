import { DirectDebitMandate } from '@club-manager/shared-types';

import { api } from './api-client';

export interface CreateRedirectFlowRequest {
  family_id: string;
  session_token: string;
  success_redirect_url: string;
}

export interface CompleteRedirectFlowRequest {
  redirect_flow_id: string;
  session_token: string;
  family_id: string;
}

export interface RedirectFlowResponse {
  id: string;
  redirect_url: string;
  session_token: string;
}

export const mandatesApi = {
  // Get all mandates for a family
  async getByFamily(familyId: string): Promise<DirectDebitMandate[]> {
    return api.get<DirectDebitMandate[]>(`/mandates/family/${familyId}`);
  },

  // Get active mandate for a family
  async getActiveByFamily(familyId: string): Promise<DirectDebitMandate | null> {
    const mandates = await api.get<DirectDebitMandate[]>(`/mandates/family/${familyId}`);
    return mandates.find((m) => m.status === 'active') ?? null;
  },

  // Start the redirect flow for setting up a new mandate
  async startSetup(data: CreateRedirectFlowRequest): Promise<RedirectFlowResponse> {
    return api.post<RedirectFlowResponse>('/mandates/setup/start', data);
  },

  // Complete the redirect flow after user returns from GoCardless
  async completeSetup(data: CompleteRedirectFlowRequest): Promise<DirectDebitMandate> {
    return api.post<DirectDebitMandate>('/mandates/setup/complete', data);
  },

  // Cancel a mandate
  async cancel(mandateId: string): Promise<DirectDebitMandate> {
    return api.patch<DirectDebitMandate>(`/mandates/${mandateId}/cancel`);
  },

  // Sync mandate status from GoCardless
  async syncStatus(mandateId: string): Promise<DirectDebitMandate> {
    return api.patch<DirectDebitMandate>(`/mandates/${mandateId}/sync`);
  },
};
