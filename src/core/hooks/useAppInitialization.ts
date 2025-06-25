import { useState, useEffect } from 'react';
import { isFirstTimeSetup, setStorageMode } from '../storage/storageRouter.js';
import { getAppSettings } from '../storage/storageUtils.js';
import { hasLocalData } from '../storage/localStorage.js';
import { authManager } from '../../features/auth/authManager.js';
import { reinitializeAdapter } from '../storage/storageAdapter.js';

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

        // Step 2: フロー分岐（設定優先）
        if (settings.storageMode) {
          // ケース1: 既にストレージモードが設定されている場合
          console.log('⚙️ 設定済みストレージモード:', settings.storageMode);
          
          if (settings.storageMode === 'local') {
            // ローカルモード
            setInitState({
              isInitializing: false,
              showStorageModeSelector: false,
              showAuthModal: false,
              showOnboarding: false,
              storageMode: 'local',
              hasExistingLocalData: hasData,
              isReady: true
            });
          } else if (settings.storageMode === 'cloud') {
            // クラウドモード - 認証状態をチェック
            const isAuthenticated = authManager.isAuthenticated();
            
            console.log('☁️ クラウドモード: 認証状態 =', isAuthenticated);
            
            if (isAuthenticated) {
              // 認証済み - 直接アプリ開始
              setInitState({
                isInitializing: false,
                showStorageModeSelector: false,
                showAuthModal: false,
                showOnboarding: false,
                storageMode: 'cloud',
                hasExistingLocalData: hasData,
                isReady: true
              });
            } else {
              // 未認証 - 認証画面を表示
              setInitState({
                isInitializing: false,
                showStorageModeSelector: false,
                showAuthModal: true,
                showOnboarding: false,
                storageMode: 'cloud',
                hasExistingLocalData: hasData,
                isReady: false
              });
            }
          }
          
        } else {
          // ケース2: ストレージモード未設定の場合
          if (hasData && !isFirstTime) {
            // ローカルデータがある場合はローカルモードを提案
            console.log('📁 既存ローカルデータ発見 → ローカルモードで継続');
            await setStorageMode('local');
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
            // ローカルデータがない場合はストレージ選択画面
            console.log('❓ ローカルデータなし → ストレージモード選択');
            setInitState(prev => ({
              ...prev,
              isInitializing: false,
              showStorageModeSelector: true,
              hasExistingLocalData: false,
              isReady: false // ストレージ選択中はisReady=falseを維持
            }));
          }
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
      
      // ストレージアダプターを再初期化
      console.log('🔄 ストレージモード選択後のアダプター再初期化');
      reinitializeAdapter();
      
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
  const handleAuthSuccess = async () => {
    console.log('✅ 認証成功 → クラウドモード開始');
    
    // 認証成功後にストレージアダプターを再初期化（クラウドアダプターに切り替え）
    console.log('🔄 認証成功後のストレージアダプター再初期化');
    reinitializeAdapter();
    
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