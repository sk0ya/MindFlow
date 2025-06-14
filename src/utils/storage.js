import { STORAGE_KEYS, createInitialData } from './dataTypes.js';
import { cloudStorage } from './cloudStorage.js';
import { syncManager } from './syncManager.js';

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

// すべてのマインドマップを取得
export const getAllMindMaps = () => {
  return loadFromStorage(STORAGE_KEYS.MINDMAPS, []);
};

// マインドマップを保存
export const saveMindMap = (mindMapData) => {
  const allMaps = getAllMindMaps();
  const existingIndex = allMaps.findIndex(map => map.id === mindMapData.id);
  
  const updatedData = {
    ...mindMapData,
    updatedAt: new Date().toISOString()
  };
  
  if (existingIndex >= 0) {
    allMaps[existingIndex] = updatedData;
  } else {
    allMaps.push(updatedData);
  }
  
  saveToStorage(STORAGE_KEYS.MINDMAPS, allMaps);
  saveToStorage(STORAGE_KEYS.CURRENT_MAP, updatedData);
  
  return updatedData;
};

// 現在のマインドマップを取得
export const getCurrentMindMap = () => {
  let currentMap = loadFromStorage(STORAGE_KEYS.CURRENT_MAP);
  
  if (!currentMap) {
    currentMap = createInitialData();
    saveToStorage(STORAGE_KEYS.CURRENT_MAP, currentMap);
  }
  
  return currentMap;
};

// マインドマップを削除
export const deleteMindMap = (mapId) => {
  const allMaps = getAllMindMaps();
  const filteredMaps = allMaps.filter(map => map.id !== mapId);
  saveToStorage(STORAGE_KEYS.MINDMAPS, filteredMaps);
  
  const currentMap = loadFromStorage(STORAGE_KEYS.CURRENT_MAP);
  if (currentMap && currentMap.id === mapId) {
    const newCurrentMap = filteredMaps.length > 0 ? filteredMaps[0] : createInitialData();
    saveToStorage(STORAGE_KEYS.CURRENT_MAP, newCurrentMap);
    return newCurrentMap;
  }
  
  return currentMap;
};

// 新しいマインドマップを作成
export const createNewMindMap = (title = '新しいマインドマップ') => {
  const newMap = createInitialData();
  newMap.title = title;
  return saveMindMap(newMap);
};

// データをJSONでエクスポート
export const exportMindMapAsJSON = (mindMapData) => {
  const dataStr = JSON.stringify(mindMapData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = `${mindMapData.title || 'mindmap'}.json`;
  link.click();
  
  URL.revokeObjectURL(link.href);
};

// JSONファイルからインポート
export const importMindMapFromJSON = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const mindMapData = JSON.parse(e.target.result);
        
        // 基本的なデータ検証
        if (!mindMapData.rootNode || !mindMapData.id) {
          throw new Error('Invalid mind map format');
        }
        
        const importedMap = saveMindMap(mindMapData);
        resolve(importedMap);
      } catch (error) {
        reject(new Error('Failed to parse mind map file: ' + error.message));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

// アプリケーション設定
export const getAppSettings = () => {
  return loadFromStorage(STORAGE_KEYS.SETTINGS, {
    theme: 'default',
    autoSave: true,
    showWelcome: true,
    language: 'ja',
    storageMode: 'local', // 'local' or 'cloud'
    cloudSync: false
  });
};

export const saveAppSettings = (settings) => {
  return saveToStorage(STORAGE_KEYS.SETTINGS, settings);
};

// クラウドストレージ機能
export const isCloudStorageEnabled = () => {
  const settings = getAppSettings();
  return settings.storageMode === 'cloud';
};

// ハイブリッド保存（ローカル+クラウド）
export const saveMindMapHybrid = async (mindMapData) => {
  const settings = getAppSettings();
  
  // ローカルに保存（常に実行）
  const localResult = saveMindMap(mindMapData);
  
  // クラウドモードまたは同期が有効な場合はクラウドにも保存
  if (settings.storageMode === 'cloud' || settings.cloudSync) {
    try {
      if (syncManager.getSyncStatus().isOnline) {
        await cloudStorage.updateMindMap(mindMapData.id, mindMapData);
        console.log('Cloud save successful');
      } else {
        // オフライン時は同期キューに追加
        syncManager.recordOfflineOperation('save', mindMapData.id, mindMapData);
        console.log('Offline: Added to sync queue');
      }
    } catch (error) {
      console.warn('Cloud save failed, adding to sync queue:', error);
      // 失敗した場合も同期キューに追加
      syncManager.recordOfflineOperation('save', mindMapData.id, mindMapData);
    }
  }
  
  return localResult;
};

// ハイブリッド取得（クラウド優先、フォールバックでローカル）
export const getAllMindMapsHybrid = async () => {
  const settings = getAppSettings();
  
  if (settings.storageMode === 'cloud') {
    try {
      const cloudResult = await cloudStorage.getAllMindMaps();
      return cloudResult.mindmaps || [];
    } catch (error) {
      console.warn('Cloud fetch failed, using local:', error);
    }
  }
  
  return getAllMindMaps();
};

// ハイブリッド削除
export const deleteMindMapHybrid = async (mapId) => {
  const settings = getAppSettings();
  
  // ローカルから削除
  const localResult = deleteMindMap(mapId);
  
  // クラウドモードまたは同期が有効な場合はクラウドからも削除
  if (settings.storageMode === 'cloud' || settings.cloudSync) {
    try {
      if (syncManager.getSyncStatus().isOnline) {
        await cloudStorage.deleteMindMap(mapId);
        console.log('Cloud delete successful');
      } else {
        // オフライン時は同期キューに追加
        syncManager.recordOfflineOperation('delete', mapId);
        console.log('Offline: Added delete to sync queue');
      }
    } catch (error) {
      console.warn('Cloud delete failed, adding to sync queue:', error);
      syncManager.recordOfflineOperation('delete', mapId);
    }
  }
  
  return localResult;
};

// クラウド接続テスト
export const testCloudConnection = async () => {
  try {
    return await cloudStorage.testConnection();
  } catch (error) {
    console.error('Cloud connection test failed:', error);
    return false;
  }
};

// 同期機能
export const syncWithCloud = async () => {
  try {
    return await syncManager.forcSync();
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
};

export const getSyncStatus = () => {
  return syncManager.getSyncStatus();
};
