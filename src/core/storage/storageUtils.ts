import { STORAGE_KEYS, createInitialData } from '../../shared/types/dataTypes.js';
// LocalStorage utilities directly implemented

// ローカルエンジンから機能をインポート
import { localEngine } from './local/LocalEngine.js';

// ローカルストレージからデータを取得
export const loadFromStorage = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Storage load error:', error);
    return defaultValue;
  }
};

// ローカルストレージにデータを保存
export const saveToStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Storage save error:', error);
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
    enableRealtimeSync: true // リアルタイム同期を有効化
  });
};

export const saveAppSettings = (settings) => {
  return saveToStorage(STORAGE_KEYS.SETTINGS, settings);
};

















