import { STORAGE_KEYS, createInitialData } from './dataTypes.js';

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
    // 初回起動時: 新しいマップを作成して全体のリストにも追加
    currentMap = createInitialData();
    saveToStorage(STORAGE_KEYS.CURRENT_MAP, currentMap);
    
    // 全体のマップリストにも追加
    const allMaps = getAllMindMaps();
    if (!allMaps.find(map => map.id === currentMap.id)) {
      allMaps.push(currentMap);
      saveToStorage(STORAGE_KEYS.MINDMAPS, allMaps);
    }
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
  try {
    // 認証マネージャーを動的にインポート
    const { authManager } = await import('./authManager.js');
    const { cloudStorage } = await import('./cloudStorage.js');
    
    const isAuthenticated = authManager.isAuthenticated();
    const currentUser = authManager.getCurrentUser();
    
    console.log('🔄 saveMindMapHybrid 実行:', {
      mapId: mindMapData.id,
      mapTitle: mindMapData.title,
      isAuthenticated,
      currentUser: currentUser ? {
        userId: currentUser.userId,
        email: currentUser.email,
        id: currentUser.id
      } : null
    });
    
    // 認証されている場合はクラウドに保存を試行
    if (isAuthenticated) {
      try {
        console.log('☁️ クラウド保存開始:', mindMapData.id);
        const result = await cloudStorage.updateMindMap(mindMapData.id, mindMapData);
        console.log('✅ クラウド保存成功:', result);
        
        // クラウド保存成功時でもローカルにもバックアップとして保存
        const localResult = saveMindMap(mindMapData);
        return { ...localResult, source: 'cloud' };
      } catch (cloudError) {
        console.warn('❌ クラウド保存失敗、ローカルにフォールバック:', cloudError);
        // クラウド保存失敗時はローカルに保存
        return saveMindMap(mindMapData);
      }
    } else {
      console.log('🏠 未認証のためローカル保存のみ');
      // 認証されていない場合はローカルのみに保存
      return saveMindMap(mindMapData);
    }
  } catch (error) {
    console.error('💥 Hybrid save error:', error);
    // エラー時はローカルに保存
    return saveMindMap(mindMapData);
  }
};

// ハイブリッド取得（クラウド優先、フォールバックでローカル）
export const getAllMindMapsHybrid = async () => {
  try {
    console.log('🔍 getAllMindMapsHybrid 開始');
    
    // 認証マネージャーを動的にインポート
    const { authManager } = await import('./authManager.js');
    const { cloudStorage } = await import('./cloudStorage.js');
    
    const isAuthenticated = authManager.isAuthenticated();
    console.log('🔍 認証状態:', isAuthenticated);
    
    // 認証されている場合はクラウドから取得を試行
    if (isAuthenticated) {
      try {
        console.log('☁️ クラウドからマップ一覧取得開始');
        const cloudMaps = await cloudStorage.getAllMindMaps();
        console.log('☁️ クラウドから取得したrawデータ:', cloudMaps);
        
        // cloudMapsの構造を確認
        const actualMaps = cloudMaps?.mindmaps || cloudMaps;
        console.log('☁️ 実際のマップ配列:', actualMaps);
        
        // クラウドデータが有効な場合はそれを使用
        if (actualMaps && actualMaps.length > 0) {
          console.log('☁️ クラウドデータ有効、件数:', actualMaps.length);
          
          // マップ詳細を取得してローカルキャッシュ
          const detailedMaps = [];
          for (const map of actualMaps) {
            try {
              console.log('📄 マップ詳細取得:', map.id, map.title);
              const detailed = await cloudStorage.getMindMap(map.id);
              if (detailed && detailed.rootNode) {
                detailedMaps.push(detailed);
              }
            } catch (detailError) {
              console.warn('📄 マップ詳細取得失敗:', map.id, detailError);
            }
          }
          
          console.log('📄 詳細データ取得完了、件数:', detailedMaps.length);
          
          if (detailedMaps.length > 0) {
            // クラウドデータをローカルにもキャッシュ
            saveToStorage(STORAGE_KEYS.MINDMAPS, detailedMaps);
            console.log('💾 ローカルキャッシュ保存完了');
            return detailedMaps;
          }
        }
        
        // クラウドデータが空の場合はローカルデータを使用
        console.log('📱 クラウドデータが空、ローカルデータを使用');
        return getAllMindMaps();
      } catch (cloudError) {
        console.warn('❌ クラウド取得失敗、ローカルデータを使用:', cloudError);
        return getAllMindMaps();
      }
    } else {
      // 認証されていない場合はローカルデータのみを使用
      console.log('🔒 未認証、ローカルデータのみ使用');
      return getAllMindMaps();
    }
  } catch (error) {
    console.error('💥 Hybrid fetch error:', error);
    return getAllMindMaps();
  }
};

// ハイブリッド削除
export const deleteMindMapHybrid = async (mapId) => {
  try {
    // 認証マネージャーを動的にインポート
    const { authManager } = await import('./authManager.js');
    const { cloudStorage } = await import('./cloudStorage.js');
    
    // 認証されている場合はクラウドからも削除を試行
    if (authManager.isAuthenticated()) {
      try {
        await cloudStorage.deleteMindMap(mapId);
      } catch (cloudError) {
        console.warn('Cloud delete failed:', cloudError);
        // クラウド削除失敗でもローカル削除は続行
      }
    }
    
    // ローカルから削除
    return deleteMindMap(mapId);
  } catch (error) {
    console.error('Hybrid delete error:', error);
    // エラー時でもローカル削除は実行
    return deleteMindMap(mapId);
  }
};

// クラウド接続テスト
export const testCloudConnection = async () => {
  try {
    // 認証マネージャーを動的にインポート
    const { authManager } = await import('./authManager.js');
    const { cloudStorage } = await import('./cloudStorage.js');
    
    // 認証されていない場合は接続テスト不可
    if (!authManager.isAuthenticated()) {
      return false;
    }
    
    // クラウドストレージ接続テスト
    return await cloudStorage.testConnection();
  } catch (error) {
    console.error('Cloud connection test failed:', error);
    return false;
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
    // 破損データを特定
    const corruptedMaps = maps.filter(map => !map || !map.id || !map.rootNode);
    const validMaps = maps.filter(map => map && map.id && map.rootNode);
    
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
    maps.forEach((map, index) => {
      // Debug info available in returned data
    });
    
    return maps;
  } catch (error) {
    console.error('Debug failed:', error);
    return null;
  }
};
