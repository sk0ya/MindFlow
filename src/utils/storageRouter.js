// ストレージモード切り替えロジック専用ルーター
import { getAppSettings, saveAppSettings } from './storage.js';

// 初回セットアップ完了チェック
export const isFirstTimeSetup = () => {
  const settings = getAppSettings();
  return !settings || !settings.storageMode;
};

// ストレージモード判定
export const isCloudStorageEnabled = () => {
  const settings = getAppSettings();
  return settings.storageMode === 'cloud';
};

export const isLocalStorageEnabled = () => {
  const settings = getAppSettings();
  return settings.storageMode === 'local';
};

// ストレージモード設定
export const setStorageMode = async (mode) => {
  const settings = getAppSettings();
  const updatedSettings = {
    ...settings,
    storageMode: mode,
    autoSave: true,
    cloudSync: mode === 'cloud'
  };
  
  console.log('📝 ストレージモード設定:', mode, updatedSettings);
  await saveAppSettings(updatedSettings);
  
  if (mode === 'cloud') {
    console.log('☁️ クラウドモード: ローカルデータアクセスを無効化');
  }
  
  return updatedSettings;
};

// 統一インターファェース - 全てのマインドマップを取得
export const getAllMindMaps = async () => {
  if (isCloudStorageEnabled()) {
    const { cloudStorage } = await import('./cloudStorage.js');
    return await cloudStorage.getAllMindMapsCloud();
  } else {
    const { getAllMindMapsLocal } = await import('./localStorage.js');
    return getAllMindMapsLocal();
  }
};

// 統一インターファェース - 現在のマインドマップを取得
export const getCurrentMindMap = async () => {
  if (isCloudStorageEnabled()) {
    console.log('☁️ クラウドモード: getCurrentMindMap をスキップ（個別ロード方式）');
    return null;
  } else {
    const { getCurrentMindMapLocal } = await import('./localStorage.js');
    return getCurrentMindMapLocal();
  }
};

// 統一インターファェース - マインドマップ保存
export const saveMindMap = async (mindMapData) => {
  if (isCloudStorageEnabled()) {
    const { cloudStorage } = await import('./cloudStorage.js');
    return await cloudStorage.updateMindMapCloud(mindMapData.id, mindMapData);
  } else {
    const { saveMindMapLocal } = await import('./localStorage.js');
    return await saveMindMapLocal(mindMapData);
  }
};

// 統一インターファェース - マインドマップ削除
export const deleteMindMap = async (mapId) => {
  if (isCloudStorageEnabled()) {
    const { cloudStorage } = await import('./cloudStorage.js');
    await cloudStorage.deleteMindMapCloud(mapId);
    return null; // クラウドでは削除後の現在マップは管理しない
  } else {
    const { deleteMindMapLocal } = await import('./localStorage.js');
    return deleteMindMapLocal(mapId);
  }
};

// 統一インターファェース - 新しいマインドマップ作成
export const createNewMindMap = async (title = '新しいマインドマップ') => {
  if (isCloudStorageEnabled()) {
    const { cloudStorage } = await import('./cloudStorage.js');
    const { createInitialData } = await import('./dataTypes.js');
    const newMap = createInitialData();
    newMap.title = title;
    return await cloudStorage.createMindMapCloud(newMap);
  } else {
    const { createNewMindMapLocal } = await import('./localStorage.js');
    return await createNewMindMapLocal(title);
  }
};

// 統一インターファェース - 特定マップ取得
export const getMindMap = async (mapId) => {
  if (isCloudStorageEnabled()) {
    const { cloudStorage } = await import('./cloudStorage.js');
    return await cloudStorage.getMindMapCloud(mapId);
  } else {
    const { getAllMindMapsLocal } = await import('./localStorage.js');
    const maps = getAllMindMapsLocal();
    const map = maps.find(m => m.id === mapId);
    if (!map) {
      throw new Error(`ローカルマップが見つかりません: ${mapId}`);
    }
    return map;
  }
};

// 統一インターファェース - エクスポート
export const exportMindMapAsJSON = async (mindMapData) => {
  if (isCloudStorageEnabled()) {
    // クラウドでも同じエクスポート機能を使用
    const { exportMindMapAsJSONLocal } = await import('./localStorage.js');
    exportMindMapAsJSONLocal(mindMapData);
  } else {
    const { exportMindMapAsJSONLocal } = await import('./localStorage.js');
    exportMindMapAsJSONLocal(mindMapData);
  }
};

// 統一インターファェース - インポート
export const importMindMapFromJSON = async (file) => {
  if (isCloudStorageEnabled()) {
    // JSONパース部分は共通、保存先だけ異なる
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const mindMapData = JSON.parse(e.target.result);
          
          if (!mindMapData.rootNode || !mindMapData.id) {
            throw new Error('Invalid mind map format');
          }
          
          const { cloudStorage } = await import('./cloudStorage.js');
          const importedMap = await cloudStorage.createMindMapCloud(mindMapData);
          resolve(importedMap);
        } catch (error) {
          reject(new Error('Failed to parse mind map file: ' + error.message));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  } else {
    const { importMindMapFromJSONLocal } = await import('./localStorage.js');
    return await importMindMapFromJSONLocal(file);
  }
};

// 接続テスト
export const testCloudConnection = async () => {
  try {
    const { authManager } = await import('./authManager.js');
    const { cloudStorage } = await import('./cloudStorage.js');
    
    if (!authManager.isAuthenticated()) {
      return false;
    }
    
    return await cloudStorage.testConnectionCloud();
  } catch (error) {
    console.error('クラウド接続テスト失敗:', error);
    return false;
  }
};

// 同期状態取得
export const getSyncStatus = () => {
  try {
    return {
      isOnline: navigator.onLine,
      queueLength: 0,
      lastSyncTime: null,
      needsSync: false
    };
  } catch (error) {
    console.error('同期状態取得失敗:', error);
    return {
      isOnline: false,
      queueLength: 0,
      lastSyncTime: null,
      needsSync: false
    };
  }
};