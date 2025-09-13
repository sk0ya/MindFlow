// Authentication provider for cloud mode
import React, { createContext, useContext, useEffect, useState } from 'react';
import { CloudAuthAdapter, type AuthAdapter, type AuthState } from '../../core/auth';
import { logger } from '../../shared/utils/logger';

interface AuthContextType {
  authAdapter: AuthAdapter;
  authState: AuthState;
  login: (_email: string) => Promise<{ success: boolean; error?: string }>; // Deprecated
  loginWithPassword: (_email: string, _password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isReady: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authAdapter] = useState(() => new CloudAuthAdapter());
  const [authState, setAuthState] = useState<AuthState>(authAdapter.authState);
  const [isReady, setIsReady] = useState(false);

  // 認証アダプターの初期化
  useEffect(() => {
    const initAuth = async () => {
      try {
        await authAdapter.initialize();
        setIsReady(true);
        logger.info('AuthProvider: Authentication initialized');
      } catch (error) {
        logger.error('AuthProvider: Authentication initialization failed:', error);
        setIsReady(true); // エラーでも準備完了扱い
      }
    };

    initAuth();
  }, [authAdapter]);

  // 認証状態の変更を監視
  useEffect(() => {
    const unsubscribe = authAdapter.onAuthChange((_user) => {
      setAuthState(authAdapter.authState);
    });

    return unsubscribe;
  }, [authAdapter]);

  // URLパラメータからトークンを削除（マジックリンク機能は無効化）
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      logger.info('Legacy magic link token detected, removing from URL');
      // URLからトークンを削除
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // クリーンアップ
  useEffect(() => {
    return () => {
      authAdapter.cleanup();
    };
  }, [authAdapter]);

  const contextValue: AuthContextType = {
    authAdapter,
    authState,
    login: authAdapter.login.bind(authAdapter), // Deprecated
    loginWithPassword: async (email: string, password: string) => {
      try {
        const result = await authAdapter.loginWithPassword(email, password);
        return { success: result.success, error: result.success ? undefined : result.message };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Login failed';
        return { success: false, error: errorMessage };
      }
    },
    logout: authAdapter.logout.bind(authAdapter),
    isReady
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * 認証フックを使用
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * AuthProviderの外でも安全に使用できる認証フック
 * nullを返す場合があることを考慮して使用すること
 */
export const useOptionalAuth = (): AuthContextType | null => {
  return useContext(AuthContext);
};

/**
 * 認証が必要なコンポーネントをラップ
 */
interface RequireAuthProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ 
  children, 
  fallback = <div>認証が必要です</div> 
}) => {
  const { authState } = useAuth();
  
  return authState.isAuthenticated ? <>{children}</> : <>{fallback}</>;
};