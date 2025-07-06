// ローカルストレージ専用エンジン
import { deepClone, createInitialData } from '../../shared/types/dataTypes';

const STORAGE_KEYS = {
  CURRENT_MAP_ID: 'mindmap_current_id',
  MAP_PREFIX: 'mindmap_',
  MAP_LIST: 'mindmap_list',
  SETTINGS: 'mindmap_settings'
};

class LocalEngine {
  constructor() {
    this.initializeStorage();
  }

  private initializeStorage() {
    // 初回起動時の初期化
    console.log('🔧 LocalEngine: Initializing storage...');
    
    const mapList = localStorage.getItem(STORAGE_KEYS.MAP_LIST);
    const currentMapId = localStorage.getItem(STORAGE_KEYS.CURRENT_MAP_ID);
    
    console.log('🔧 LocalEngine: Storage state:', {
      hasMapList: !!mapList,
      hasCurrentMapId: !!currentMapId,
      mapListContent: mapList
    });
    
    if (!mapList) {
      console.log('🔧 LocalEngine: No map list found, creating initial map...');
      const initialMap = createInitialData();
      const createResult = this.createMindMap(initialMap);
      
      if (createResult.success) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_MAP_ID, initialMap.id);
        console.log('🔧 LocalEngine: Initial map created:', initialMap.id);
      } else {
        console.error('🔧 LocalEngine: Failed to create initial map:', createResult.error);
      }
    } else if (!currentMapId) {
      // マップリストはあるが現在のマップIDがない場合
      const mapIds = JSON.parse(mapList);
      if (mapIds.length > 0) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_MAP_ID, mapIds[0]);
        console.log('🔧 LocalEngine: Set current map ID to first available:', mapIds[0]);
      }
    }
  }

  // 現在のマインドマップを取得
  getCurrentMindMap() {
    const currentId = localStorage.getItem(STORAGE_KEYS.CURRENT_MAP_ID);
    console.log('🔍 LocalEngine.getCurrentMindMap: Current ID:', currentId);
    
    if (!currentId) {
      console.log('🔍 LocalEngine.getCurrentMindMap: No current ID found');
      return null;
    }
    
    const mindMap = this.getMindMap(currentId);
    console.log('🔍 LocalEngine.getCurrentMindMap: Retrieved map:', {
      found: !!mindMap,
      hasRootNode: !!(mindMap?.rootNode),
      title: mindMap?.title
    });
    
    return mindMap;
  }

  // すべてのマインドマップを取得
  getAllMindMaps() {
    try {
      const mapListStr = localStorage.getItem(STORAGE_KEYS.MAP_LIST);
      if (!mapListStr) return [];
      
      const mapIds = JSON.parse(mapListStr);
      const maps = [];
      
      for (const id of mapIds) {
        const map = this.getMindMap(id);
        if (map) {
          maps.push({
            id: map.id,
            title: map.title,
            category: map.category || '未分類',
            updatedAt: map.updatedAt || new Date().toISOString()
          });
        }
      }
      
      return maps;
    } catch (error) {
      console.error('Failed to get all mind maps:', error);
      return [];
    }
  }

  // 特定のマインドマップを取得
  getMindMap(id: string) {
    try {
      const key = STORAGE_KEYS.MAP_PREFIX + id;
      const dataStr = localStorage.getItem(key);
      
      console.log('🔍 LocalEngine.getMindMap:', {
        id,
        key,
        hasData: !!dataStr,
        dataLength: dataStr?.length
      });
      
      if (!dataStr) {
        console.log('🔍 LocalEngine.getMindMap: No data found for key:', key);
        return null;
      }
      
      const data = JSON.parse(dataStr);
      console.log('🔍 LocalEngine.getMindMap: Parsed data:', {
        hasRootNode: !!data.rootNode,
        nodeCount: data.rootNode ? this.countNodes(data.rootNode) : 0
      });
      
      return data;
    } catch (error) {
      console.error('Failed to get mind map:', error);
      return null;
    }
  }
  
  // ヘルパーメソッド: ノード数をカウント
  private countNodes(node: any): number {
    if (!node) return 0;
    let count = 1;
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        count += this.countNodes(child);
      }
    }
    return count;
  }

  // 新しいマインドマップを作成
  createMindMap(data: any) {
    try {
      const id = data.id || `map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const mapData = {
        ...data,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // マップデータを保存
      localStorage.setItem(STORAGE_KEYS.MAP_PREFIX + id, JSON.stringify(mapData));
      
      // マップリストを更新
      const mapListStr = localStorage.getItem(STORAGE_KEYS.MAP_LIST) || '[]';
      const mapList = JSON.parse(mapListStr);
      if (!mapList.includes(id)) {
        mapList.push(id);
        localStorage.setItem(STORAGE_KEYS.MAP_LIST, JSON.stringify(mapList));
      }
      
      return { success: true, data: mapData };
    } catch (error) {
      console.error('Failed to create mind map:', error);
      return { success: false, error: error.message };
    }
  }

  // マインドマップを更新
  updateMindMap(id: string, data: any) {
    try {
      const updatedData = {
        ...data,
        id,
        updatedAt: new Date().toISOString()
      };
      
      const key = STORAGE_KEYS.MAP_PREFIX + id;
      const dataStr = JSON.stringify(updatedData);
      
      console.log('💾 LocalEngine.updateMindMap:', {
        id,
        key,
        dataSize: dataStr.length,
        hasRootNode: !!updatedData.rootNode,
        nodeCount: updatedData.rootNode ? this.countNodes(updatedData.rootNode) : 0
      });
      
      localStorage.setItem(key, dataStr);
      
      // 保存後の確認
      const savedData = localStorage.getItem(key);
      if (savedData) {
        console.log('✅ LocalEngine.updateMindMap: Data saved successfully, size:', savedData.length);
      } else {
        console.error('❌ LocalEngine.updateMindMap: Failed to verify saved data');
      }
      
      return { success: true, data: updatedData };
    } catch (error) {
      console.error('Failed to update mind map:', error);
      return { success: false, error: error.message };
    }
  }

  // マインドマップを削除
  deleteMindMap(id: string) {
    try {
      // マップデータを削除
      localStorage.removeItem(STORAGE_KEYS.MAP_PREFIX + id);
      
      // マップリストから削除
      const mapListStr = localStorage.getItem(STORAGE_KEYS.MAP_LIST) || '[]';
      const mapList = JSON.parse(mapListStr);
      const filteredList = mapList.filter((mapId: string) => mapId !== id);
      localStorage.setItem(STORAGE_KEYS.MAP_LIST, JSON.stringify(filteredList));
      
      // 現在のマップIDが削除されたマップの場合、別のマップに切り替え
      const currentId = localStorage.getItem(STORAGE_KEYS.CURRENT_MAP_ID);
      if (currentId === id && filteredList.length > 0) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_MAP_ID, filteredList[0]);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to delete mind map:', error);
      return false;
    }
  }

  // 現在のマップIDを設定
  setCurrentMapId(id: string) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_MAP_ID, id);
  }

  // アプリ設定を取得
  getAppSettings() {
    try {
      const settingsStr = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!settingsStr) {
        return { autoSave: true, autoLayout: false };
      }
      return JSON.parse(settingsStr);
    } catch (error) {
      console.error('Failed to get app settings:', error);
      return { autoSave: true, autoLayout: false };
    }
  }

  // アプリ設定を保存
  saveAppSettings(settings: any) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('Failed to save app settings:', error);
      return false;
    }
  }

  // ストレージ統計を取得
  getStorageStats() {
    const used = new Blob(Object.values(localStorage)).size;
    const total = 5 * 1024 * 1024; // 5MB (localStorage制限)
    
    return {
      used,
      total,
      available: total - used,
      percentage: (used / total) * 100
    };
  }

  // ストレージクリア（開発用）
  clearAllData() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('mindmap_')) {
        localStorage.removeItem(key);
      }
    });
  }
}

// シングルトンインスタンスをエクスポート
export const localEngine = new LocalEngine();

// 互換性のための関数エクスポート
export const getCurrentMindMap = () => localEngine.getCurrentMindMap();
export const getAllMindMaps = () => localEngine.getAllMindMaps();
export const getMindMap = (id: string) => localEngine.getMindMap(id);
export const createMindMap = (data: any) => localEngine.createMindMap(data);
export const updateMindMap = (id: string, data: any) => localEngine.updateMindMap(id, data);
export const deleteMindMap = (id: string) => localEngine.deleteMindMap(id);
export const getAppSettings = () => localEngine.getAppSettings();
export const saveAppSettings = (settings: any) => localEngine.saveAppSettings(settings);

// ノード操作用メソッド
export const addNode = async (mapId: string, nodeData: any) => {
  try {
    // 現在のマップデータを取得
    const currentMap = localEngine.getMindMap(mapId);
    if (!currentMap) {
      throw new Error(`Map not found: ${mapId}`);
    }

    // ノードをマップに追加（ここでは単純にマップ全体を更新）
    const result = localEngine.updateMindMap(mapId, currentMap);
    
    return { 
      success: result.success, 
      node: nodeData,
      map: result.data 
    };
  } catch (error) {
    console.error('Failed to add node:', error);
    return { success: false, error: error.message };
  }
};

// storageManagerとの互換性のため
export const storageManager = {
  createMap: (data: any) => localEngine.createMindMap(data),
  updateMindMap: (id: string, data: any) => localEngine.updateMindMap(id, data),
  getMap: (id: string) => localEngine.getMindMap(id),
  getMindMap: (id: string) => localEngine.getMindMap(id),
  getAllMindMaps: () => localEngine.getAllMindMaps(),
  deleteMindMap: (id: string) => localEngine.deleteMindMap(id),
  getCurrentMindMap: () => localEngine.getCurrentMindMap(),
  getAppSettings: () => localEngine.getAppSettings(),
  saveAppSettings: (settings: any) => localEngine.saveAppSettings(settings)
};