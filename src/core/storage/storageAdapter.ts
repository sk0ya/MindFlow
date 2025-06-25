// ストレージモード別の処理を完全分離するアダプター
import { getAppSettings } from './storageUtils.js';
import { getAllMindMapsLocal, saveMindMapLocal, deleteMindMapLocal } from './localStorage.js';
import { authManager } from '../../features/auth/authManager.js';
import { generateId } from '../../shared/types/dataTypes.js';

// ストレージモード未選択時の待機アダプター
class PendingStorageAdapter {
  constructor() {
    this.name = 'ストレージモード選択待ち';
  }

  async getAllMaps() {
    console.log('⏳ ストレージモード選択待ち: マップ読み込みを保留');
    return [];
  }

  async getMap(mapId) {
    console.log('⏳ ストレージモード選択待ち: マップ取得を保留');
    throw new Error('ストレージモードが選択されていません');
  }

  async createMap(mapData) {
    console.log('⏳ ストレージモード選択待ち: マップ作成を保留');
    throw new Error('ストレージモードが選択されていません');
  }

  async updateMap(mapId, mapData) {
    console.log('⏳ ストレージモード選択待ち: マップ更新を保留');
    throw new Error('ストレージモードが選択されていません');
  }

  async deleteMap(mapId) {
    console.log('⏳ ストレージモード選択待ち: マップ削除を保留');
    throw new Error('ストレージモードが選択されていません');
  }

  // ノード操作（すべて保留）
  async addNode(mapId, nodeData, parentId) {
    console.log('⏳ ストレージモード選択待ち: ノード追加を保留');
    return { success: false, pending: true };
  }

  async updateNode(mapId, nodeId, updates) {
    console.log('⏳ ストレージモード選択待ち: ノード更新を保留');
    return { success: false, pending: true };
  }

  async deleteNode(mapId, nodeId) {
    console.log('⏳ ストレージモード選択待ち: ノード削除を保留');
    return { success: false, pending: true };
  }

  async moveNode(mapId, nodeId, newParentId) {
    console.log('⏳ ストレージモード選択待ち: ノード移動を保留');
    return { success: false, pending: true };
  }
}

// ローカルストレージ専用の処理
class LocalStorageAdapter {
  constructor() {
    this.name = 'ローカルストレージ';
  }

  async getAllMaps() {
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
    await saveMindMapLocal(mapData);
    console.log('🏠 ローカル: マップ作成完了', mapData.title);
    return mapData;
  }

  async updateMap(mapId, mapData) {
    await saveMindMapLocal(mapData);
    console.log('🏠 ローカル: マップ更新完了', mapData.title);
    return mapData;
  }

