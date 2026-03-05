import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

const dispatchAuthRedirect = (reason = '') => {
  if (typeof window === 'undefined') return;

  const path = `/login${reason}`;
  window.dispatchEvent(
    new CustomEvent('rosetta:auth-redirect', {
      detail: { path },
    })
  );
};

// Interceptor: agregar token JWT a cada request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor: manejar respuestas y errores globales
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const skipAuthRedirect = Boolean(error.config?.skipAuthRedirect);

    if (error.response?.status === 401) {
      // No redirigir si el error 401 viene del endpoint de login
      if (!skipAuthRedirect && error.config && !error.config.url.includes('/auth/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('role');

        const reason =
          (error.response?.data?.errors?.code || error.response?.data?.details?.code) ===
          'SESSION_REVOKED'
          ? '?reason=session-revoked'
          : '';
        dispatchAuthRedirect(reason);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
