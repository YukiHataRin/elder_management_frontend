export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || 'https://api.eldercare.fclinlab.com/api/v2';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = { ...getHeaders(), ...options.headers };

  // Force Authorization header if token exists to avoid race conditions
  const currentToken = localStorage.getItem('token');
  if (currentToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }

  // FormData requests should automatically set boundaries, do not force application/json
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Only an expired/invalid login session should force logout. A 403 is a
    // resource permission error and must keep the current management session.
    if (response.status === 401) {
      console.warn(`Auth Error (${response.status}): Invalid token or session expired.`);
      localStorage.removeItem('token');
      // Only redirect to login if we are not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'API request failed');
  }

  return response.json();
};

export const apiFetchBlob = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = { ...getHeaders(), ...options.headers };

  // Force Authorization header if token exists
  const currentToken = localStorage.getItem('token');
  if (currentToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    throw new Error('Asset request failed');
  }

  return response.blob();
};
