import { apiFetch } from './client';


export const managerNotificationsApi = {
  getInbox: ({ status = '', severity = '', search = '', limit = 100, offset = 0, signal } = {}) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (status) params.set('status', status);
    if (severity) params.set('severity', severity);
    if (search) params.set('search', search);
    return apiFetch(`/management/manager-notifications/inbox?${params.toString()}`, { signal });
  },
  getUnreadCount: () => apiFetch('/management/manager-notifications/unread-count'),
  getPreference: () => apiFetch('/management/manager-notifications/preferences/me'),
  updatePreference: (data) => apiFetch('/management/manager-notifications/preferences/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  updateStatus: (notificationId, status, resolutionNote = null) => apiFetch(
    `/management/manager-notifications/${notificationId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, resolution_note: resolutionNote }),
    },
  ),
};
