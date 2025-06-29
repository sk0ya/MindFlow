import { useState, useEffect } from 'react';
import { authManager } from '../../../../features/auth/authManager.js';
import type { User } from '../../../../../shared/types/app.js';
// ローカルモードでは認証不要

/**
 * 認証関連のステートとハンドラーを管理するカスタムフック
 */
export const useAuthHandlers = (
  initState: { handleAuthSuccess: () => void },
  refreshAllMindMaps: () => Promise<void>,
  triggerLocalSync?: () => Promise<void>
) => {
  const [authState, setAuthState] = useState({
    isAuthenticated: authManager.isAuthenticated(),
    user: authManager.getCurrentUser(),
    isLoading: false
  });
  
  const [showAuthModal, setShowAuthModal] = useState(false);

  // 認証状態を監視して更新
  useEffect(() => {
    const checkAuthStatus = () => {
      const isAuth = authManager.isAuthenticated();
      const user = authManager.getCurrentUser();
      
      setAuthState(prev => {
        if (prev.isAuthenticated !== isAuth || prev.user !== user) {
          return {
            isAuthenticated: isAuth,
            user: user,
            isLoading: false
          };
        }
        return prev;
      });
    };
    
    // 初回チェック
    checkAuthStatus();
    
    // 🔧 統一: 認証チェック頻度を30秒に統一（競合防止）
    const interval = setInterval(checkAuthStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleShowAuthModal = () => {
    setShowAuthModal(true);
  };
  
  const handleCloseAuthModal = () => {
    setShowAuthModal(false);
  };
  
  const handleAuthSuccess = async (user: User) => {
    setAuthState({
      isAuthenticated: true,
      user: user,
      isLoading: false
    });
    
    // 初期化フローの認証成功を通知
    initState.handleAuthSuccess();
    
    // 🔧 改善: 認証成功後の処理を順次実行化（競合防止）
    try {
      // 1. マップ一覧をリフレッシュ
      await refreshAllMindMaps();
      console.log('🔄 認証成功後にマップ一覧をリフレッシュしました');
      
      // 2. リアルタイム同期を再初期化
      // ローカルモードではリアルタイム同期は不要
      console.log('🔄 認証成功後の初期化完了');
      
      // 3. ローカル同期をトリガー
      if (triggerLocalSync) {
        await triggerLocalSync();
        console.log('🔄 認証成功後のローカル同期完了');
      }
    } catch (error) {
      console.warn('⚠️ 認証成功後の初期化処理に失敗:', error);
    }
  };
  
  const handleLogout = async () => {
    try {
      await authManager.logout();
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false
      });
      // ログアウト後にページをリロードしてローカルデータを表示
      window.location.reload();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return {
    authState,
    setAuthState,
    showAuthModal,
    handleShowAuthModal,
    handleCloseAuthModal,
    handleAuthSuccess,
    handleLogout
  };
};