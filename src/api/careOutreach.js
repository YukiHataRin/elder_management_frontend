import { apiFetch, apiFetchBlob } from './client';

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === false) return;
    if (Array.isArray(value) && value.length === 0) return;
    query.set(key, Array.isArray(value) ? value.join(',') : String(value));
  });
  const rendered = query.toString();
  return rendered ? `?${rendered}` : '';
};

export const careOutreachApi = {
  getCases: ({
    search = '',
    status = '',
    severity = '',
    source = '',
    overdue = false,
    page = 1,
    pageSize = 20,
    signal,
  } = {}) => apiFetch(`/management/care-outreach/cases${buildQuery({
    search,
    status,
    severity,
    trigger_type: source,
    overdue,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  })}`, { signal }),

  getCase: (caseId, { signal } = {}) => apiFetch(`/management/care-outreach/cases/${caseId}`, { signal }),

  updateCase: (caseId, data) => apiFetch(`/management/care-outreach/cases/${caseId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  addContact: (caseId, data) => apiFetch(`/management/care-outreach/cases/${caseId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  exportCases: (params = {}) => apiFetchBlob(`/management/care-outreach/cases/export${buildQuery({
    ...params,
    trigger_type: params.source,
    source: undefined,
  })}`),
};
