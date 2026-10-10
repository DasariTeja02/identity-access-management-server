import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService, mfaService } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check current session with the backend on initial load
  const verifySession = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authService.getCurrentUser();
      if (res && res.data) {
        setUser(res.data);
      } else {
        setUser(null);
      }
    } catch (err) {
      // 401 or no active session is expected when not logged in
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  const login = async (credentials) => {
    setError(null);
    try {
      const response = await authService.login(credentials);
      if (response && response.mfaRequired) {
        return response;
      }
      if (response && response.user) {
        if (response.sessionId) {
          localStorage.setItem('iam_session_id', response.sessionId);
        }
        setUser(response.user);
        return response;
      }
      throw new Error('Authentication succeeded but user profile was not returned.');
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    }
  };

  const verifyMfaChallenge = async (challengeToken, code, recoveryCode) => {
    setError(null);
    try {
      const response = await mfaService.verifyChallenge(challengeToken, code, recoveryCode);
      if (response && response.user) {
        if (response.sessionId) {
          localStorage.setItem('iam_session_id', response.sessionId);
        }
        setUser(response.user);
        return response;
      }
      throw new Error('MFA verification succeeded but user profile was not returned.');
    } catch (err) {
      setError(err.message || 'MFA verification failed');
      throw err;
    }
  };

  const register = async (userData) => {
    setError(null);
    try {
      const response = await authService.register(userData);
      return response.data;
    } catch (err) {
      setError(err.message || 'Registration failed');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error on backend:', err);
    } finally {
      localStorage.removeItem('iam_session_id');
      setUser(null);
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    error,
    login,
    verifyMfaChallenge,
    register,
    logout,
    refreshUser: verifySession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
