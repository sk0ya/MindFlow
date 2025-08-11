// Authentication provider for cloud mode
import React, { createContext, useContext, useEffect, useState } from 'react';
import { CloudAuthAdapter, type AuthAdapter, type AuthState } from '../../core/auth';
import { logger } from '../../shared/utils/logger';

interface AuthContextType {
  authAdapter: AuthAdapter;
  authState: AuthState;
  login: (email: string) => Promise<{ success: boolean; error?: string }>;
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
    const unsubscribe = authAdapter.onAuthChange((user) => {
      setAuthState(authAdapter.authState);
      logger.info('AuthProvider: Auth state changed:', user ? `User: ${user.email}` : 'No user');
    });

    return unsubscribe;
  }, [authAdapter]);

  // Magic linkトークンの処理
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      logger.info('Magic link token detected in AuthProvider:', token);
      
      if (isReady) {
        const verifyToken = async () => {
          try {
            logger.info('Attempting to verify magic link token');
            const result = await authAdapter.verifyMagicLink(token);
            
            if (result.success) {
              logger.info('Magic link verified successfully');
              // URLからトークンを削除
              const newUrl = window.location.pathname + window.location.hash;
              window.history.replaceState({}, document.title, newUrl);
            } else {
              logger.error('Magic link verification failed:', result.error);
            }
          } catch (error) {
            logger.error('Magic link verification error:', error);
          }
        };

        verifyToken();
      } else {
        logger.info('AuthProvider not ready yet, will verify token when ready');
      }
    }
  }, [authAdapter, isReady]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      authAdapter.cleanup();
    };
  }, [authAdapter]);

  const contextValue: AuthContextType = {
    authAdapter,
    authState,
    login: authAdapter.login.bind(authAdapter),
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