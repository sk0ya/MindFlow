import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://mindflow-api.shigekazukoya.workers.dev';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null
  });

  // 初期化時にセッションストレージから認証情報を復元
  useEffect(() => {
    const token = sessionStorage.getItem('auth_token');
    const userStr = sessionStorage.getItem('auth_user');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setAuthState({
          isAuthenticated: true,
          user,
          isLoading: false,
          error: null
        });
      } catch (error) {
        console.error('Failed to parse stored user data:', error);
        clearAuthData();
      }
    } else {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const clearAuthData = () => {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    setAuthState({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null
    });
  };

  const login = async (email: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `API Error: ${response.status} ${response.statusText}`;
        console.error('Login API Error:', { status: response.status, statusText: response.statusText, errorData });
        throw new Error(errorMessage);
      }

      // Magic Link送信成功
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'ログインに失敗しました';
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      return { success: false, error: errorMessage };
    }
  };

  const verifyToken = async (token: string) => {
    console.log('🔐 Token検証開始 - useAuth:', { tokenStart: token.substring(0, 10) + '...' });
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const url = `${API_BASE_URL}/api/auth/verify?token=${token}`;
      console.log('📡 API Request:', { url: url.replace(token, token.substring(0, 10) + '...') });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📋 API Response:', { 
        status: response.status, 
        ok: response.ok,
        statusText: response.statusText 
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error('トークン検証に失敗しました');
      }

      const data = await response.json();
      console.log('📋 Response Data:', { 
        success: data.success,
        hasToken: !!data.token,
        hasUser: !!data.user,
        user: data.user
      });
      
      if (data.success && data.token && data.user) {
        console.log('✅ 認証成功 - セッション保存開始');
        // 認証情報をセッションストレージに保存
        sessionStorage.setItem('auth_token', data.token);
        sessionStorage.setItem('auth_user', JSON.stringify(data.user));
        
        console.log('🔐 認証状態更新');
        setAuthState({
          isAuthenticated: true,
          user: data.user,
          isLoading: false,
          error: null
        });
        
        console.log('✅ Token検証完了 - 成功');
        return { success: true };
      } else {
        console.error('❌ Invalid response data:', data);
        throw new Error(data.message || 'トークンが無効です');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'トークン検証に失敗しました';
      console.error('❌ Token検証エラー:', { error: errorMessage });
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    clearAuthData();
  };

  const getAuthToken = () => {
    return sessionStorage.getItem('auth_token');
  };

  const getAuthHeaders = (): { [key: string]: string } => {
    const token = getAuthToken();
    if (token) {
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
    }
    return {
      'Content-Type': 'application/json'
    };
  };

  const contextValue: AuthContextType = {
    authState,
    login,
    verifyToken,
    logout,
    getAuthToken,
    getAuthHeaders
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};