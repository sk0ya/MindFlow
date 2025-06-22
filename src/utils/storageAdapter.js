// ストレージモード別の処理を完全分離するアダプター
import { getAppSettings } from './storage.js';

// ローカルストレージ専用の処理
class LocalStorageAdapter {
  constructor() {
    this.name = 'ローカルストレージ';
  }

  async getAllMaps() {
    const { getAllMindMaps } = await import('./storage.js');
    const maps = getAllMindMaps();
    console.log('🏠 ローカル: マップ一覧取得', maps.length, '件');
    return maps;
  }

  async getMap(mapId) {
    const maps = await this.getAllMaps();
    const map = maps.find(m => m.id === mapId);
    if (!map) {
      throw new Error(`ローカルマップが見つかりません: ${mapId}`);
    }
    console.log('🏠 ローカル: マップ取得完了', map.title);
    return map;
  }

  async createMap(mapData) {
    const { saveMindMap } = await import('./storage.js');
    await saveMindMap(mapData);
    console.log('🏠 ローカル: マップ作成完了', mapData.title);
    return mapData;
  }

  async updateMap(mapId, mapData) {
    const { saveMindMap } = await import('./storage.js');
    await saveMindMap(mapData);
    console.log('🏠 ローカル: マップ更新完了', mapData.title);
    return mapData;
  }

  async deleteMap(mapId) {
    const { deleteMindMap } = await import('./storage.js');
    const result = deleteMindMap(mapId);
    console.log('🏠 ローカル: マップ削除完了', mapId);
    return result;
  }

  // ノード操作（ローカルモードでは即座反映不要）
  async addNode(mapId, nodeData, parentId) {
    console.log('🏠 ローカル: ノード追加（メモリ内のみ）', nodeData.id);
    return { success: true, local: true };
  }

  async updateNode(mapId, nodeId, updates) {
    console.log('🏠 ローカル: ノード更新（メモリ内のみ）', nodeId);
    return { success: true, local: true };
  }

  async deleteNode(mapId, nodeId) {
    console.log('🏠 ローカル: ノード削除（メモリ内のみ）', nodeId);
    return { success: true, local: true };
  }

  async moveNode(mapId, nodeId, newParentId) {
    console.log('🏠 ローカル: ノード移動（メモリ内のみ）', nodeId);
    return { success: true, local: true };
  }
}

// クラウドストレージ専用の処理
class CloudStorageAdapter {
  constructor() {
    this.name = 'クラウドストレージ';
    this.baseUrl = '';
    this.pendingOperations = new Map();
    this.initialize();
  }

  async initialize() {
    const { authManager } = await import('./authManager.js');
    
    if (!authManager.isAuthenticated()) {
      console.log('☁️ クラウド: 未認証のため初期化スキップ');
      return;
    }

    this.baseUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:8787/api' 
      : 'https://mindflow-api-production.shigekazukoya.workers.dev/api';
    
    console.log('☁️ クラウド: 初期化完了', this.baseUrl);
  }

