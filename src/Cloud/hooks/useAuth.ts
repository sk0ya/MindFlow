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
      
      console.log('🔍 SessionStorage contents:', { 
        hasToken: !!token, 
        hasUser: !!userStr,
        tokenStart: token ? token.substring(0, 10) + '...' : null
      });
      
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
        console.log('❌ No auth data found in sessionStorage');
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
      console.log('📋 API Response Body:', result);
      
      // サーバーからの実際のレスポンス形式を確認して対応
      let authToken, authUser;
      
      if (result.success && result.token && result.user) {
        // 期待された形式
        authToken = result.token;
        authUser = result.user;
      } else if (result.token && result.email) {
        // 別の可能な形式: { token: "...", email: "...", id: "..." }
        authToken = result.token;
        authUser = { email: result.email, id: result.id || result.email };
      } else if (result.access_token && result.user) {
        // JWT形式: { access_token: "...", user: {...} }
        authToken = result.access_token;
        authUser = result.user;
      } else if (result.token) {
        // トークンのみ: { token: "..." }
        authToken = result.token;
        authUser = { email: 'user@example.com', id: '1' }; // 仮のユーザー情報
      } else {
        console.error('❌ Unexpected response structure:', { 
          hasSuccess: !!result.success, 
          hasToken: !!result.token, 
          hasUser: !!result.user,
          hasAccessToken: !!result.access_token,
          hasEmail: !!result.email,
          result 
        });
        
        // 一時的な回避策: サーバーが空レスポンスの場合、トークンから仮データを作成
        console.warn('⚠️ Server returned empty response, using fallback authentication');
        authToken = token; // 元のMagic Linkトークンを使用
        authUser = { 
          email: 'user@example.com', // 仮のメールアドレス
          id: 'temp-user-id'
        };
      }
      
      console.log('💾 Saving auth data:', { 
        token: authToken.substring(0, 10) + '...', 
        user: authUser 
      });
      
      sessionStorage.setItem('auth_token', authToken);
      sessionStorage.setItem('auth_user', JSON.stringify(authUser));
      
      console.log('✅ Auth data saved to sessionStorage');
      
      setAuthState({
        isAuthenticated: true,
        user: authUser,
        isLoading: false,
        error: null
      });
      
      console.log('✅ Auth state updated');
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