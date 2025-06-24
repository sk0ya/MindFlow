import { useState, useEffect } from 'react';
import { getAppSettings, saveAppSettings } from '../storage/storageUtils.js';

// オンボーディング管理用カスタムフック
export const useOnboarding = () => {
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const settings = getAppSettings();
        
        // オンボーディングを表示する条件：
        // 1. 初回セットアップ（storageMode未設定）
        // 2. showWelcomeが有効
        // 3. ローカルモード（クラウドモードでは表示しない）
        const isFirstTime = !settings.storageMode;
        const isLocalMode = settings.storageMode === 'local';
        const welcomeEnabled = settings.showWelcome;
        
        console.log('🎯 オンボーディング状態チェック:', {
          isFirstTime,
          isLocalMode, 
          welcomeEnabled,
          storageMode: settings.storageMode
        });
        
        // 初回ローカル利用時のみオンボーディングを表示
        const shouldShow = isFirstTime || (isLocalMode && welcomeEnabled);
        setShouldShowOnboarding(shouldShow);
        
      } catch (error) {
        console.error('オンボーディング状態チェックエラー:', error);
        setShouldShowOnboarding(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkOnboardingStatus();
  }, []);

  // オンボーディング完了処理
  const completeOnboarding = async () => {
    try {
      const settings = getAppSettings();
      const updatedSettings = {
        ...settings,
        showWelcome: false
      };
      
      await saveAppSettings(updatedSettings);
      setShouldShowOnboarding(false);
      
      console.log('✅ オンボーディング完了');
    } catch (error) {
      console.error('オンボーディング完了処理エラー:', error);
    }
  };

  // オンボーディングスキップ処理
  const skipOnboarding = async () => {
    await completeOnboarding();
  };

  return {
    shouldShowOnboarding,
    isChecking,
    completeOnboarding,
    skipOnboarding
  };
};