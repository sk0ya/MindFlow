import { useState, useEffect, useCallback } from 'react';
import type { AuthState, AuthUser } from '../types';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null
  });
  const [emailSent, setEmailSent] = useState<boolean>(false);

  // 認証状態の初期化（一度だけ実行）
  useEffect(() => {
    const checkAuth = () => {
      console.log('🔐 Checking authentication state...');
      const token = sessionStorage.getItem('auth_token');
      const userStr = sessionStorage.getItem('auth_user');
      
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr) as AuthUser;
          console.log('✅ Found valid auth data:', { email: user.email });
          setAuthState({
            isAuthenticated: true,
            user,
            isLoading: false,
            error: null
          });
        } catch (error) {
          console.error('❌ Auth parse error:', error);
          sessionStorage.removeItem('auth_token');
          sessionStorage.removeItem('auth_user');
          setAuthState({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            error: null
          });
        }
      } else {
        console.log('❌ No auth data found');
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: null
        });
      }
    };

    // 少し遅延させて初期化
    const timeoutId = setTimeout(checkAuth, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  const login = useCallback(async (email: string): Promise<void> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch('https://mindflow-api.shigekazukoya.workers.dev/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const result = await response.json();
      
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null
      });
      
      setEmailSent(true);
      console.log('Magic link sent to:', email);
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed'
      }));
    }
  }, []);

  const verifyToken = useCallback(async (token: string): Promise<void> => {
    console.log('🔍 Token verification started:', { token: token.substring(0, 10) + '...' });
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // リソース不足エラーを避けるため、タイムアウトを設定
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒タイムアウト

      const response = await fetch(`https://mindflow-api.shigekazukoya.workers.dev/api/auth/verify?token=${encodeURIComponent(token)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('📡 API Response:', { 
        status: response.status, 
        statusText: response.statusText,
        ok: response.ok 
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`Token verification failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success && result.token && result.user) {
        sessionStorage.setItem('auth_token', result.token);
        sessionStorage.setItem('auth_user', JSON.stringify(result.user));
        
        setAuthState({
          isAuthenticated: true,
          user: result.user,
          isLoading: false,
          error: null
        });
      } else {
        throw new Error('Invalid token response');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('❌ Token verification timeout');
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: 'サーバーの応答がタイムアウトしました。しばらく時間をおいて再試行してください。'
        }));
      } else {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Token verification failed'
        }));
      }
    }
  }, []);

  const logout = useCallback((): void => {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    setAuthState({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null
    });
  }, []);

  return {
    ...authState,
    emailSent,
    login,
    verifyToken,
    logout,
    clearEmailSent: () => setEmailSent(false)
  };
}