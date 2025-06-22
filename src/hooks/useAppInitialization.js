import { useState, useEffect } from 'react';
import { hasLocalData, isFirstTimeSetup, setStorageMode, getAppSettings } from '../utils/storage.js';

// アプリ初期化専用フック - シーケンスを一本化
export const useAppInitialization = () => {
  const [initState, setInitState] = useState({
    isInitializing: true,
    showStorageModeSelector: false,
    showAuthModal: false,
    showOnboarding: false,
    storageMode: null,
    hasExistingLocalData: false,
    isReady: false
  });

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 アプリ初期化シーケンス開始');
        
        // Step 1: ローカルデータ存在チェック
        const hasData = hasLocalData();
        const isFirstTime = isFirstTimeSetup();
        const settings = getAppSettings();
        
        console.log('📊 初期化状態:', {
          hasData,
          isFirstTime,
          currentStorageMode: settings.storageMode
        });

        // Step 2: フロー分岐
        if (hasData && !isFirstTime) {
          // ケース1: ローカルデータがある場合 → ローカル利用に流す
          console.log('📁 既存ローカルデータ発見 → ローカルモードで継続');
          
          if (settings.storageMode !== 'local') {
            await setStorageMode('local');
          }
          
          setInitState({
            isInitializing: false,
            showStorageModeSelector: false,
            showAuthModal: false,
            showOnboarding: false,
            storageMode: 'local',
            hasExistingLocalData: true,
            isReady: true
          });
          
        } else {
          // ケース2: ローカルデータがない場合 → ストレージ選択画面
          console.log('❓ ローカルデータなし → ストレージモード選択');
          
          setInitState(prev => ({
            ...prev,
            isInitializing: false,
            showStorageModeSelector: true,
            hasExistingLocalData: false
          }));
        }
        
      } catch (error) {
        console.error('❌ 初期化エラー:', error);
        // エラー時は安全にローカルモードで開始
        setInitState({
          isInitializing: false,
          showStorageModeSelector: false,
          showAuthModal: false,
          showOnboarding: false,
          storageMode: 'local',
          hasExistingLocalData: false,
          isReady: true
        });
      }
    };

    initializeApp();
  }, []);

  // ストレージモード選択処理
  const handleStorageModeSelect = async (mode) => {
    try {
      console.log('📝 ストレージモード選択:', mode);
      
      // ストレージモードを設定
      await setStorageMode(mode);
      
      if (mode === 'cloud') {
        // クラウドモード → 認証画面
        console.log('☁️ クラウドモード選択 → 認証画面表示');
        setInitState(prev => ({
          ...prev,
          showStorageModeSelector: false,
          showAuthModal: true,
          storageMode: 'cloud'
        }));
        
      } else {
        // ローカルモード → オンボーディング → 完了
        console.log('🏠 ローカルモード選択 → オンボーディング表示');
        setInitState(prev => ({
          ...prev,
          showStorageModeSelector: false,
          showOnboarding: true,
          storageMode: 'local'
        }));
      }
      
    } catch (error) {
      console.error('❌ ストレージモード設定エラー:', error);
    }
  };

  // 認証成功処理
  const handleAuthSuccess = () => {
    console.log('✅ 認証成功 → クラウドモード開始');
    setInitState(prev => ({
      ...prev,
      showAuthModal: false,
      isReady: true
    }));
  };

  // 認証モーダルクローズ処理
  const handleAuthClose = () => {
    console.log('❌ 認証キャンセル → ストレージ選択に戻る');
    setInitState(prev => ({
      ...prev,
      showAuthModal: false,
      showStorageModeSelector: true,
      storageMode: null
    }));
  };

  // オンボーディング完了処理
  const handleOnboardingComplete = () => {
    console.log('✅ オンボーディング完了 → ローカルモード開始');
    setInitState(prev => ({
      ...prev,
      showOnboarding: false,
      isReady: true
    }));
  };

  return {
    ...initState,
    handleStorageModeSelect,
    handleAuthSuccess,
    handleAuthClose,
    handleOnboardingComplete
  };
};