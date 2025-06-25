// ローカルストレージ専用エンジン
// 完全にローカル環境に特化、ネットワーク機能なし

import { STORAGE_KEYS, createInitialData, generateId } from '../../../shared/types/dataTypes.js';
// LocalStorage utilities inline
import type { MindMapData, Node, StorageResult, SyncStatus } from '../types.js';

export class LocalEngine {
  readonly mode = 'local' as const;
  readonly name = 'ローカルストレージエンジン';

  constructor() {
    console.log('🏠 ローカルエンジン: 初期化完了');
  }

  // ローカルストレージ操作
  private loadFromStorage<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('LocalEngine: データ読み込みエラー:', error);
      return defaultValue;
    }
  }

  private async saveToStorage<T>(key: string, data: T): Promise<boolean> {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      console.log('🏠 ローカル保存成功:', key);
      return true;
    } catch (error) {
      console.error('🏠 ローカル保存失敗:', error);
      this.notifyStorageError(key, error.message);
      return false;
    }
  }

  private notifyStorageError(key: string, error: string): void {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('storage-error', {
        detail: {
          key,
          error,
          suggestion: 'ファイル添付や古いマップを削除して容量を確保してください'
        }
      }));
    }
  }

  private notifyStorageWarning(warning: string): void {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('storage-warning', {
        detail: {
          message: warning,
          suggestion: 'ストレージ容量が不足してきています。不要なファイルを削除することをお勧めします。'
        }
      }));
    }
  }

  // マップ管理
  async getAllMaps(): Promise<MindMapData[]> {
    const maps = this.loadFromStorage(STORAGE_KEYS.MINDMAPS, []);
    
    // データ整合性チェック
    const validMaps = maps.filter(map => {
      if (!map || !map.id || typeof map.id !== 'string') {
        console.error('🚨 破損データ検出 (ID問題):', {
          hasMap: !!map,
          id: map?.id,
          idType: typeof map?.id,
          fullData: map
        });
        return false;
      }
      if (!map.rootNode) {
        console.warn('🏠 無効なマップを除外 (rootNodeなし):', map);
        return false;
      }
      return true;
    });
    
    // 破損データをクリーンアップ
    if (validMaps.length !== maps.length) {
      await this.saveToStorage(STORAGE_KEYS.MINDMAPS, validMaps);
      console.log('🏠 破損データをクリーンアップしました', {
        before: maps.length,
        after: validMaps.length,
        removed: maps.length - validMaps.length
      });
    }
    
    console.log('🏠 ローカル: マップ一覧取得', validMaps.length, '件');
    return validMaps;
  }

  async getMap(mapId: string): Promise<MindMapData> {
    const maps = await this.getAllMaps();
    const map = maps.find(m => m.id === mapId);
    
    if (!map) {
      throw new Error(`ローカルマップが見つかりません: ${mapId}`);
    }
    
    console.log('🏠 ローカル: マップ取得完了', map.title);
    return map;
  }

  async createMap(mapData: MindMapData): Promise<StorageResult<MindMapData>> {
    const timestamp = new Date().toISOString();
    const newMap: MindMapData = {
      ...mapData,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const allMaps = await this.getAllMaps();
    allMaps.push(newMap);
    
    const saveSuccess = await this.saveToStorage(STORAGE_KEYS.MINDMAPS, allMaps);
    if (!saveSuccess) {
      return { success: false, error: 'ローカル保存に失敗しました' };
    }

    // 現在のマップとしても保存
    await this.saveToStorage(STORAGE_KEYS.CURRENT_MAP, newMap);
    
    console.log('🏠 ローカル: マップ作成完了', newMap.title);
    return { success: true, data: newMap };
  }

  async updateMap(mapId: string, mapData: MindMapData): Promise<StorageResult<MindMapData>> {
    // 保存前のデータ検証
    if (!mapId || typeof mapId !== 'string') {
      console.error('🚨 無効なmapId:', { mapId, type: typeof mapId });
      return { success: false, error: '無効なマップIDです' };
    }
    
    if (!mapData || typeof mapData !== 'object') {
      console.error('🚨 無効なmapData:', { mapData, type: typeof mapData });
      return { success: false, error: '無効なマップデータです' };
    }

    const allMaps = await this.getAllMaps();
    const existingIndex = allMaps.findIndex(map => map.id === mapId);
    
    const updatedMap: MindMapData = {
      ...mapData,
      id: mapId, // 明示的に文字列のIDを設定
      updatedAt: new Date().toISOString()
    };
    
    // 最終検証
    if (!updatedMap.id || typeof updatedMap.id !== 'string') {
      console.error('🚨 updatedMapのID検証失敗:', {
        originalMapId: mapId,
        mapDataId: mapData.id,
        updatedMapId: updatedMap.id,
        idType: typeof updatedMap.id
      });
      return { success: false, error: 'マップIDの生成に失敗しました' };
    }
    
    if (existingIndex >= 0) {
      // 作成日時を保持
      updatedMap.createdAt = allMaps[existingIndex].createdAt || updatedMap.updatedAt;
      allMaps[existingIndex] = updatedMap;
    } else {
      // 新しいマップとして追加
      updatedMap.createdAt = updatedMap.updatedAt;
      allMaps.push(updatedMap);
    }
    
    const saveSuccess = await this.saveToStorage(STORAGE_KEYS.MINDMAPS, allMaps);
    if (!saveSuccess) {
      return { success: false, error: 'ローカル保存に失敗しました' };
    }

    // 現在のマップとしても保存
    await this.saveToStorage(STORAGE_KEYS.CURRENT_MAP, updatedMap);
    
    console.log('🏠 ローカル: マップ更新完了', updatedMap.title);
    return { success: true, data: updatedMap };
  }

  async deleteMap(mapId: string): Promise<StorageResult<MindMapData | null>> {
    const allMaps = await this.getAllMaps();
    const filteredMaps = allMaps.filter(map => map.id !== mapId);
    
    const saveSuccess = await this.saveToStorage(STORAGE_KEYS.MINDMAPS, filteredMaps);
    if (!saveSuccess) {
      return { success: false, error: 'ローカル削除に失敗しました' };
    }
    
    // 現在のマップが削除対象の場合
    const currentMap = this.loadFromStorage(STORAGE_KEYS.CURRENT_MAP, null);
    let newCurrentMap = null;
    
    if (currentMap && currentMap.id === mapId) {
      // 他にマップがあれば最初のものを、なければ新規作成
      newCurrentMap = filteredMaps.length > 0 ? filteredMaps[0] : createInitialData();
      await this.saveToStorage(STORAGE_KEYS.CURRENT_MAP, newCurrentMap);
      console.log('🏠 ローカル: 削除後の新現在マップ', newCurrentMap.title);
    }
    
    console.log('🏠 ローカル: マップ削除完了', mapId);
    return { success: true, data: newCurrentMap };
  }

  // 現在のマップ管理
  async getCurrentMap(): Promise<MindMapData> {
    let currentMap = this.loadFromStorage(STORAGE_KEYS.CURRENT_MAP, null);
    
    if (!currentMap) {
      // 初回起動: 新しいマップを作成
      currentMap = createInitialData();
      await this.saveToStorage(STORAGE_KEYS.CURRENT_MAP, currentMap);
      
      // 全体のマップリストにも追加
      const allMaps = await this.getAllMaps();
      if (!allMaps.find(map => map.id === currentMap.id)) {
        allMaps.push(currentMap);
        await this.saveToStorage(STORAGE_KEYS.MINDMAPS, allMaps);
      }
    }
    
    console.log('🏠 ローカル: 現在マップ取得', currentMap.title);
    return currentMap;
  }

  async setCurrentMap(mapData: MindMapData): Promise<StorageResult<MindMapData>> {
    const saveSuccess = await this.saveToStorage(STORAGE_KEYS.CURRENT_MAP, mapData);
    if (!saveSuccess) {
      return { success: false, error: 'ローカル保存に失敗しました' };
    }
    
    console.log('🏠 ローカル: 現在マップ設定完了', mapData.title);
    return { success: true, data: mapData };
  }

  // ノード操作（ローカルでは即時保存不要、メモリ内で完結）
  async addNode(mapId: string, nodeData: Node, parentId: string): Promise<StorageResult<Node>> {
    console.log('🏠 ローカル: ノード追加（メモリ内のみ）', nodeData.id);
    return { success: true, data: nodeData, local: true };
  }

  async updateNode(mapId: string, nodeId: string, updates: Partial<Node>): Promise<StorageResult<Node>> {
    console.log('🏠 ローカル: ノード更新（メモリ内のみ）', nodeId);
    return { success: true, data: { id: nodeId, ...updates } as Node, local: true };
  }

  async deleteNode(mapId: string, nodeId: string): Promise<StorageResult<boolean>> {
    console.log('🏠 ローカル: ノード削除（メモリ内のみ）', nodeId);
    return { success: true, data: true, local: true };
  }

  async moveNode(mapId: string, nodeId: string, newParentId: string): Promise<StorageResult<boolean>> {
    console.log('🏠 ローカル: ノード移動（メモリ内のみ）', nodeId);
    return { success: true, data: true, local: true };
  }

  // エクスポート・インポート
  async exportMapAsJSON(mapData: MindMapData): Promise<void> {
    const dataStr = JSON.stringify(mapData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `${mapData.title || 'mindmap'}.json`;
    link.click();
    
    URL.revokeObjectURL(link.href);
    console.log('🏠 ローカル: JSONエクスポート完了', mapData.title);
  }

  async importMapFromJSON(file: File): Promise<StorageResult<MindMapData>> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const mapData = JSON.parse(e.target?.result as string);
          
          if (!mapData.rootNode || !mapData.id) {
            resolve({ success: false, error: '無効なマインドマップフォーマットです' });
            return;
          }
          
          // 重複を防ぐため新しいIDを生成
          const importedMap = {
            ...mapData,
            id: generateId(),
            title: `${mapData.title} (インポート)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          const result = await this.createMap(importedMap);
          resolve(result);
        } catch (error) {
          resolve({ 
            success: false, 
            error: `マインドマップファイルの解析に失敗しました: ${error.message}` 
          });
        }
      };
      
      reader.onerror = () => resolve({ 
        success: false, 
        error: 'ファイルの読み込みに失敗しました' 
      });
      
      reader.readAsText(file);
    });
  }

  // 接続・同期（ローカルでは常に有効）
  async testConnection(): Promise<boolean> {
    return true; // ローカルストレージは常に利用可能
  }

  getSyncStatus(): SyncStatus {
    return {
      isOnline: true, // ローカルは常にオンライン扱い
      pendingCount: 0,
      lastSync: null,
      mode: 'local'
    };
  }

  // ユーティリティ
  async hasLocalData(): Promise<boolean> {
    try {
      const maps = this.loadFromStorage(STORAGE_KEYS.MINDMAPS, []);
      const currentMap = this.loadFromStorage(STORAGE_KEYS.CURRENT_MAP, null);
      const settings = this.loadFromStorage(STORAGE_KEYS.SETTINGS, null);
      
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
      console.warn('🏠 ローカルデータチェックエラー:', error);
      return false;
    }
  }

  async cleanupCorruptedData() {
    try {
      const maps = this.loadFromStorage(STORAGE_KEYS.MINDMAPS, []);
      const corruptedMaps = maps.filter(map => !map || !map.id || !map.rootNode);
      const validMaps = maps.filter(map => map && map.id && map.rootNode);
      
      await this.saveToStorage(STORAGE_KEYS.MINDMAPS, validMaps);
      
      console.log('🏠 ローカル: データクリーンアップ完了', {
        before: maps.length,
        after: validMaps.length,
        removed: corruptedMaps.length
      });
      
      return {
        before: maps.length,
        after: validMaps.length,
        removed: corruptedMaps.length,
        corruptedMaps
      };
    } catch (error) {
      console.error('🏠 ローカルクリーンアップ失敗:', error);
      throw error;
    }
  }

  async clearAllData(): Promise<boolean> {
    try {
      console.log('🗑️ ローカル: 全データ削除開始...');
      
      // MindFlow関連データを削除
      localStorage.removeItem(STORAGE_KEYS.MINDMAPS);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_MAP);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      
      // その他のMindFlow関連データを削除
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('mindflow_') || key.includes('mindmap')) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('✅ ローカル: 全データ削除完了');
      return true;
    } catch (error) {
      console.error('❌ ローカル: データ削除失敗:', error);
      throw error;
    }
  }
}

// シングルトンインスタンス
export const localEngine = new LocalEngine();