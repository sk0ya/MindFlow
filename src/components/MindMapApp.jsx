import React, { useState, useEffect } from 'react';
import { useAppRender } from '../hooks/useAppRender.js';
import { useMindMapMulti } from '../hooks/useMindMapMulti.js';
import { authManager } from '../utils/authManager.js';
import { useOnboarding } from '../hooks/useOnboarding.js';
import './MindMapApp.css';

// レンダリングコンポーネント
import AuthVerification from './AuthVerification.jsx';
import AuthModal from './AuthModal.jsx';
import StorageModeSelector from './StorageModeSelector.jsx';
import TutorialOverlay from './TutorialOverlay.jsx';
import LoadingScreen from './LoadingScreen.jsx';
import MainApp from './MainApp.jsx';

const MindMapApp = () => {
  // レンダリング状態を取得
  const { renderType, mindMap, initState } = useAppRender();

  // グローバル認証状態
  const [authState, setAuthState] = useState({
    isAuthenticated: authManager.isAuthenticated(),
    user: authManager.getCurrentUser(),
    isLoading: false
  });

  // ローカルUI状態（メインアプリで使用）
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { showOnboarding, completeOnboarding, setShowOnboarding } = useOnboarding();

  // マルチマップ管理
  const multiMapOps = useMindMapMulti(
    mindMap.data,
    mindMap.setData,
    mindMap.updateData
  );

  // 認証状態監視
  useEffect(() => {
    const handleAuthChange = () => {
      setAuthState({
        isAuthenticated: authManager.isAuthenticated(),
        user: authManager.getCurrentUser(),
        isLoading: false
      });
    };

    // 認証成功時のクラウド同期
    if (authState.isAuthenticated && mindMap.triggerCloudSync) {
      mindMap.triggerCloudSync();
    }

    window.addEventListener('authStateChange', handleAuthChange);
    return () => window.removeEventListener('authStateChange', handleAuthChange);
  }, [authState.isAuthenticated, mindMap.triggerCloudSync]);

  // 認証成功ハンドラー（統一）
  const handleAuthSuccess = (user) => {
    setAuthState({ isAuthenticated: true, user, isLoading: false });
    
    // initStateの認証モーダル or ローカル認証モーダル
    if (initState.showAuthModal && initState.handleAuthSuccess) {
      initState.handleAuthSuccess();
    } else {
      setShowAuthModal(false);
    }
    
    window.dispatchEvent(new CustomEvent('authStateChange'));
  };

  // レンダリングタイプに応じてコンポーネントを返す
  switch (renderType.type) {
    case 'AUTH_VERIFICATION':
      return <AuthVerification token={renderType.props.token} />;

    case 'LOADING':
      return <LoadingScreen message={renderType.props.message} />;

    case 'STORAGE_SELECTOR':
      return (
        <div className="mindmap-app">
          <StorageModeSelector onModeSelect={renderType.props.onModeSelect} />
        </div>
      );

    case 'AUTH_MODAL':
      return (
        <div className="mindmap-app">
          <AuthModal
            isOpen={true}
            onClose={renderType.props.onClose}
            onAuthSuccess={handleAuthSuccess}
          />
        </div>
      );

    case 'ONBOARDING':
      return (
        <div className="mindmap-app">
          <TutorialOverlay
            onComplete={renderType.props.onComplete}
            onSkip={renderType.props.onSkip}
          />
        </div>
      );

    case 'MAIN_APP':
      return (
        <MainApp
          mindMap={mindMap}
          multiMapOps={multiMapOps}
          authState={authState}
          setAuthState={setAuthState}
          showAuthModal={showAuthModal}
          setShowAuthModal={setShowAuthModal}
          showOnboarding={showOnboarding}
          completeOnboarding={completeOnboarding}
          setShowOnboarding={setShowOnboarding}
        />
      );

    default:
      return <LoadingScreen message="不明なエラーが発生しました" />;
  }
};

export default MindMapApp;