// 完全分離：ローカルストレージ専用処理
import { STORAGE_KEYS, createInitialData } from './dataTypes.js';
import { safeGetItem, safeSetItem } from './storageManager.js';

// ローカルストレージからデータを取得（安全版）
export const loadFromStorage = (key, defaultValue = null) => {
  return safeGetItem(key, defaultValue);
};

// ローカルストレージにデータを保存（安全版）
export const saveToStorage = async (key, data) => {
  try {
    const result = await safeSetItem(key, data);
    
    if (!result.success) {
      console.error('ローカル保存失敗:', result.error);
      
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
      console.warn('ローカル警告:', result.warning);
    
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
    console.error('ローカル保存中にエラーが発生:', error);
    return false;
  }
};

// すべてのマインドマップを取得（ローカル専用）
export const getAllMindMapsLocal = () => {
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
  
  console.log('🏠 ローカル: マップ一覧取得', validMaps.length, '件');
  return validMaps;
};

// マインドマップを保存（ローカル専用）
export const saveMindMapLocal = async (mindMapData) => {
  const allMaps = getAllMindMapsLocal();
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
  
  console.log('🏠 ローカル: マップ保存完了', updatedData.title);
  return updatedData;
};

// 現在のマインドマップを取得（ローカル専用）
export const getCurrentMindMapLocal = () => {
  let currentMap = loadFromStorage(STORAGE_KEYS.CURRENT_MAP);
  
  if (!currentMap) {
    // 初回起動時: 新しいマップを作成して全体のリストにも追加
    currentMap = createInitialData();
    saveToStorage(STORAGE_KEYS.CURRENT_MAP, currentMap);
    
    // 全体のマップリストにも追加
    const allMaps = getAllMindMapsLocal();
    if (!allMaps.find(map => map.id === currentMap.id)) {
      allMaps.push(currentMap);
      saveToStorage(STORAGE_KEYS.MINDMAPS, allMaps);
    }
  }
  
  console.log('🏠 ローカル: 現在マップ取得', currentMap.title);
  return currentMap;
};

// マインドマップを削除（ローカル専用）
export const deleteMindMapLocal = (mapId) => {
  const allMaps = getAllMindMapsLocal();
  const filteredMaps = allMaps.filter(map => map.id !== mapId);
  saveToStorage(STORAGE_KEYS.MINDMAPS, filteredMaps);
  
  const currentMap = loadFromStorage(STORAGE_KEYS.CURRENT_MAP);
  if (currentMap && currentMap.id === mapId) {
    const newCurrentMap = filteredMaps.length > 0 ? filteredMaps[0] : createInitialData();
    saveToStorage(STORAGE_KEYS.CURRENT_MAP, newCurrentMap);
    console.log('🏠 ローカル: 削除後の新現在マップ', newCurrentMap.title);
    return newCurrentMap;
  }
  
  console.log('🏠 ローカル: マップ削除完了', mapId);
  return currentMap;
};

// 新しいマインドマップを作成（ローカル専用）
export const createNewMindMapLocal = (title = '新しいマインドマップ') => {
  const newMap = createInitialData();
  newMap.title = title;
  return saveMindMapLocal(newMap);
};

// データをJSONでエクスポート（ローカル専用）
export const exportMindMapAsJSONLocal = (mindMapData) => {
  const dataStr = JSON.stringify(mindMapData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = `${mindMapData.title || 'mindmap'}.json`;
  link.click();
  
  URL.revokeObjectURL(link.href);
};

// JSONファイルからインポート（ローカル専用）
export const importMindMapFromJSONLocal = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const mindMapData = JSON.parse(e.target.result);
        
        // 基本的なデータ検証
        if (!mindMapData.rootNode || !mindMapData.id) {
          throw new Error('Invalid mind map format');
        }
        
        const importedMap = saveMindMapLocal(mindMapData);
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

// デバッグ用：破損データをクリーンアップ（ローカル専用）
export const cleanupCorruptedDataLocal = () => {
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
    console.error('ローカルクリーンアップ失敗:', error);
    return null;
  }
};

// デバッグ用：全データを表示（ローカル専用）
export const debugLocalStorageData = () => {
  try {
    const maps = loadFromStorage(STORAGE_KEYS.MINDMAPS, []);
    console.log('🏠 ローカルデータ詳細:', maps);
    return maps;
  } catch (error) {
    console.error('ローカルデバッグ失敗:', error);
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
  window.debugLocalStorageData = debugLocalStorageData;
}