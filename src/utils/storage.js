import { STORAGE_KEYS, createInitialData } from './dataTypes.js';
import { syncManager } from './syncManager.js';
import { cloudStorage } from './cloudStorage.js';

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
  const maps = loadFromStorage(STORAGE_KEYS.MINDMAPS, []);
  // 無効なデータをフィルターして除外
  const validMaps = maps.filter(map => {
    if (!map || !map.id || typeof map.id !== 'string') {
      console.warn('Invalid map filtered out (missing id):', map);
      return false;
    }
    if (!map.rootNode) {
      console.warn('Invalid map filtered out (missing rootNode):', map);
      return false;
    }
    return true;
  });
  
  // フィルター後のデータを保存（破損データをクリーンアップ）
  if (validMaps.length !== maps.length) {
    console.log(`Cleaning up corrupted mindmaps from localStorage: ${maps.length - validMaps.length} 件削除`);
    console.log('有効なマップ数:', validMaps.length);
    saveToStorage(STORAGE_KEYS.MINDMAPS, validMaps);
  }
  
  return validMaps;
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
    cloudSync: true // デフォルトで自動同期を有効に
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
      try {
        syncManager.recordOfflineOperation('save', mindMapData.id, mindMapData);
      } catch (syncError) {
        console.error('Failed to add to sync queue:', syncError);
      }
    }
  }
  
  return localResult;
};

// ハイブリッド取得（クラウド優先、フォールバックでローカル）
export const getAllMindMapsHybrid = async () => {
  const settings = getAppSettings();
  
  if (settings.storageMode === 'cloud') {
    try {
      const cloudStorageModule = await import('./cloudStorage.js');
    const cloudStorage = cloudStorageModule.cloudStorage;
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
      try {
        syncManager.recordOfflineOperation('delete', mapId);
      } catch (syncError) {
        console.error('Failed to add to sync queue:', syncError);
      }
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
  try {
    // 動的インポートは同期的に使えないため、デフォルト値を返す
    return {
      isOnline: navigator.onLine,
      queueLength: 0,
      lastSyncTime: null,
      needsSync: false
    };
  } catch (error) {
    console.error('Failed to get sync status:', error);
    return {
      isOnline: false,
      queueLength: 0,
      lastSyncTime: null,
      needsSync: false
    };
  }
};

// デバッグ用：破損データをクリーンアップ
export const cleanupCorruptedData = () => {
  try {
    const maps = loadFromStorage(STORAGE_KEYS.MINDMAPS, []);
    console.log('クリーンアップ前のマップ数:', maps.length);
    
    // 破損データを特定
    const corruptedMaps = maps.filter(map => !map || !map.id || !map.rootNode);
    const validMaps = maps.filter(map => map && map.id && map.rootNode);
    
    console.log('破損したマップ:', corruptedMaps);
    console.log('有効なマップ数:', validMaps.length);
    
    // 有効なデータのみ保存
    saveToStorage(STORAGE_KEYS.MINDMAPS, validMaps);
    
    return {
      before: maps.length,
      after: validMaps.length,
      removed: corruptedMaps.length,
      corruptedMaps
    };
  } catch (error) {
    console.error('Cleanup failed:', error);
    return null;
  }
};

// デバッグ用：全データを表示
export const debugStorageData = () => {
  try {
    const maps = loadFromStorage(STORAGE_KEYS.MINDMAPS, []);
    console.log('=== LocalStorage Debug ===');
    console.log('Total maps:', maps.length);
    
    maps.forEach((map, index) => {
      console.log(`Map ${index + 1}:`, {
        id: map?.id,
        title: map?.title,
        hasRootNode: !!map?.rootNode,
        source: map?.source,
        createdAt: map?.createdAt || map?.created_at,
        updatedAt: map?.updatedAt || map?.updated_at
      });
    });
    
    return maps;
  } catch (error) {
    console.error('Debug failed:', error);
    return null;
  }
};
