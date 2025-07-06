/**
 * Optimized authentication hook with race condition prevention
 * Handles concurrent authentication requests and state synchronization
 */

import React, { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from 'react';
import { safeAsync, withRetry, errorHandler } from '../utils/errorHandling';

interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType {
  authState: AuthState;
  login: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyToken: (token: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  getAuthToken: () => string | null;
  getAuthHeaders: () => { [key: string]: string };
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://mindflow-api.shigekazukoya.workers.dev';

// Authentication state machine to prevent race conditions
type AuthActionType = 
  | 'INIT_START'
  | 'INIT_SUCCESS' 
  | 'INIT_ERROR'
  | 'LOGIN_START'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_ERROR'
  | 'VERIFY_START'
  | 'VERIFY_SUCCESS'
  | 'VERIFY_ERROR'
  | 'LOGOUT'
  | 'REFRESH_START'
  | 'REFRESH_SUCCESS'
  | 'REFRESH_ERROR';

interface AuthAction {
  type: AuthActionType;
  payload?: {
    user?: AuthUser;
    error?: string;
  };
}

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'INIT_START':
    case 'VERIFY_START':
    case 'REFRESH_START':
      return { ...state, isLoading: true, error: null };
    
    case 'LOGIN_START':
      return { ...state, isLoading: true, error: null, isAuthenticated: false, user: null };
    
    case 'INIT_SUCCESS':
    case 'VERIFY_SUCCESS':
    case 'REFRESH_SUCCESS':
      return {
        isAuthenticated: true,
        user: action.payload.user,
        isLoading: false,
        error: null
      };
    
    case 'LOGIN_SUCCESS':
      return { ...state, isLoading: false, error: null };
    
    case 'INIT_ERROR':
    case 'LOGIN_ERROR':
    case 'VERIFY_ERROR':
    case 'REFRESH_ERROR':
      return {
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: action.payload?.error || 'Authentication failed'
      };
    
    case 'LOGOUT':
      return {
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null
      };
    
    default:
      return state;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, dispatch] = React.useReducer(authReducer, {
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null
  });

  // Prevent multiple concurrent requests
  const requestTracker = useRef<{
    login: AbortController | null;
    verify: AbortController | null;
    refresh: AbortController | null;
  }>({
    login: null,
    verify: null,
    refresh: null
  });

  // Session persistence
  const [sessionInitialized, setSessionInitialized] = useState(false);

  // Clear auth data helper
  const clearAuthData = useCallback(() => {
    try {
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_user');
    } catch (error) {
      console.warn('Failed to clear auth data:', error);
    }
  }, []);

  // Save auth data helper
  const saveAuthData = useCallback((token: string, user: AuthUser) => {
    try {
      sessionStorage.setItem('auth_token', token);
      sessionStorage.setItem('auth_user', JSON.stringify(user));
    } catch (error) {
      console.warn('Failed to save auth data:', error);
      throw new Error('Failed to save authentication data');
    }
  }, []);

  // Initialize auth state from session storage
  useEffect(() => {
    if (sessionInitialized) return;

    const initializeAuth = async () => {
      dispatch({ type: 'INIT_START' });

      try {
        const token = sessionStorage.getItem('auth_token');
        const userStr = sessionStorage.getItem('auth_user');
        
        if (token && userStr) {
          const user = JSON.parse(userStr);
          
          // Verify token is still valid
          const result = await safeAsync(async () => {
            const response = await fetch(`${API_BASE_URL}/api/auth/verify?token=${token}`, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(10000) // 10 second timeout
            });

            if (!response.ok) {
              throw new Error('Token verification failed');
            }

            const data = await response.json();
            if (!data.success) {
              throw new Error('Invalid token');
            }

            return { user: data.user || user, token: data.token || token };
          });

          if (result.success && result.data) {
            // Update session storage with fresh data
            saveAuthData(result.data.token, result.data.user);
            dispatch({ type: 'INIT_SUCCESS', payload: { user: result.data.user } });
          } else {
            // Invalid token, clear session
            clearAuthData();
            dispatch({ type: 'INIT_ERROR', payload: { error: result.error?.message } });
          }
        } else {
          dispatch({ type: 'INIT_ERROR', payload: { error: 'No stored credentials' } });
        }
      } catch (error) {
        clearAuthData();
        dispatch({ type: 'INIT_ERROR', payload: { error: 'Initialization failed' } });
      }

      setSessionInitialized(true);
    };

    initializeAuth();
  }, [sessionInitialized, clearAuthData, saveAuthData]);

  const login = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    // Cancel any existing login request
    if (requestTracker.current.login) {
      requestTracker.current.login.abort();
    }

    const controller = new AbortController();
    requestTracker.current.login = controller;

    dispatch({ type: 'LOGIN_START' });

    const result = await withRetry(
      async () => {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
          signal: controller.signal
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `API Error: ${response.status}`);
        }

        return response.json();
      },
      3, // max retries
      1000, // base delay
      { operation: 'login', email }
    );

    requestTracker.current.login = null;

    if (result.success) {
      dispatch({ type: 'LOGIN_SUCCESS' });
      return { success: true };
    } else {
      const error = result.error?.message || 'Login failed';
      dispatch({ type: 'LOGIN_ERROR', payload: { error } });
      errorHandler.handle(result.error || new Error(error), { operation: 'login', email });
      return { success: false, error };
    }
  }, []);

  const verifyToken = useCallback(async (token: string): Promise<{ success: boolean; error?: string }> => {
    // Cancel any existing verify request
    if (requestTracker.current.verify) {
      requestTracker.current.verify.abort();
    }

    const controller = new AbortController();
    requestTracker.current.verify = controller;

    dispatch({ type: 'VERIFY_START' });

    const result = await safeAsync(async () => {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify?token=${token}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error('Token verification failed');
      }

      const data = await response.json();
      if (!data.success || !data.token || !data.user) {
        throw new Error('Invalid response format');
      }

      return data;
    });

    requestTracker.current.verify = null;

    if (result.success && result.data) {
      try {
        saveAuthData(result.data.token, result.data.user);
        dispatch({ type: 'VERIFY_SUCCESS', payload: { user: result.data.user } });
        return { success: true };
      } catch (error) {
        const errorMessage = 'Failed to save authentication data';
        dispatch({ type: 'VERIFY_ERROR', payload: { error: errorMessage } });
        return { success: false, error: errorMessage };
      }
    } else {
      const error = result.error?.message || 'Token verification failed';
      dispatch({ type: 'VERIFY_ERROR', payload: { error } });
      errorHandler.handle(result.error || new Error(error), { operation: 'verify' });
      return { success: false, error };
    }
  }, [saveAuthData]);

  const logout = useCallback(() => {
    // Cancel any pending requests
    Object.values(requestTracker.current).forEach(controller => {
      if (controller) controller.abort();
    });

    clearAuthData();
    dispatch({ type: 'LOGOUT' });
  }, [clearAuthData]);

  const getAuthToken = useCallback((): string | null => {
    try {
      return sessionStorage.getItem('auth_token');
    } catch {
      return null;
    }
  }, []);

  const getAuthHeaders = useCallback((): { [key: string]: string } => {
    const token = getAuthToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }, [getAuthToken]);

  const refreshAuth = useCallback(async (): Promise<void> => {
    const token = getAuthToken();
    if (!token) return;

    // Cancel any existing refresh request
    if (requestTracker.current.refresh) {
      requestTracker.current.refresh.abort();
    }

    const controller = new AbortController();
    requestTracker.current.refresh = controller;

    dispatch({ type: 'REFRESH_START' });

    const result = await safeAsync(async () => {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error('Auth refresh failed');
      }

      return response.json();
    });

    requestTracker.current.refresh = null;

    if (result.success && result.data) {
      saveAuthData(result.data.token, result.data.user);
      dispatch({ type: 'REFRESH_SUCCESS', payload: { user: result.data.user } });
    } else {
      // Refresh failed, logout user
      logout();
      dispatch({ type: 'REFRESH_ERROR', payload: { error: result.error?.message } });
    }
  }, [getAuthToken, saveAuthData, logout]);

  // Auto-refresh token periodically
  useEffect(() => {
    if (!authState.isAuthenticated) return;

    const interval = setInterval(() => {
      refreshAuth();
    }, 15 * 60 * 1000); // Refresh every 15 minutes

    return () => clearInterval(interval);
  }, [authState.isAuthenticated, refreshAuth]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(requestTracker.current).forEach(controller => {
        if (controller) controller.abort();
      });
    };
  }, []);

  const contextValue: AuthContextType = {
    authState,
    login,
    verifyToken,
    logout,
    getAuthToken,
    getAuthHeaders,
    refreshAuth
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default useAuth;