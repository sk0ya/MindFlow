import { useAppInitialization } from './useAppInitialization';
import { useMindMap } from './useMindMap';

// レンダータイプの型定義
export type RenderType = 
  | { type: 'AUTH_VERIFICATION'; props: { token: string } }
  | { type: 'LOADING'; props: { message: string } }
  | { type: 'STORAGE_SELECTOR'; props: { onModeSelect: (mode: 'local' | 'cloud') => void } }
  | { type: 'AUTH_MODAL'; props: { onClose: () => void; onAuthSuccess: () => void } }
  | { type: 'ONBOARDING'; props: { onComplete: () => void; onSkip: () => void } }
  | { type: 'MAIN_APP'; props: Record<string, never> };

// フックの戻り値の型定義
export interface AppRenderReturn {
  renderType: RenderType;
  mindMap: ReturnType<typeof useMindMap>;
  initState: ReturnType<typeof useAppInitialization>;
}

/**
 * アプリのレンダリング状態を管理するシンプルなフック
 * 初回起動と2回目以降の起動を統一して処理
 */
export const useAppRender = (): AppRenderReturn => {
  const initState = useAppInitialization();
  const mindMap = useMindMap(initState.isReady);

  // レンダリングタイプを決定（シーケンシャル）
  const getRenderType = (): RenderType => {
    // 1. URL認証検証中
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('token');
    const isAuthVerification = authToken && authToken.length > 20;
    
    if (isAuthVerification) {
      return { type: 'AUTH_VERIFICATION', props: { token: authToken } };
    }

    // 2. 初期化中（設定読み込み・ローカルデータ確認）
    if (initState.isInitializing) {
      return { type: 'LOADING', props: { message: 'アプリケーションを初期化中...' } };
    }

    // 3. 初回起動: ストレージモード選択
    if (initState.showStorageModeSelector) {
      return { 
        type: 'STORAGE_SELECTOR', 
        props: { onModeSelect: initState.handleStorageModeSelect }
      };
    }

    // 4. クラウドモード選択後: 認証画面
    if (initState.showAuthModal) {
      return { 
        type: 'AUTH_MODAL', 
        props: { 
          onClose: initState.handleAuthClose,
          onAuthSuccess: initState.handleAuthSuccess 
        }
      };
    }

    // 5. ローカルモード選択後: オンボーディング
    if (initState.showOnboarding) {
      return { 
        type: 'ONBOARDING', 
        props: { 
          onComplete: initState.handleOnboardingComplete,
          onSkip: initState.handleOnboardingComplete 
        }
      };
    }

    // 6. 初期化完了・データ読み込み中
    if (initState.isReady && !mindMap.data) {
      return { type: 'LOADING', props: { message: 'データを読み込み中...' } };
    }

    // 7. 準備未完了（エラー状態）
    if (!initState.isReady) {
      return { type: 'LOADING', props: { message: '準備中...' } };
    }

    // 8. データなし（エラー状態）
    if (!mindMap.data) {
      return { type: 'LOADING', props: { message: 'データ読み込みエラー...' } };
    }

    // 9. メインアプリ表示
    return { type: 'MAIN_APP', props: {} };
  };

  const renderType = getRenderType();

  // デバッグログ（簡潔）
  console.log('🎨 Render:', renderType.type, {
    isReady: initState.isReady,
    hasData: !!mindMap.data,
    storageMode: initState.storageMode
  });

  return {
    renderType,
    mindMap,
    initState
  };
};