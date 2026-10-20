const AI_API_BASE_URL = 'https://api.llm.elder.fclinlab.com/v2';

const aiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${AI_API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'AI 對話資料載入失敗');
  }

  return response.json();
};

export const aiChatsApi = {
  getPatients: ({ search = '', activity = 'all', recentDays = 30, signal } = {}) => {
    const params = new URLSearchParams({
      search,
      activity,
      recent_days: String(recentDays),
      limit: '500',
    });
    return aiFetch(`/management/chats/patients?${params.toString()}`, { signal });
  },

  getPatientMessages: (patientId, { limit = 50, beforeId, signal } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (beforeId) params.set('before_id', String(beforeId));
    return aiFetch(
      `/management/chats/patients/${patientId}/messages?${params.toString()}`,
      { signal },
    );
  },
};
