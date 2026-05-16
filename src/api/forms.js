const FORMS_API_BASE_URL = 'https://api.forms.elder.fclinlab.com/api/v1';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const formsFetch = async (endpoint, options = {}) => {
  const response = await fetch(`${FORMS_API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Questionnaire API request failed');
  }

  return response.json();
};

export const formsApi = {
  listQuestionnaires: () => formsFetch('/questionnaires'),

  getQuestionnaire: (templateId) => formsFetch(`/questionnaires/${templateId}`),

  saveDraft: (templateId, data) => formsFetch(`/questionnaires/${templateId}/draft`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  createDraft: (templateId, data) => formsFetch(`/questionnaires/${templateId}/drafts`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateDraft: (responseId, data) => formsFetch(`/responses/${responseId}/draft`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  submitResponse: (templateId, data) => formsFetch(`/questionnaires/${templateId}/submit`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  submitExistingResponse: (responseId, data) => formsFetch(`/responses/${responseId}/submit`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  listTemplateResponses: (templateId, subjectNationId) => {
    const query = subjectNationId ? `?subject_nation_id=${encodeURIComponent(subjectNationId)}` : '';
    return formsFetch(`/questionnaires/${templateId}/responses${query}`);
  },

  listSubjectResponses: (nationId) => formsFetch(`/subjects/${encodeURIComponent(nationId)}/responses`),

  listSubjectResponsesByBackendUser: (subjectBackendUserId) => (
    formsFetch(`/subjects/by-backend-user/${encodeURIComponent(subjectBackendUserId)}/responses`)
  ),

  compareSubjectResponses: (nationId, responseIds) => {
    const query = responseIds.map(responseId => `response_ids=${encodeURIComponent(responseId)}`).join('&');
    return formsFetch(`/subjects/${encodeURIComponent(nationId)}/responses/compare?${query}`);
  },

  getResponse: (responseId) => formsFetch(`/responses/${responseId}`),

  deleteDraft: (responseId) => formsFetch(`/responses/${responseId}/draft`, {
    method: 'DELETE',
  }),
};
