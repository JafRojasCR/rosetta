import { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext(null);
const PENDING_2FA_KEY = 'pending2fa';
const DEVICE_ID_KEY = 'rosettaDeviceId';

const createDeviceId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getOrCreateDeviceId = () => {
  if (typeof window === 'undefined') return '';

  const stored = localStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;

  const next = createDeviceId();
  localStorage.setItem(DEVICE_ID_KEY, next);
  return next;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [pendingTwoFactor, setPendingTwoFactor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedRole = localStorage.getItem('role');
    const token = localStorage.getItem('token');
    const storedPendingTwoFactor = sessionStorage.getItem(PENDING_2FA_KEY);

    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
      setRole(storedRole);
    }

    if (storedPendingTwoFactor) {
      try {
        setPendingTwoFactor(JSON.parse(storedPendingTwoFactor));
      } catch (_err) {
        sessionStorage.removeItem(PENDING_2FA_KEY);
      }
    }

    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const data = response.data.data || {};

    if (data.requiresTwoFactor && data.verificationToken) {
      const pendingPayload = {
        verificationToken: data.verificationToken,
        email: data.email,
        role: data.role,
        expiresIn: data.expiresIn,
      };

      setPendingTwoFactor(pendingPayload);
      sessionStorage.setItem(PENDING_2FA_KEY, JSON.stringify(pendingPayload));
      return { requiresTwoFactor: true, ...pendingPayload };
    }

    const userData = data.user || data.student;
    const token = data.token;
    const resolvedRole = data.role || 'student';

    if (!token || !userData) {
      throw new Error('Respuesta de autenticación inválida.');
    }

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('role', resolvedRole);

    setUser(userData);
    setRole(resolvedRole);
    setPendingTwoFactor(null);
    sessionStorage.removeItem(PENDING_2FA_KEY);
    return { user: userData, role: resolvedRole, requiresTwoFactor: false };
  };

  const verifyTwoFactor = async (code, options = {}) => {
    if (!pendingTwoFactor?.verificationToken) {
      throw new Error('No hay una verificación pendiente. Inicia sesión nuevamente.');
    }

    try {
      const response = await api.post('/auth/verify-2fa', {
        verificationToken: pendingTwoFactor.verificationToken,
        code,
        forceTakeover: Boolean(options.forceTakeover),
        takeoverToken: options.takeoverToken || '',
        deviceId: getOrCreateDeviceId(),
      });

      const { user: userData, token, role: resolvedRole } = response.data.data || {};
      if (!token || !userData) {
        throw new Error('No se pudo completar la verificación 2FA.');
      }

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('role', resolvedRole || 'student');

      setUser(userData);
      setRole(resolvedRole || 'student');
      setPendingTwoFactor(null);
      sessionStorage.removeItem(PENDING_2FA_KEY);

      return { user: userData, role: resolvedRole || 'student' };
    } catch (requestError) {
      const details = requestError.response?.data?.errors || requestError.response?.data?.details || {};
      if (
        requestError.response?.status === 409 &&
        details?.code === 'ACTIVE_SESSION_EXISTS'
      ) {
        return {
          requiresSessionTakeover: true,
          takeoverToken: details.takeoverToken,
          activeSession: details.activeSession || null,
        };
      }

      throw requestError;
    }
  };

  const resendTwoFactor = async () => {
    if (!pendingTwoFactor?.verificationToken) {
      throw new Error('No hay una verificación pendiente. Inicia sesión nuevamente.');
    }

    await api.post('/auth/resend-2fa', {
      verificationToken: pendingTwoFactor.verificationToken,
    });

    return true;
  };

  const register = async (data) => {
    const response = await api.post('/auth/register', data);
    const responseData = response.data.data || {};
    const userData = responseData.user || responseData.student;
    const token = responseData.token;
    const resolvedRole = responseData.role || 'student';

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('role', resolvedRole);

    setUser(userData);
    setRole(resolvedRole);
    return userData;
  };

  const logout = () => {
    if (localStorage.getItem('token')) {
      api.post('/auth/logout').catch(() => {
        // no-op: local cleanup still proceeds
      });
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    sessionStorage.removeItem(PENDING_2FA_KEY);
    setUser(null);
    setRole(null);
    setPendingTwoFactor(null);
  };

  const updateUser = (updatedUser) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        pendingTwoFactor,
        login,
        verifyTwoFactor,
        resendTwoFactor,
        register,
        logout,
        updateUser,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