  async getAuthHeaders() {
    const { authManager } = await import('./authManager.js');
    
    if (!authManager.isAuthenticated()) {
      throw new Error('認証が必要です');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authManager.getAuthToken()}`,
      'X-User-ID': authManager.getCurrentUser()?.email || 'unknown'
    };
  }

  async getAllMaps() {
    try {
      console.log('☁️ クラウド: マップ一覧取得開始');
      
      const response = await fetch(`${this.baseUrl}/mindmaps`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`API エラー: ${response.status}`);
      }

      const result = await response.json();
      const maps = result.mindmaps || [];
      console.log('☁️ クラウド: マップ一覧取得完了', maps.length, '件');
      return maps;

    } catch (error) {
      console.error('☁️ クラウド: マップ一覧取得失敗:', error);
      throw error;
    }
  }

  async getMap(mapId) {
    try {
      console.log('☁️ クラウド: マップ取得開始', mapId);
      
      const response = await fetch(`${this.baseUrl}/mindmaps/${mapId}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`API エラー: ${response.status}`);
      }

      const map = await response.json();
      console.log('☁️ クラウド: マップ取得完了', map.title);
      return map;

    } catch (error) {
      console.error('☁️ クラウド: マップ取得失敗:', error);
      throw error;
    }
  }

  async createMap(mapData) {
    try {
      console.log('☁️ クラウド: マップ作成開始', mapData.title);
      
      const response = await fetch(`${this.baseUrl}/mindmaps`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(mapData)
      });

      if (!response.ok) {
        throw new Error(`API エラー: ${response.status}`);
      }

      const result = await response.json();
      console.log('☁️ クラウド: マップ作成完了', result.title);
      return result;

    } catch (error) {
      console.error('☁️ クラウド: マップ作成失敗:', error);
      throw error;
    }
  }

  async updateMap(mapId, mapData) {
    try {
      console.log('☁️ クラウド: マップ更新開始', mapId);
      
      const response = await fetch(`${this.baseUrl}/mindmaps/${mapId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(mapData)
      });

      if (!response.ok) {
        throw new Error(`API エラー: ${response.status}`);
      }

      const result = await response.json();
      console.log('☁️ クラウド: マップ更新完了', result.title);
      return result;

    } catch (error) {
      console.error('☁️ クラウド: マップ更新失敗:', error);
      throw error;
    }
  }

  async deleteMap(mapId) {
    try {
      console.log('☁️ クラウド: マップ削除開始', mapId);
      
      const response = await fetch(`${this.baseUrl}/mindmaps/${mapId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`API エラー: ${response.status}`);
      }

      const result = await response.json();
      console.log('☁️ クラウド: マップ削除完了');
      return result;

    } catch (error) {
      console.error('☁️ クラウド: マップ削除失敗:', error);
      throw error;
    }
  }

  // ノード操作（クラウドモードでは即座反映）
  async addNode(mapId, nodeData, parentId) {
    try {
      console.log('☁️ クラウド: ノード追加開始', nodeData.id);
      
      const response = await fetch(`${this.baseUrl}/nodes`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          mapId,
          node: nodeData,
          parentId,
          operation: 'add'
        })
      });

      if (!response.ok) {
        throw new Error(`API エラー: ${response.status}`);
      }

      const result = await response.json();
      console.log('☁️ クラウド: ノード追加完了');
      return { success: true, result };

    } catch (error) {
      console.error('☁️ クラウド: ノード追加失敗:', error);
      // 失敗した操作をキューに追加
      this.pendingOperations.set(`add_${nodeData.id}`, {
        type: 'add',
        mapId,
        nodeData,
        parentId,
        timestamp: Date.now()
      });
      return { success: false, error: error.message };
    }
  }

  async updateNode(mapId, nodeId, updates) {
    try {
      console.log('☁️ クラウド: ノード更新開始', nodeId);
      
      const response = await fetch(`${this.baseUrl}/nodes/${nodeId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          mapId,
          updates,
          operation: 'update'
        })
      });

      if (!response.ok) {
        throw new Error(`API エラー: ${response.status}`);
      }

      const result = await response.json();
      console.log('☁️ クラウド: ノード更新完了');
      return { success: true, result };

    } catch (error) {
      console.error('☁️ クラウド: ノード更新失敗:', error);
      this.pendingOperations.set(`update_${nodeId}`, {
        type: 'update',
        mapId,
        nodeId,
        updates,
        timestamp: Date.now()
      });
      return { success: false, error: error.message };
    }
  }

  async deleteNode(mapId, nodeId) {
    try {
      console.log('☁️ クラウド: ノード削除開始', nodeId);
      
      const response = await fetch(`${this.baseUrl}/nodes/${nodeId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          mapId,
          operation: 'delete'
        })
      });

      if (!response.ok) {
        throw new Error(`API エラー: ${response.status}`);
      }

      const result = await response.json();
      console.log('☁️ クラウド: ノード削除完了');
      return { success: true, result };

    } catch (error) {
      console.error('☁️ クラウド: ノード削除失敗:', error);
      this.pendingOperations.set(`delete_${nodeId}`, {
        type: 'delete',
        mapId,
        nodeId,
        timestamp: Date.now()
      });
      return { success: false, error: error.message };
    }
  }

  async moveNode(mapId, nodeId, newParentId) {
    try {
      console.log('☁️ クラウド: ノード移動開始', nodeId, '->', newParentId);
      
      const response = await fetch(`${this.baseUrl}/nodes/${nodeId}/move`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          mapId,
          newParentId,
          operation: 'move'
        })
      });

      if (!response.ok) {
        throw new Error(`API エラー: ${response.status}`);
      }

      const result = await response.json();
      console.log('☁️ クラウド: ノード移動完了');
      return { success: true, result };

    } catch (error) {
      console.error('☁️ クラウド: ノード移動失敗:', error);
      this.pendingOperations.set(`move_${nodeId}`, {
        type: 'move',
        mapId,
        nodeId,
        newParentId,
        timestamp: Date.now()
      });
      return { success: false, error: error.message };
    }
  }

  // 失敗操作のリトライ
  async retryPendingOperations() {
    if (this.pendingOperations.size === 0) return;

    console.log('☁️ クラウド: 失敗操作のリトライ開始', this.pendingOperations.size, '件');

    for (const [key, operation] of this.pendingOperations.entries()) {
      try {
        // 古い操作（5分以上前）は破棄
        if (Date.now() - operation.timestamp > 5 * 60 * 1000) {
          console.log('⏰ 古い操作を破棄:', key);
          this.pendingOperations.delete(key);
          continue;
        }

        let result;
        switch (operation.type) {
          case 'add':
            result = await this.addNode(operation.mapId, operation.nodeData, operation.parentId);
            break;
          case 'update':
            result = await this.updateNode(operation.mapId, operation.nodeId, operation.updates);
            break;
          case 'delete':
            result = await this.deleteNode(operation.mapId, operation.nodeId);
            break;
          case 'move':
            result = await this.moveNode(operation.mapId, operation.nodeId, operation.newParentId);
            break;
        }

        if (result?.success) {
          console.log('✅ リトライ成功:', key);
          this.pendingOperations.delete(key);
        }

      } catch (error) {
        console.warn('❌ リトライ失敗:', key, error.message);
      }
    }
  }

  // 同期状態取得
  getSyncStatus() {
    return {
      isOnline: navigator.onLine,
      pendingCount: this.pendingOperations.size,
      lastSync: this.lastSyncTime || null
    };
  }
}

// ストレージアダプターファクトリー
class StorageAdapterFactory {
  static create() {
    const settings = getAppSettings();
    
    if (settings.storageMode === 'cloud') {
      console.log('🏭 ストレージアダプター: クラウドモード選択');
      return new CloudStorageAdapter();
    } else {
      console.log('🏭 ストレージアダプター: ローカルモード選択');
      return new LocalStorageAdapter();
    }
  }
}

// 現在のストレージアダプターを取得
let currentAdapter = null;

export function getCurrentAdapter() {
  if (!currentAdapter) {
    currentAdapter = StorageAdapterFactory.create();
  }
  return currentAdapter;
}

// ストレージモード変更時の再初期化
export function reinitializeAdapter() {
  console.log('🔄 ストレージアダプター再初期化');
  currentAdapter = StorageAdapterFactory.create();
  return currentAdapter;
}

// 定期的なリトライ（クラウドモードのみ）
setInterval(() => {
  const adapter = getCurrentAdapter();
  if (adapter instanceof CloudStorageAdapter && navigator.onLine) {
    adapter.retryPendingOperations();
  }
}, 30000);