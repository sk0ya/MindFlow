// Authentication provider for cloud mode
import React, { createContext, useContext, useEffect, useState } from 'react';
import { CloudAuthAdapter } from '../../core/auth/CloudAuthAdapter';
import type { AuthAdapter, AuthState } from '../../core/auth/types';

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
        console.log('✅ AuthProvider: Authentication initialized');
      } catch (error) {
        console.error('❌ AuthProvider: Authentication initialization failed:', error);
        setIsReady(true); // エラーでも準備完了扱い
      }
    };

    initAuth();
  }, [authAdapter]);

  // 認証状態の変更を監視
  useEffect(() => {
    const unsubscribe = authAdapter.onAuthChange((user) => {
      setAuthState(authAdapter.authState);
      console.log('🔄 AuthProvider: Auth state changed:', user ? `User: ${user.email}` : 'No user');
    });

    return unsubscribe;
  }, [authAdapter]);

  // Magic linkトークンの処理
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token && isReady) {
      const verifyToken = async () => {
        try {
          const result = await authAdapter.verifyMagicLink(token);
          
          if (result.success) {
            console.log('✅ Magic link verified successfully');
            // URLからトークンを削除
            const newUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, newUrl);
          } else {
            console.error('❌ Magic link verification failed:', result.error);
          }
        } catch (error) {
          console.error('❌ Magic link verification error:', error);
        }
      };

      verifyToken();
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