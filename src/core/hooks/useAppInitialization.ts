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
    pendingStorageMode: null, // 認証完了まで一時的に保持
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
      
      if (mode === 'cloud') {
        // クラウドモード → 認証完了まで設定を延期
        console.log('☁️ クラウドモード選択 → 認証画面表示（設定は認証後に永続化）');
        setInitState(prev => ({
          ...prev,
          showStorageModeSelector: false,
          showAuthModal: true,
          pendingStorageMode: 'cloud', // 一時的に保持
          storageMode: null // まだ永続化しない
        }));
        
      } else {
        // ローカルモード → 即座に設定して初期化
        console.log('🏠 ローカルモード選択 → 設定永続化と初期化');
        await setStorageMode(mode);
        reinitializeAdapter();
        
        setInitState(prev => ({
          ...prev,
          showStorageModeSelector: false,
          showOnboarding: true,
          storageMode: 'local',
          pendingStorageMode: null
        }));
      }
      
    } catch (error) {
      console.error('❌ ストレージモード設定エラー:', error);
    }
  };

  // 認証成功処理
  const handleAuthSuccess = async () => {
    console.log('✅ 認証成功 → クラウドモード設定を永続化');
    
    try {
      // pendingStorageMode をチェック
      if (initState.pendingStorageMode === 'cloud') {
        console.log('🔄 認証成功後のクラウドモード永続化と初期化開始');
        
        // 1. ストレージモードを永続化
        await setStorageMode('cloud');
        console.log('✅ クラウドモード設定が永続化されました');
        
        // 2. ストレージアダプターを再初期化（クラウドアダプターに切り替え）
        reinitializeAdapter();
        console.log('✅ クラウドストレージアダプターが作成されました');
        
        // 3. 状態を更新
        setInitState(prev => ({
          ...prev,
          showAuthModal: false,
          storageMode: 'cloud',
          pendingStorageMode: null,
          isReady: true
        }));
        
        console.log('✅ クラウドモード初期化完了');
      } else {
        // 通常の認証成功処理（既に認証済みの場合など）
        setInitState(prev => ({
          ...prev,
          showAuthModal: false,
          isReady: true
        }));
      }
    } catch (error) {
      console.error('❌ 認証成功後の初期化エラー:', error);
      // エラー時は認証画面を閉じるが、isReady は false のまま
      setInitState(prev => ({
        ...prev,
        showAuthModal: false
      }));
    }
  };

  // 認証モーダルクローズ処理
  const handleAuthClose = () => {
    console.log('❌ 認証キャンセル → ストレージ選択に戻る');
    setInitState(prev => ({
      ...prev,
      showAuthModal: false,
      showStorageModeSelector: true,
      storageMode: null,
      pendingStorageMode: null // ペンディング状態をクリア
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