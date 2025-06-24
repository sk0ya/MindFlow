import { useState, useEffect } from 'react';
import { authManager } from '../../../../features/auth/authManager.js';
import { realtimeSync } from '../../../../features/collaboration/realtimeSync.js';

/**
 * 認証関連のステートとハンドラーを管理するカスタムフック
 */
export const useAuthHandlers = (initState, refreshAllMindMaps, triggerCloudSync) => {
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
    
    // 定期的にチェック
    const interval = setInterval(checkAuthStatus, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleShowAuthModal = () => {
    setShowAuthModal(true);
  };
  
  const handleCloseAuthModal = () => {
    setShowAuthModal(false);
  };
  
  const handleAuthSuccess = async (user) => {
    setAuthState({
      isAuthenticated: true,
      user: user,
      isLoading: false
    });
    
    // 初期化フローの認証成功を通知
    initState.handleAuthSuccess();
    
    // リアルタイム同期を再初期化
    try {
      realtimeSync.reinitialize();
      console.log('🔄 認証成功後のリアルタイム同期再初期化完了');
    } catch (initError) {
      console.warn('⚠️ リアルタイム同期再初期化失敗:', initError);
    }
    
    // マップ一覧をリフレッシュ
    try {
      await refreshAllMindMaps();
      console.log('🔄 認証成功後にマップ一覧をリフレッシュしました');
    } catch (refreshError) {
      console.warn('⚠️ 認証後のマップ一覧リフレッシュに失敗:', refreshError);
    }
    
    // クラウド同期をトリガー
    if (triggerCloudSync) {
      try {
        await triggerCloudSync();
        console.log('🔄 認証成功後のクラウド同期完了');
      } catch (syncError) {
        console.warn('⚠️ クラウド同期に失敗:', syncError);
      }
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