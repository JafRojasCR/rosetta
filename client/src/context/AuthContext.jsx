import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';

export const AuthContext = createContext(null);
const PENDING_2FA_KEY = 'pending2fa';
const DEVICE_ID_KEY = 'rosettaDeviceId';
const SESSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

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
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [authToken, setAuthToken] = useState('');
  const [pendingTwoFactor, setPendingTwoFactor] = useState(null);
  const [loading, setLoading] = useState(true);
  const sessionCheckInFlightRef = useRef(false);
  const lastSessionCheckAtRef = useRef(0);

  const clearAuthState = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    sessionStorage.removeItem(PENDING_2FA_KEY);
    setAuthToken('');
    setUser(null);
    setRole(null);
    setPendingTwoFactor(null);
  }, []);

  const forceLogoutBySessionState = useCallback(
    (reason = '') => {
      clearAuthState();
      navigate(`/login${reason ? `?reason=${reason}` : ''}`, { replace: true });
    },
    [clearAuthState, navigate]
  );

  useEffect(() => {
    const handleAuthRedirect = (event) => {
      const nextPath = String(event?.detail?.path || '/login');
      clearAuthState();
      navigate(nextPath, { replace: true });
    };

    window.addEventListener('rosetta:auth-redirect', handleAuthRedirect);
    return () => {
      window.removeEventListener('rosetta:auth-redirect', handleAuthRedirect);
    };
  }, [clearAuthState, navigate]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedRole = localStorage.getItem('role');
    const token = localStorage.getItem('token');
    const storedPendingTwoFactor = sessionStorage.getItem(PENDING_2FA_KEY);

    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
      setRole(storedRole);
      setAuthToken(token);
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

  const checkSessionHealth = useCallback(async (options = {}) => {
    const { force = false } = options;
    const token = localStorage.getItem('token');
    if (!token) return;
    if (sessionCheckInFlightRef.current) return;

    const now = Date.now();
    const elapsedSinceLastCheck = now - lastSessionCheckAtRef.current;
    if (!force && elapsedSinceLastCheck < SESSION_CHECK_INTERVAL_MS) return;

    lastSessionCheckAtRef.current = now;
    sessionCheckInFlightRef.current = true;
    try {
      const response = await api.get('/auth/me', { skipAuthRedirect: true });
      const payload = response.data?.data || {};
      const freshUser = payload.user;
      const freshRole = payload.role;

      if (freshUser) {
        localStorage.setItem('user', JSON.stringify(freshUser));
        setUser(freshUser);
      }

      if (freshRole) {
        localStorage.setItem('role', freshRole);
        setRole(freshRole);
      }
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        const code =
          requestError.response?.data?.errors?.code || requestError.response?.data?.details?.code;
        const reason = code === 'SESSION_REVOKED' ? 'session-revoked' : 'session-expired';
        forceLogoutBySessionState(reason);
      }
    } finally {
      sessionCheckInFlightRef.current = false;
    }
  }, [forceLogoutBySessionState]);

  useEffect(() => {
    if (loading) return undefined;
    if (!authToken) return undefined;

    checkSessionHealth({ force: true });

    const intervalId = setInterval(() => {
      checkSessionHealth();
    }, SESSION_CHECK_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSessionHealth();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [loading, authToken, checkSessionHealth]);

  useEffect(() => {
    if (loading || !authToken) return;
    // Route changes trigger a health check, throttled internally to 5 minutes.
    checkSessionHealth();
  }, [location.pathname, loading, authToken, checkSessionHealth]);

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

    setAuthToken(token);
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
      const isTakeover = Boolean(options.forceTakeover);
      const payload = isTakeover
        ? {
            forceTakeover: true,
            takeoverToken: options.takeoverToken || '',
            deviceId: getOrCreateDeviceId(),
          }
        : {
            verificationToken: pendingTwoFactor.verificationToken,
            code,
            forceTakeover: false,
            deviceId: getOrCreateDeviceId(),
          };

      const response = await api.post('/auth/verify-2fa', payload);

      const { user: userData, token, role: resolvedRole } = response.data.data || {};
      if (!token || !userData) {
        throw new Error('No se pudo completar la verificación 2FA.');
      }

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('role', resolvedRole || 'student');

      setAuthToken(token);
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
    return responseData.user || responseData.student || responseData;
  };

  const logout = () => {
    if (localStorage.getItem('token')) {
      api.post('/auth/logout', null, { skipAuthRedirect: true }).catch(() => {
        // no-op: local cleanup still proceeds
      });
    }

    clearAuthState();
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
