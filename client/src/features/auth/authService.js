import api from '../../services/api';

export const loginService = (email, password) =>
  api.post('/auth/login', { email, password });

export const registerService = (data) => api.post('/auth/register', data);

export const getMeService = () => api.get('/auth/me');

export const resend2FAService = (verificationToken) =>
  api.post('/auth/resend-2fa', { verificationToken });

export const verify2FAService = (verificationToken, code) =>
  api.post('/auth/verify-2fa', { verificationToken, code });

export const forgotPasswordService = (email) =>
  api.post('/auth/forgot-password', { email });

export const resetPasswordService = (resetToken, newPassword) =>
  api.post('/auth/reset-password', { resetToken, newPassword });
