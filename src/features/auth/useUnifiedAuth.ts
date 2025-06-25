/**
 * 統一認証Reactフック
 * 型安全な認証操作とUI状態管理を提供
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  UseUnifiedAuthResult, 
  AuthState, 
  AuthEventHandler,
  MagicLinkOptions,
  GoogleOAuthOptions,
  GitHubOAuthOptions
} from './types/authTypes.js';
import { unifiedAuthManager } from './UnifiedAuthManager.js';

export const useUnifiedAuth = (): UseUnifiedAuthResult => {
  // ===== 状態管理 =====
  
  const [state, setState] = useState<AuthState>(unifiedAuthManager.state);
  const [showModal, setShowModal] = useState(false);
  const cleanupRef = useRef<(() => void)[]>([]);

  // ===== イベントハンドラー =====

  const handleStateChange: AuthEventHandler = useCallback((event) => {
    if (event.type === 'state_change' || 
        event.type === 'login' || 
        event.type === 'logout' ||
        event.type === 'token_refresh') {
      setState(unifiedAuthManager.state);
    }
  }, []);

  const handleError: AuthEventHandler = useCallback((event) => {
    console.error('Auth error:', event.data.error);
    setState(unifiedAuthManager.state);
  }, []);

  // ===== エフェクト =====

  useEffect(() => {
    // イベントリスナーを登録
    const unsubscribeStateChange = unifiedAuthManager.addEventListener('state_change', handleStateChange);
    const unsubscribeLogin = unifiedAuthManager.addEventListener('login', handleStateChange);
    const unsubscribeLogout = unifiedAuthManager.addEventListener('logout', handleStateChange);
    const unsubscribeTokenRefresh = unifiedAuthManager.addEventListener('token_refresh', handleStateChange);
    const unsubscribeError = unifiedAuthManager.addEventListener('error', handleError);

    // クリーンアップ関数を保存
    cleanupRef.current = [
      unsubscribeStateChange,
      unsubscribeLogin,
      unsubscribeLogout,
      unsubscribeTokenRefresh,
      unsubscribeError
    ];

    // 初期状態を同期
    setState(unifiedAuthManager.state);

    // クリーンアップ
    return () => {
      cleanupRef.current.forEach(cleanup => cleanup());
    };
  }, [handleStateChange, handleError]);

  // ===== 認証操作 =====

  const loginWithEmail = useCallback(async (
    email: string, 
    options?: Omit<MagicLinkOptions, 'email'>
  ): Promise<void> => {
    try {
      const result = await unifiedAuthManager.login('email', { email, ...options });
      
      if (!result.success) {
        throw new Error(result.error || 'Email login failed');
      }
    } catch (error) {
      console.error('Email login error:', error);
      throw error;
    }
  }, []);

  const loginWithGoogle = useCallback(async (
    options?: GoogleOAuthOptions
  ): Promise<void> => {
    try {
      const result = await unifiedAuthManager.login('google', options);
      
      if (!result.success) {
        throw new Error(result.error || 'Google login failed');
      }
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  }, []);

  const loginWithGitHub = useCallback(async (
    options?: GitHubOAuthOptions
  ): Promise<void> => {
    try {
      const result = await unifiedAuthManager.login('github', options);
      
      if (!result.success) {
        throw new Error(result.error || 'GitHub login failed');
      }
    } catch (error) {
      console.error('GitHub login error:', error);
      throw error;
    }
  }, []);

  const verifyToken = useCallback(async (token: string): Promise<void> => {
    try {
      const result = await unifiedAuthManager.verifyToken(token);
      
      if (!result.success) {
        throw new Error(result.error || 'Token verification failed');
      }
    } catch (error) {
      console.error('Token verification error:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await unifiedAuthManager.logout();
      setShowModal(false); // ログアウト時はモーダルを閉じる
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }, []);

  // ===== UI操作 =====

  const openModal = useCallback(() => {
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    unifiedAuthManager.clearError(); // モーダルを閉じる時はエラーもクリア
  }, []);

  // ===== ユーティリティ =====

  const clearError = useCallback(() => {
    unifiedAuthManager.clearError();
  }, []);

  const healthCheck = useCallback(async (): Promise<boolean> => {
    try {
      return await unifiedAuthManager.healthCheck();
    } catch (error) {
      console.error('Health check error:', error);
      return false;
    }
  }, []);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      return await unifiedAuthManager.refreshToken();
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }, []);

  // ===== 戻り値 =====

  return {
    // 状態
    state,
    isLoading: state.isLoading,
    error: state.error,
    
    // 認証操作
    loginWithEmail,
    loginWithGoogle,
    loginWithGitHub,
    verifyToken,
    logout,
    
    // UI状態
    showModal,
    openModal,
    closeModal,
    
    // ユーティリティ
    clearError,
    healthCheck,
    refreshToken
  };
};

// ===== 便利なカスタムフック =====

/**
 * 認証が必要なページで使用するフック
 * 未認証の場合は自動的にログインモーダルを表示
 */
export const useRequireAuth = () => {
  const auth = useUnifiedAuth();

  useEffect(() => {
    if (!auth.state.isAuthenticated && !auth.isLoading) {
      auth.openModal();
    }
  }, [auth.state.isAuthenticated, auth.isLoading, auth.openModal]);

  return auth;
};

/**
 * 認証状態の変化を監視するフック
 */
export const useAuthStateChange = (
  onLogin?: (user: any) => void,
  onLogout?: () => void
) => {
  const auth = useUnifiedAuth();

  useEffect(() => {
    const handleLogin = (event: any) => {
      if (onLogin && event.data?.user) {
        onLogin(event.data.user);
      }
    };

    const handleLogout = () => {
      if (onLogout) {
        onLogout();
      }
    };

    const unsubscribeLogin = unifiedAuthManager.addEventListener('login', handleLogin);
    const unsubscribeLogout = unifiedAuthManager.addEventListener('logout', handleLogout);

    return () => {
      unsubscribeLogin();
      unsubscribeLogout();
    };
  }, [onLogin, onLogout]);

  return auth;
};

/**
 * Magic Link検証用フック
 * URLパラメータからトークンを取得して自動検証
 */
export const useMagicLinkVerification = () => {
  const auth = useUnifiedAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const type = urlParams.get('type');

    if (token && type === 'magic-link' && !auth.state.isAuthenticated) {
      setIsVerifying(true);
      setVerificationError(null);

      unifiedAuthManager.verifyMagicLink(token)
        .then(result => {
          if (!result.success) {
            setVerificationError(result.error || 'Verification failed');
          } else {
            // 成功時はURLからパラメータを削除
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('token');
            newUrl.searchParams.delete('type');
            window.history.replaceState({}, '', newUrl.toString());
          }
        })
        .catch(error => {
          setVerificationError(error.message || 'Verification failed');
        })
        .finally(() => {
          setIsVerifying(false);
        });
    }
  }, [auth.state.isAuthenticated]);

  return {
    isVerifying,
    verificationError,
    clearVerificationError: () => setVerificationError(null)
  };
};