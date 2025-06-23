// ストレージモード別の処理を完全分離するアダプター
import { getAppSettings } from './storage.js';

// ローカルストレージ専用の処理
class LocalStorageAdapter {
  constructor() {
    this.name = 'ローカルストレージ';
  }

  async getAllMaps() {
    const { getAllMindMapsLocal } = await import('./localStorage.js');
    const maps = getAllMindMapsLocal();
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
    const { saveMindMapLocal } = await import('./localStorage.js');
    await saveMindMapLocal(mapData);
    console.log('🏠 ローカル: マップ作成完了', mapData.title);
    return mapData;
  }

  async updateMap(mapId, mapData) {
    const { saveMindMapLocal } = await import('./localStorage.js');
    await saveMindMapLocal(mapData);
    console.log('🏠 ローカル: マップ更新完了', mapData.title);
    return mapData;
  }

  async deleteMap(mapId) {
    const { deleteMindMapLocal } = await import('./localStorage.js');
    const result = deleteMindMapLocal(mapId);
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
    this.isInitialized = false;
    this.initPromise = this.initialize();
  }

  // 認証状態の詳細チェック
  async debugAuthState() {
    const { authManager } = await import('./authManager.js');
    
    const authState = {
      isAuthenticated: authManager.isAuthenticated(),
      hasToken: !!authManager.getAuthToken(),
      tokenLength: authManager.getAuthToken()?.length || 0,
      user: authManager.getCurrentUser(),
      rawToken: authManager.getAuthToken()?.substring(0, 50) + '...' // 最初の50文字のみ
    };
    
    console.log('🔍 詳細認証状態:', authState);
    return authState;
  }

  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initPromise;
    }
  }

  async initialize() {
    const { authManager } = await import('./authManager.js');
    
    console.log('☁️ クラウド: 初期化開始', {
      isAuthenticated: authManager.isAuthenticated(),
      hasToken: !!authManager.getAuthToken()
    });
    
    this.baseUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:8787/api' 
      : 'https://mindflow-api-production.shigekazukoya.workers.dev/api';
    
    console.log('☁️ クラウド: 初期化完了', {
      baseUrl: this.baseUrl,
      authenticated: authManager.isAuthenticated()
    });
    
    this.isInitialized = true;
  }

  async getAuthHeaders() {
    const { authManager } = await import('./authManager.js');
    
    console.log('🔍 認証状態確認:', {
      isAuthenticated: authManager.isAuthenticated(),
      hasToken: !!authManager.getAuthToken(),
      user: authManager.getCurrentUser()
    });
    
    if (!authManager.isAuthenticated()) {
      throw new Error('認証が必要です');
    }

    const authHeader = authManager.getAuthHeader(); // これは既に "Bearer ${token}" 形式
    const user = authManager.getCurrentUser();
    
    if (!authHeader) {
      throw new Error('認証ヘッダーが見つかりません');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': authHeader, // Bearerプレフィックスは既に含まれている
      'X-User-ID': user?.email || 'unknown'
    };
    
    console.log('📤 送信ヘッダー:', {
      hasAuth: !!headers.Authorization,
      authHeader: authHeader.substring(0, 20) + '...',
      userId: headers['X-User-ID']
    });
    
    return headers;
  }

  async getAllMaps() {
    try {
      await this.ensureInitialized();
      console.log('☁️ クラウド: マップ一覧取得開始');
      
      const { cloudStorage } = await import('./cloudStorage.js');
      const maps = await cloudStorage.getAllMindMapsCloud();
      console.log('☁️ クラウド: マップ一覧取得完了', maps.length, '件');
      return maps;

    } catch (error) {
      console.error('☁️ クラウド: マップ一覧取得失敗:', error);
      throw error;
    }
  }

  async getMap(mapId) {
    try {
      await this.ensureInitialized();
      console.log('☁️ クラウド: マップ取得開始', mapId);
      
      const { cloudStorage } = await import('./cloudStorage.js');
      const map = await cloudStorage.getMindMapCloud(mapId);
      console.log('☁️ クラウド: マップ取得完了', map.title);
      return map;

    } catch (error) {
      console.error('☁️ クラウド: マップ取得失敗:', error);
      throw error;
    }
  }

  async createMap(mapData) {
    try {
      await this.ensureInitialized();
      console.log('☁️ クラウド: マップ作成開始', mapData.title);
      
      const { cloudStorage } = await import('./cloudStorage.js');
      const result = await cloudStorage.createMindMapCloud(mapData);
      console.log('☁️ クラウド: マップ作成完了', result.title);
      return result;

    } catch (error) {
      console.error('☁️ クラウド: マップ作成失敗:', error);
      throw error;
    }
  }

  async updateMap(mapId, mapData) {
    try {
      await this.ensureInitialized();
      console.log('☁️ クラウド: マップ更新開始', mapId);
      
      const { cloudStorage } = await import('./cloudStorage.js');
      const result = await cloudStorage.updateMindMapCloud(mapId, mapData);
      console.log('☁️ クラウド: マップ更新完了', result.title);
      return result;

    } catch (error) {
      console.error('☁️ クラウド: マップ更新失敗:', error);
      throw error;
    }
  }

  async deleteMap(mapId) {
    try {
      await this.ensureInitialized();
      console.log('☁️ クラウド: マップ削除開始', mapId);
      
      const { cloudStorage } = await import('./cloudStorage.js');
      const result = await cloudStorage.deleteMindMapCloud(mapId);
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
      await this.ensureInitialized();
      console.log('☁️ クラウド: ノード追加開始', nodeData.id);
      
      // データ検証とデバッグログ
      console.log('📤 ノード追加リクエストデータ:', {
        mapId,
        nodeId: nodeData.id,
        parentId,
        nodeDataKeys: Object.keys(nodeData),
        nodeDataSize: JSON.stringify(nodeData).length,
        hasValidId: !!nodeData.id && typeof nodeData.id === 'string',
        hasValidText: nodeData.text !== undefined,
        hasValidCoords: typeof nodeData.x === 'number' && typeof nodeData.y === 'number',
        hasChildren: Array.isArray(nodeData.children)
      });
      
      // データ検証
      if (!nodeData.id || typeof nodeData.id !== 'string') {
        throw new Error('Invalid node ID');
      }
      if (!parentId || typeof parentId !== 'string') {
        throw new Error('Invalid parent ID');
      }
      if (typeof nodeData.x !== 'number' || typeof nodeData.y !== 'number') {
        throw new Error('Invalid node coordinates');
      }
      
      const { authManager } = await import('./authManager.js');
      const requestBody = {
        mapId,
        node: nodeData,
        parentId,
        operation: 'add'
      };
      
      console.log('📤 完全なリクエストボディ:', JSON.stringify(requestBody, null, 2));
      
      const response = await authManager.authenticatedFetch(`${this.baseUrl}/nodes/${mapId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        let errorDetails = `Status: ${response.status}`;
        try {
          const errorBody = await response.text();
          console.error('❌ ノード追加サーバーエラー詳細:', {
            status: response.status,
            statusText: response.statusText,
            body: errorBody,
            requestData: requestBody
          });
          errorDetails += `, Body: ${errorBody}`;
          
          // UNIQUE制約違反の場合は特別処理
          if (response.status === 500 && errorBody.includes('UNIQUE constraint failed: nodes.id')) {
            console.warn('🔄 UNIQUE制約違反検出: ノードIDを再生成してリトライします', nodeData.id);
            return await this.retryWithNewId(mapId, nodeData, parentId);
          }
        } catch (e) {
          console.error('❌ エラーレスポンス読み取り失敗:', e);
        }
        throw new Error(`API エラー: ${errorDetails}`);
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

  // UNIQUE制約違反時のID再生成リトライ
  async retryWithNewId(mapId, originalNodeData, parentId, maxRetries = 3) {
    const { generateId } = await import('./dataTypes.js');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 新しいIDを生成
        const newId = generateId();
        const newNodeData = { ...originalNodeData, id: newId };
        
        console.log(`🔄 リトライ ${attempt}/${maxRetries}: 新ID生成`, {
          originalId: originalNodeData.id,
          newId: newId,
          attempt
        });

        // 新しいIDでリクエスト再送信
        const { authManager } = await import('./authManager.js');
        const requestBody = {
          mapId,
          node: newNodeData,
          parentId,
          operation: 'add'
        };

        const response = await authManager.authenticatedFetch(`${this.baseUrl}/nodes/${mapId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ ID再生成リトライ成功:', newId);
          return { success: true, result, newId };
        } else {
          const errorBody = await response.text();
          console.warn(`❌ リトライ ${attempt} 失敗:`, errorBody);
          
          // 再度UNIQUE制約違反の場合は次のリトライへ
          if (response.status === 500 && errorBody.includes('UNIQUE constraint failed: nodes.id')) {
            continue;
          } else {
            // 他のエラーの場合は即座に失敗
            throw new Error(`API エラー: Status: ${response.status}, Body: ${errorBody}`);
          }
        }
      } catch (error) {
        console.error(`❌ リトライ ${attempt} でエラー:`, error);
        if (attempt === maxRetries) {
          throw error;
        }
      }
    }
    
    throw new Error(`ID再生成リトライが ${maxRetries} 回失敗しました`);
  }

  async updateNode(mapId, nodeId, updates) {
    try {
      await this.ensureInitialized();
      console.log('☁️ クラウド: ノード更新開始', nodeId);
      
      const { authManager } = await import('./authManager.js');
      const response = await authManager.authenticatedFetch(`${this.baseUrl}/nodes/${mapId}/${nodeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
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
      await this.ensureInitialized();
      console.log('☁️ クラウド: ノード削除開始', nodeId);
      
      const { authManager } = await import('./authManager.js');
      const response = await authManager.authenticatedFetch(`${this.baseUrl}/nodes/${mapId}/${nodeId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mapId,
          operation: 'delete'
        })
      });

      if (!response.ok) {
        // 404の場合は既に削除済みなので成功として扱う
        if (response.status === 404) {
          console.log('☁️ クラウド: ノード削除完了 (既に削除済み)');
          return { success: true, result: { message: 'Node already deleted' } };
        }
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
      await this.ensureInitialized();
      console.log('☁️ クラウド: ノード移動開始', nodeId, '->', newParentId);
      
      const { authManager } = await import('./authManager.js');
      const response = await authManager.authenticatedFetch(`${this.baseUrl}/nodes/${mapId}/${nodeId}/move`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
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

// テスト用にクラスをexport
export { CloudStorageAdapter, LocalStorageAdapter, StorageAdapterFactory };