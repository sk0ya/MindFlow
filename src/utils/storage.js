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

// すべてのマインドマップを取得
export const getAllMindMaps = () => {
  // クラウドモードの場合はローカルデータを返さない
  if (isCloudStorageEnabled()) {
    console.log('☁️ クラウドモード: ローカルデータアクセスをスキップ');
    return [];
  }
  
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
export const saveMindMap = async (mindMapData) => {
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
  
  await saveToStorage(STORAGE_KEYS.MINDMAPS, allMaps);
  await saveToStorage(STORAGE_KEYS.CURRENT_MAP, updatedData);
  
  return updatedData;
};

// 現在のマインドマップを取得
export const getCurrentMindMap = () => {
  // クラウドモードの場合はローカルデータを返さない
  if (isCloudStorageEnabled()) {
    console.log('☁️ クラウドモード: ローカル getCurrentMindMap をスキップ');
    return null;
  }
  
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

// ローカルデータ存在チェック
export const hasLocalData = () => {
  try {
    const maps = loadFromStorage(STORAGE_KEYS.MINDMAPS, []);
    const currentMap = loadFromStorage(STORAGE_KEYS.CURRENT_MAP);
    const settings = loadFromStorage(STORAGE_KEYS.SETTINGS);
    
    // マインドマップデータまたは設定データが存在するかチェック
    const hasMaps = maps && maps.length > 0;
    const hasCurrentMap = currentMap && currentMap.id;
    const hasSettings = settings && settings.storageMode;
    
    console.log('🔍 ローカルデータチェック:', {
      hasMaps,
      hasCurrentMap, 
      hasSettings,
      mapsCount: maps?.length || 0
    });
    
    return hasMaps || hasCurrentMap || hasSettings;
  } catch (error) {
    console.warn('ローカルデータチェックエラー:', error);
    return false;
  }
};

// 初回セットアップ完了チェック
export const isFirstTimeSetup = () => {
  const settings = loadFromStorage(STORAGE_KEYS.SETTINGS);
  return !settings || !settings.storageMode;
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

// クラウドストレージ機能
export const isCloudStorageEnabled = () => {
  const settings = getAppSettings();
  return settings.storageMode === 'cloud';
};

// ローカルストレージ機能
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
    // クラウドモードの場合、ローカル関連設定を無効化
    autoSave: mode === 'cloud' ? false : settings.autoSave,
    cloudSync: mode === 'cloud'
  };
  
  console.log('📝 ストレージモード設定:', mode, updatedSettings);
  await saveAppSettings(updatedSettings);
  
  // クラウドモードの場合、ローカルデータを無効化（削除はしない）
  if (mode === 'cloud') {
    console.log('☁️ クラウドモード: ローカルデータアクセスを無効化');
  }
  
  return updatedSettings;
};

// クラウドからマインドマップリストを読み込み
export const loadMindMapsFromCloud = async () => {
  try {
    const { authManager } = await import('./authManager.js');
    const { cloudStorage } = await import('./cloudStorage.js');
    
    if (!authManager.isAuthenticated()) {
      console.log('未認証のためクラウド読み込みスキップ');
      return null;
    }
    
    console.log('☁️ クラウドからマインドマップ一覧を読み込み中...');
    const result = await cloudStorage.getAllMindMaps();
    
    if (result && result.mindmaps) {
      console.log('✅ クラウドマインドマップ読み込み成功:', result.mindmaps.length + '件');
      return result.mindmaps;
    }
    
    return null;
  } catch (error) {
    console.warn('❌ クラウド読み込み失敗:', error);
    return null;
  }
};

// 特定のマインドマップをクラウドから読み込み
export const loadMindMapFromCloud = async (mapId) => {
  try {
    const { authManager } = await import('./authManager.js');
    const { cloudStorage } = await import('./cloudStorage.js');
    
    if (!authManager.isAuthenticated()) {
      console.log('未認証のためクラウド読み込みスキップ');
      return null;
    }
    
    console.log('☁️ クラウドからマインドマップを読み込み中:', mapId);
    const result = await cloudStorage.getMindMap(mapId);
    
    if (result) {
      console.log('✅ クラウドマインドマップ読み込み成功:', result.title);
      return result;
    }
    
    return null;
  } catch (error) {
    console.warn('❌ クラウドマインドマップ読み込み失敗:', error);
    return null;
  }
};

// クラウド専用保存（ハイブリッド廃止）
export const saveMindMapCloud = async (mindMapData) => {
  try {
    // 認証マネージャーを動的にインポート
    const { authManager } = await import('./authManager.js');
    const { cloudStorage } = await import('./cloudStorage.js');
    
    const isAuthenticated = authManager.isAuthenticated();
    
    console.log('☁️ saveMindMapCloud 実行:', {
      mapId: mindMapData.id,
      mapTitle: mindMapData.title,
      isAuthenticated
    });
    
    if (!isAuthenticated) {
      throw new Error('認証が必要です');
    }
    
    // クラウドIDを一意に決定（IDは変更しない）
    const cloudMapId = mindMapData.id;
    
    // 既存マップの確認（タイトルではなくIDで確認）
    try {
      const existingMap = await cloudStorage.getMindMap(cloudMapId);
      if (existingMap) {
        console.log('🔍 既存マップを更新:', cloudMapId);
      }
    } catch (notFoundError) {
      // 新規作成の場合はクラウドで新しいIDを生成
      console.log('🆕 新規マップとして作成');
    }
    
    // データはそのまま送信（ID変更なし）
    const result = await cloudStorage.updateMindMap(cloudMapId, mindMapData);
    console.log('✅ クラウド保存成功:', result);
    
    return { ...result, source: 'cloud' };
  } catch (error) {
    console.error('❌ クラウド保存失敗:', error);
    throw error;
  }
};

// ハイブリッド保存（後方互換性のため残すが、クラウドモードでは使用しない）
export const saveMindMapHybrid = async (mindMapData) => {
  // クラウドモードの場合は純粋にクラウド保存
  if (isCloudStorageEnabled()) {
    return await saveMindMapCloud(mindMapData);
  }
  
  // ローカルモードの場合は従来通り
  return await saveMindMap(mindMapData);
};


// クラウド専用取得
export const getAllMindMapsCloud = async () => {
  try {
    console.log('☁️ getAllMindMapsCloud 開始');
    
    // 認証マネージャーを動的にインポート
    const { authManager } = await import('./authManager.js');
    const { cloudStorage } = await import('./cloudStorage.js');
    
    const isAuthenticated = authManager.isAuthenticated();
    console.log('🔍 認証状態:', isAuthenticated);
    
    if (!isAuthenticated) {
      throw new Error('認証が必要です');
    }
    
    console.log('☁️ クラウドからマップ一覧取得開始');
    const cloudMaps = await cloudStorage.getAllMindMaps();
    console.log('☁️ クラウドから取得したrawデータ:', cloudMaps);
    
    // cloudMapsの構造を確認
    const actualMaps = cloudMaps?.mindmaps || cloudMaps;
    console.log('☁️ 実際のマップ配列:', actualMaps);
    
    // クラウドデータが有効な場合はそれを使用（ローカルキャッシュなし）
    if (actualMaps && actualMaps.length > 0) {
      console.log('☁️ クラウドデータ有効、件数:', actualMaps.length);
      
      // 一時的に詳細取得をスキップして基本情報だけ返す
      const basicMaps = actualMaps.map(map => ({
        id: map.id,
        title: map.title || '無題のマップ',
        category: map.category || '未分類',
        updatedAt: map.updatedAt || new Date().toISOString(),
        createdAt: map.createdAt || map.updatedAt || new Date().toISOString(),
        rootNode: map.rootNode || {
          id: 'root',
          text: map.title || '無題のマップ',
          x: 0,
          y: 0,
          children: []
        }
      }));
      
      console.log('📄 基本データ生成完了、件数:', basicMaps.length);
      return basicMaps;
    }
    
    // クラウドデータが空の場合は空配列を返す
    console.log('📱 クラウドデータが空');
    return [];
  } catch (error) {
    console.error('❌ クラウド取得失敗:', error);
    throw error;
  }
};

// ハイブリッド取得（後方互換性のため残すが、クラウドモードでは使用しない）
export const getAllMindMapsHybrid = async () => {
  // クラウドモードの場合は純粋にクラウド取得
  if (isCloudStorageEnabled()) {
    return await getAllMindMapsCloud();
  }
  
  // ローカルモードの場合は従来通り
  return getAllMindMaps();
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

// デバッグ用：ローカルデータを完全削除
export const clearAllLocalData = () => {
  try {
    console.log('🗑️ ローカルデータを完全削除中...');
    
    // マインドマップデータを削除
    localStorage.removeItem(STORAGE_KEYS.MINDMAPS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_MAP);
    
    // 設定データを削除（ストレージモード設定も含む）
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    
    // その他のMindFlow関連データを削除
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('mindflow_') || key.includes('mindmap')) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('✅ ローカルデータ削除完了');
    console.log('🔄 ページをリロードしてください');
    
    return true;
  } catch (error) {
    console.error('❌ ローカルデータ削除失敗:', error);
    return false;
  }
};

// グローバルに公開（開発用）
if (typeof window !== 'undefined') {
  window.clearAllLocalData = clearAllLocalData;
  window.debugStorageData = debugStorageData;
}
