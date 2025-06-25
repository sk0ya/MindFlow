import { STORAGE_KEYS, createInitialData } from '../../shared/types/dataTypes.js';
import { safeGetItem, safeSetItem, getStorageInfo, checkStorageSpace } from './storageManager.js';

// ローカルエンジンから機能をインポート
import { localEngine } from './local/LocalEngine.js';

// ローカルストレージからデータを取得（localStorage.jsに統一）
export const loadFromStorage = safeGetItem;

// ローカルストレージにデータを保存（localStorage.jsに統一）
export const saveToStorage = safeSetItem;










// アプリケーション設定
export const getAppSettings = () => {
  return loadFromStorage(STORAGE_KEYS.SETTINGS, {
    theme: 'default',
    autoSave: true,
    showWelcome: true,
    language: 'ja',
    storageMode: null, // 初期状態では未設定
    cloudSync: true, // デフォルトで自動同期を有効に
    enableRealtimeSync: true // リアルタイム同期を有効化
  });
};

export const saveAppSettings = (settings) => {
  return saveToStorage(STORAGE_KEYS.SETTINGS, settings);
};

