  async deleteMap(mapId) {
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

// クラウドストレージ専用の処理（シンプル版）
class CloudStorageAdapter {
  constructor() {
    this.name = 'クラウドストレージ（シンプル版）';
    this.baseUrl = '';
    this.pendingOperations = new Map();
    this.isInitialized = false;
    this.initPromise = this.initialize();
    this.useSyncAdapter = false; // シンプルな直接API通信を使用
  }

  // 認証状態の詳細チェック
  async debugAuthState() {
    
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
    
    console.log('☁️ クラウド: 初期化開始', {
      isAuthenticated: authManager.isAuthenticated(),
      hasToken: !!authManager.getAuthToken()
    });
    
    // API base URL を環境別に設定
    this.baseUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
      ? 'http://localhost:8787/api' 
      : 'https://mindflow-api-production.shigekazukoya.workers.dev/api';
    
    console.log('☁️ クラウド: 初期化完了', {
      baseUrl: this.baseUrl,
      authenticated: authManager.isAuthenticated()
    });
    
    this.isInitialized = true;
  }

  async getAuthHeaders() {
    
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

  // シンプルなAPI通信メソッド
  async apiCall(endpoint, method = 'GET', data = null) {
    await this.ensureInitialized();
    
    const url = `${this.baseUrl}${endpoint}`;
    const headers = await this.getAuthHeaders();
    
    const options = {
      method,
      headers
    };
    
    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }
    
    console.log('📤 API呼び出し:', { method, url, hasData: !!data });
    
    const response = await fetch(url, options);
    
    // 特別な処理が必要なステータスコード
    if (response.status === 404 && method === 'DELETE') {
      // DELETE操作で404の場合は既に削除済みとして成功扱い
      console.log('☁️ 削除対象が見つからない (既に削除済み)');
      return { message: 'Already deleted', success: true };
    }
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorBody = '';
      try {
        errorBody = await response.text();
        errorMessage += ` - ${errorBody}`;
        
        // UNIQUE制約違反の特別処理
        if (response.status === 500 && errorBody.includes('UNIQUE constraint failed: nodes.id')) {
          console.warn('🔄 UNIQUE制約違反検出: ノードIDの再生成が必要');
          const error = new Error('UNIQUE_CONSTRAINT_VIOLATION');
          error.originalError = errorMessage;
          error.needsRetry = true;
          throw error;
        }
        
        // Parent node not found の特別処理
        if (response.status === 400 && errorBody.includes('Parent node not found')) {
          console.warn('🔄 Parent node not found 検出: マップ同期が必要');
          const error = new Error('PARENT_NODE_NOT_FOUND');
          error.originalError = errorMessage;
          error.needsMapSync = true;
          throw error;
        }
        
      } catch (e) {
        if (e.message === 'UNIQUE_CONSTRAINT_VIOLATION' || e.message === 'PARENT_NODE_NOT_FOUND') {
          throw e; // 特別なエラーは再スロー
        }
        // JSON解析失敗は無視
      }
      
      const error = new Error(errorMessage);
      error.status = response.status;
      error.statusText = response.statusText;
      error.body = errorBody;
      throw error;
    }
    
    const result = await response.json();
    console.log('📥 API応答:', { method, url, success: true });
    return result;
  }

  async getAllMaps() {
    try {
      await this.ensureInitialized();
      console.log('☁️ クラウド: マップ一覧取得開始');
      
      // シンプルな直接API通信
      const response = await this.apiCall('/mindmaps', 'GET');
      const maps = Array.isArray(response) ? response : (response.maps || []);
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
      
      // シンプルな直接API通信
      const map = await this.apiCall(`/mindmaps/${mapId}`, 'GET');
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
      
      const result = await this.apiCall('/mindmaps', 'POST', mapData);
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
      
      const result = await this.apiCall(`/mindmaps/${mapId}`, 'PUT', mapData);
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
      
      const result = await this.apiCall(`/mindmaps/${mapId}`, 'DELETE');
      console.log('☁️ クラウド: マップ削除完了');
      return result;

    } catch (error) {
      console.error('☁️ クラウド: マップ削除失敗:', error);
      throw error;
    }
  }

  // ルートノード存在確認（Parent node not found エラー対策）
  async ensureRootNodeExists(mapId) {
    try {
      
      // サーバー側でのマップ取得を試行してルートノードの同期を確認
      let mapData;
      try {
        mapData = await this.apiCall(`/mindmaps/${mapId}`, 'GET');
      } catch (error) {
        if (error.status === 404) {
          console.warn('⚠️ マップがサーバーに存在しません。ローカルデータから作成を試行します:', mapId);
          // この場合はgetMapでローカル -> サーバー同期が期待できないので失敗扱い
          throw new Error('マップがサーバーに存在しません');
        }
        throw error;
      }
      console.log('🔍 サーバー側マップ状態:', {
        mapId,
        hasRootNode: !!mapData.rootNode,
        rootNodeId: mapData.rootNode?.id,
        serverChildrenCount: mapData.rootNode?.children?.length || 0
      });

      if (!mapData.rootNode || mapData.rootNode.id !== 'root') {
        console.warn('⚠️ サーバー側でルートノードが正しく設定されていません');
        throw new Error('ルートノードがサーバー側で認識されていません');
      }

      return true;
    } catch (error) {
      console.error('❌ ルートノード存在確認エラー:', error);
      throw error;
    }
  }

  // 強制マップ同期（Parent node not found エラー対策）
  async forceMapSync(mapId) {
    try {
      // まずマップを取得して、現在のデータでマップを更新する
      // これによりルートノードがサーバー側で確実に認識される
      const mapData = await this.getMap(mapId);
      if (!mapData) {
        throw new Error('マップデータが取得できません');
      }

      // マップ更新を実行してルートノードを同期
      const updateResult = await this.updateMap(mapId, mapData);
      if (!updateResult || !updateResult.id) {
        throw new Error('マップ更新に失敗しました');
      }

      console.log('✅ マップ強制更新でルートノード同期完了');
      return true;
    } catch (error) {
      console.error('❌ マップ同期エラー:', error);
      throw error;
    }
  }

  // ルートノードチェックなしでノード追加（リトライ用）
  async addNodeWithoutRootCheck(mapId, nodeData, parentId) {
    const requestBody = {
      mapId,
      node: nodeData,
      parentId,
      operation: 'add'
    };
    
    console.log('🔄 ルートノードチェックなしでリトライ実行');
    
    const result = await this.apiCall(`/nodes/${mapId}`, 'POST', requestBody);
    console.log('✅ リトライ成功:', result);
    
    return { 
      success: true, 
      result,
      newId: result.newId || result.id
    };
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

      // ルートノードの場合の特別処理
      if (parentId === 'root') {
        console.log('🔍 ルートノードへの追加: サーバー側でルートノード存在確認');
        
        // ルートノード確認のため先にマップ情報を同期
        try {
          await this.ensureRootNodeExists(mapId);
          console.log('✅ ルートノード存在確認完了');
        } catch (rootError) {
          console.warn('⚠️ ルートノード確認失敗、通常の処理を継続:', rootError.message);
        }
      }
      
      const requestBody = {
        mapId,
        node: nodeData,
        parentId,
        operation: 'add'
      };
      
      console.log('📤 完全なリクエストボディ:', JSON.stringify(requestBody, null, 2));
      
      const result = await this.apiCall(`/nodes/${mapId}`, 'POST', requestBody);
      console.log('☁️ クラウド: ノード追加完了', {
        originalId: nodeData.id,
        finalId: result.id,
        newId: result.newId
      });
      
      // バックエンドで新しいIDが生成された場合はそれを返す
      const finalResult = { 
        success: true, 
        result,
        newId: result.newId || result.id // バックエンドで生成された新しいID
      };
      
      return finalResult;

    } catch (error) {
      // 特別なエラーハンドリング
      if (error.message === 'UNIQUE_CONSTRAINT_VIOLATION') {
        console.warn('🔄 UNIQUE制約違反: ノードIDを再生成してリトライします', nodeData.id);
        return await this.retryWithNewId(mapId, nodeData, parentId);
      }
      
      if (error.message === 'PARENT_NODE_NOT_FOUND') {
        console.warn('🔄 Parent node not found: ルートノード同期後リトライします', { mapId, parentId });
        try {
          // 強制的にマップ情報を更新してルートノードを同期
          await this.forceMapSync(mapId);
          console.log('✅ マップ同期完了、ノード追加をリトライします');
          
          // 同じパラメータでリトライ
          return await this.addNodeWithoutRootCheck(mapId, nodeData, parentId);
        } catch (syncError) {
          console.error('❌ マップ同期失敗:', syncError);
          throw new Error(`Parent node not found (マップ同期も失敗): ${syncError.message}`);
        }
      }

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
        const requestBody = {
          mapId,
          node: newNodeData,
          parentId,
          operation: 'add'
        };

        try {
          const result = await this.apiCall(`/nodes/${mapId}`, 'POST', requestBody);
          console.log('✅ ID再生成リトライ成功:', newId);
          return { success: true, result, newId };
        } catch (error) {
          console.warn(`❌ リトライ ${attempt} 失敗:`, error.message);
          
          // 再度UNIQUE制約違反の場合は次のリトライへ
          if (error.message === 'UNIQUE_CONSTRAINT_VIOLATION') {
            continue;
          } else {
            // 他のエラーの場合は即座に失敗
            throw error;
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
      
      const result = await this.apiCall(`/nodes/${mapId}/${nodeId}`, 'PUT', {
        mapId,
        updates,
        operation: 'update'
      });
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
      
      const result = await this.apiCall(`/nodes/${mapId}/${nodeId}`, 'DELETE', {
        mapId,
        operation: 'delete'
      });
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
      
      const result = await this.apiCall(`/nodes/${mapId}/${nodeId}/move`, 'PUT', {
        mapId,
        newParentId,
        operation: 'move'
      });
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
    
    // ストレージモード未選択の場合は待機アダプターを返す
    if (settings.storageMode === null || settings.storageMode === undefined) {
      console.log('⏳ ストレージアダプター: モード選択待ち');
      return new PendingStorageAdapter();
    }
    
    if (settings.storageMode === 'cloud') {
      console.log('🏭 ストレージアダプター: クラウドモード選択');
      try {
        // 認証状態をチェック
        // Import is already at the top of the file
        if (!authManager.isAuthenticated()) {
          console.warn('⚠️ クラウドモードですが未認証のため、ローカルモードにフォールバック');
          return new LocalStorageAdapter();
        }
        return new CloudStorageAdapter();
      } catch (error) {
        console.error('❌ クラウドストレージアダプター作成失敗、ローカルモードにフォールバック:', error);
        return new LocalStorageAdapter();
      }
    } else {
      console.log('🏭 ストレージアダプター: ローカルモード選択');
      return new LocalStorageAdapter();
    }
  }
}

// 現在のストレージアダプターを取得
let currentAdapter = null;
let lastStorageMode = null;
let lastAuthState = null;

export function getCurrentAdapter() {
  const settings = getAppSettings();
  const currentAuthState = authManager.isAuthenticated();
  
  // ストレージモードまたは認証状態が変わった場合はアダプターを再作成
  const shouldRecreateAdapter = !currentAdapter || 
    lastStorageMode !== settings.storageMode ||
    (settings.storageMode === 'cloud' && lastAuthState !== currentAuthState);
  
  if (shouldRecreateAdapter) {
    console.log('🔄 アダプター再作成:', {
      reason: !currentAdapter ? 'initial' : 
              lastStorageMode !== settings.storageMode ? 'storage-mode-changed' : 
              'auth-state-changed',
      oldMode: lastStorageMode,
      newMode: settings.storageMode,
      oldAuth: lastAuthState,
      newAuth: currentAuthState
    });
    
    currentAdapter = StorageAdapterFactory.create();
    lastStorageMode = settings.storageMode;
    lastAuthState = currentAuthState;
  }
  
  return currentAdapter;
}

// ストレージモード変更時の再初期化
export function reinitializeAdapter() {
  console.log('🔄 ストレージアダプター再初期化');
  currentAdapter = null;
  lastStorageMode = null;
  lastAuthState = null;
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
export { CloudStorageAdapter, LocalStorageAdapter, PendingStorageAdapter, StorageAdapterFactory };