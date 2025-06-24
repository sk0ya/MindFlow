import { STORAGE_KEYS, createInitialData } from './dataTypes.js';
import { safeGetItem, safeSetItem, getStorageInfo, checkStorageSpace } from './storageManager.js';

// ローカルストレージからデータを取得（安全版）
export const loadFromStorage = (key, defaultValue = null) => {
  return safeGetItem(key, defaultValue);
};

// ローカルストレージにデータを保存（安全版）
export const saveToStorage = async (key, data) => {
  try {
    const result = await safeSetItem(key, data);
    
    if (!result.success) {
      // 保存失敗時の通知
      console.error('ストレージ保存失敗:', result.error);
    
      // ユーザーに通知（可能な場合）
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('storage-error', {
          detail: {
            key,
            error: result.error,
            suggestion: 'ファイル添付や古いマップを削除して容量を確保してください'
          }
        }));
      }
      
      return false;
    }
    
    // 警告レベルの場合
    if (result.warning) {
      console.warn('ストレージ警告:', result.warning);
    
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('storage-warning', {
          detail: {
            message: result.warning,
            suggestion: 'ストレージ容量が不足してきています。不要なファイルを削除することをお勧めします。'
          }
        }));
      }
    }
    
    return true;
  } catch (error) {
    console.error('ストレージ保存中にエラーが発生:', error);
    return false;
  }
};










// アプリケーション設定
export const getAppSettings = () => {
  return loadFromStorage(STORAGE_KEYS.SETTINGS, {
    theme: 'default',
    autoSave: true,
    showWelcome: true,
    language: 'ja',
    storageMode: null, // 初期状態では未設定
    cloudSync: true, // デフォルトで自動同期を有効に
    realtimeSync: false // リアルタイム同期はデフォルト無効
  });
};

export const saveAppSettings = (settings) => {
  return saveToStorage(STORAGE_KEYS.SETTINGS, settings);
};

















