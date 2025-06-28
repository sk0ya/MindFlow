import { STORAGE_KEYS, createInitialData } from '../../shared/types/dataTypes.js';
// Cloud-only storage utilities - localStorage dependencies removed

// In-memory settings storage for cloud-only mode
let cloudSettings = {
  theme: 'default',
  autoSave: true,
  showWelcome: true,
  language: 'ja',
  storageMode: 'cloud', // Fixed to cloud mode
  cloudSync: true,
  enableRealtimeSync: true
};

// アプリケーション設定 - クラウド専用
export const getAppSettings = () => {
  return { ...cloudSettings };
};

export const saveAppSettings = (settings) => {
  cloudSettings = { ...cloudSettings, ...settings };
  console.log('⚙️ Cloud settings updated:', cloudSettings);
  return true;
};