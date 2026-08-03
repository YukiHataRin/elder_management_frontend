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

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const formsFetch = async (endpoint, options = {}) => {
  const { suppressAuthRedirect = false, ...fetchOptions } = options;
  const response = await fetch(`${FORMS_API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers: {
      ...getHeaders(),
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    if (!suppressAuthRedirect && (response.status === 401 || response.status === 403)) {
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

const formsFetchFormData = async (endpoint, formData, options = {}) => {
  const { suppressAuthRedirect = false, ...fetchOptions } = options;
  const response = await fetch(`${FORMS_API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    method: fetchOptions.method || 'POST',
    body: formData,
    headers: {
      ...getAuthHeaders(),
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    if (!suppressAuthRedirect && (response.status === 401 || response.status === 403)) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Questionnaire upload request failed');
  }

  return response.json();
};

const formsFetchBlob = async (endpoint, options = {}) => {
  const { suppressAuthRedirect = false, ...fetchOptions } = options;
  const response = await fetch(`${FORMS_API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers: {
      ...getHeaders(),
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    if (!suppressAuthRedirect && (response.status === 401 || response.status === 403)) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Questionnaire file request failed');
  }

  return response.blob();
};

export const formsApi = {
  listQuestionnaires: () => formsFetch('/questionnaires'),

  getQuestionnaire: (templateId) => formsFetch(`/questionnaires/${templateId}`),

  saveDraft: (templateId, data, options = {}) => formsFetch(`/questionnaires/${templateId}/draft`, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data),
  }),

  createDraft: (templateId, data, options = {}) => formsFetch(`/questionnaires/${templateId}/drafts`, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateDraft: (responseId, data, options = {}) => formsFetch(`/responses/${responseId}/draft`, {
    ...options,
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

  listTemplateResponses: (templateId, subjectNationId, { includeArchived = false } = {}) => {
    const params = new URLSearchParams();
    if (subjectNationId) params.set('subject_nation_id', subjectNationId);
    if (includeArchived) params.set('include_archived', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return formsFetch(`/questionnaires/${templateId}/responses${query}`);
  },

  listExportCandidates: (templateId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    (filters.visits || []).forEach(visit => params.append('visits', visit));
    if (filters.assessmentDateFrom) params.set('assessment_date_from', filters.assessmentDateFrom);
    if (filters.assessmentDateTo) params.set('assessment_date_to', filters.assessmentDateTo);
    if (filters.ageMin !== undefined && filters.ageMin !== null && filters.ageMin !== '') params.set('age_min', filters.ageMin);
    if (filters.ageMax !== undefined && filters.ageMax !== null && filters.ageMax !== '') params.set('age_max', filters.ageMax);
    (filters.genderIds || []).forEach(genderId => params.append('gender_ids', genderId));
    (filters.roleIds || []).forEach(roleId => params.append('role_ids', roleId));
    (filters.icopeGroups || []).forEach(group => params.append('icope_groups', group));
    if (filters.limit) params.set('limit', filters.limit);
    const query = params.toString() ? `?${params.toString()}` : '';
    return formsFetch(`/questionnaires/${templateId}/export-candidates${query}`);
  },

  downloadQuestionnaireBatchXlsx: (templateId, data) => formsFetchBlob(`/questionnaires/${templateId}/export/xlsx`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  listSubjectResponses: (nationId, { includeArchived = false } = {}) => {
    const query = includeArchived ? '?include_archived=true' : '';
    return formsFetch(`/subjects/${encodeURIComponent(nationId)}/responses${query}`);
  },

  listSubjectResponsesByBackendUser: (subjectBackendUserId, { includeArchived = false } = {}) => {
    const query = includeArchived ? '?include_archived=true' : '';
    return formsFetch(`/subjects/by-backend-user/${encodeURIComponent(subjectBackendUserId)}/responses${query}`);
  },

  listArchivedResponses: ({ subjectBackendUserId, subjectNationId, templateId } = {}) => {
    const params = new URLSearchParams();
    if (subjectBackendUserId) params.set('subject_backend_user_id', subjectBackendUserId);
    if (subjectNationId) params.set('subject_nation_id', subjectNationId);
    if (templateId) params.set('template_id', templateId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return formsFetch(`/responses/archived${query}`);
  },

  compareSubjectResponses: (nationId, responseIds, { includeUnchanged = false } = {}) => {
    const params = new URLSearchParams();
    responseIds.forEach(responseId => params.append('response_ids', responseId));
    if (includeUnchanged) params.set('include_unchanged', 'true');
    const query = params.toString();
    return formsFetch(`/subjects/${encodeURIComponent(nationId)}/responses/compare?${query}`);
  },

  getResponse: (responseId) => formsFetch(`/responses/${responseId}`),

  listResponseQueries: ({ status = 'open', templateId, subjectNationId, search, limit = 200, offset = 0 } = {}) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (templateId) params.set('template_id', templateId);
    if (subjectNationId) params.set('subject_nation_id', subjectNationId);
    if (search) params.set('search', search);
    params.set('limit', limit);
    params.set('offset', offset);
    return formsFetch(`/queries?${params.toString()}`);
  },

  updateResponseQuery: (queryId, data) => formsFetch(`/queries/${queryId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  downloadResponseXlsx: (responseId) => formsFetchBlob(`/responses/${responseId}/xlsx`),

  downloadResponsePdf: (responseId) => formsFetchBlob(`/responses/${responseId}/pdf`),

  listResponseAssets: (responseId) => formsFetch(`/responses/${responseId}/assets`),

  downloadAsset: (assetId) => formsFetchBlob(`/assets/${assetId}`),

  uploadResponseAsset: (responseId, { fieldId, assetType, file }) => {
    const formData = new FormData();
    formData.append('field_id', fieldId);
    formData.append('asset_type', assetType);
    formData.append('file', file);
    return formsFetchFormData(`/responses/${responseId}/assets`, formData);
  },

  deleteResponseAsset: (responseId, assetId) => formsFetch(`/responses/${responseId}/assets/${assetId}`, {
    method: 'DELETE',
  }),

  deleteDraft: (responseId) => formsFetch(`/responses/${responseId}/draft`, {
    method: 'DELETE',
  }),

  archiveResponse: (responseId, data = {}) => formsFetch(`/responses/${responseId}/archive`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  restoreResponse: (responseId) => formsFetch(`/responses/${responseId}/restore`, {
    method: 'PATCH',
  }),
};
