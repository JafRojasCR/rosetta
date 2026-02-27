import api from '../../services/api';

export const loginService = (email, password) =>
  api.post('/auth/login', { email, password });

export const registerService = (data) => api.post('/auth/register', data);

export const getMeService = () => api.get('/auth/me');

export const send2FAService = (email) => api.post('/auth/send-2fa', { email });

export const verify2FAService = (email, code) => api.post('/auth/verify-2fa', { email, code });
