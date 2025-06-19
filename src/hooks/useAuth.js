import { useState, useEffect } from 'react';
import { authManager } from '../utils/authManager.js';

// 認証管理専用のカスタムフック
export const useAuth = () => {
  // URL パラメータで認証トークンをチェック
  const urlParams = new URLSearchParams(window.location.search);
  const authToken = urlParams.get('token');
  const isAuthVerification = authToken && authToken.length > 20;
  
  // 認証状態を管理
  const [authState, setAuthState] = useState({
    isAuthenticated: authManager.isAuthenticated(),
    user: authManager.getCurrentUser(),
    isLoading: false
  });
  
  // 認証状態の更新を監視
  useEffect(() => {
    const checkAuthState = () => {
      setAuthState({
        isAuthenticated: authManager.isAuthenticated(),
        user: authManager.getCurrentUser(),
        isLoading: false
      });
    };

    // 定期的に認証状態をチェック
    const authCheckInterval = setInterval(checkAuthState, 5000);
    
    return () => clearInterval(authCheckInterval);
  }, []);

  // 認証状態の更新
  const updateAuthState = (newState) => {
    setAuthState(prev => ({ ...prev, ...newState }));
  };

  return {
    authState,
    updateAuthState,
    isAuthVerification
  };
};