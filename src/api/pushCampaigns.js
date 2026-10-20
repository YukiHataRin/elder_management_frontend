import { apiFetch } from './client';

export const pushCampaignsApi = {
  getAudienceOptions: () => apiFetch('/management/push-campaigns/audience-options'),

  previewAudience: (audience, { signal } = {}) => apiFetch('/management/push-campaigns/preview', {
    method: 'POST',
    body: JSON.stringify(audience),
    signal,
  }),

  createCampaign: (data) => apiFetch('/management/push-campaigns', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getCampaigns: ({ status = '', limit = 20, offset = 0, signal } = {}) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (status) params.set('status', status);
    return apiFetch(`/management/push-campaigns?${params.toString()}`, { signal });
  },

  getCampaign: (campaignId, { signal } = {}) => apiFetch(`/management/push-campaigns/${campaignId}`, { signal }),

  cancelCampaign: (campaignId) => apiFetch(`/management/push-campaigns/${campaignId}/cancel`, {
    method: 'POST',
  }),
};
