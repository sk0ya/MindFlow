// クラウドストレージ専用エンジン
// 完全にクラウド環境に特化、ローカルストレージ依存なし

import { authManager } from '../../../features/auth/authManager.js';
import { generateId } from '../../../shared/types/dataTypes.js';
import type { MindMapData, Node, StorageResult, SyncStatus } from '../types.js';

export class CloudEngine {
  readonly mode = 'cloud' as const;
  readonly name = 'クラウドストレージエンジン';
  
  private baseUrl = '';
  private isInitialized = false;
  private initPromise: Promise<void>;
  private pendingOperations = new Map<string, any>();
  private lastSyncTime: string | null = null;

  constructor() {
    if (!authManager.isAuthenticated()) {
      throw new Error('クラウドエンジンは認証が必要です');
    }
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    console.log('☁️ クラウドエンジン: 初期化開始');
    
    // API base URL を環境別に設定
    this.baseUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
      ? 'http://localhost:8787/api' 
      : 'https://mindflow-api-production.shigekazukoya.workers.dev/api';
    
    console.log('☁️ クラウドエンジン: 初期化完了', {
      baseUrl: this.baseUrl,
      authenticated: authManager.isAuthenticated()
    });
    
    this.isInitialized = true;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initPromise;
    }
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    if (!authManager.isAuthenticated()) {
      throw new Error('認証が必要です');
    }

    const authHeader = authManager.getAuthHeader();
    const user = authManager.getCurrentUser();
    
    if (!authHeader) {
      throw new Error('認証ヘッダーが見つかりません');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      'X-User-ID': user?.email || 'unknown'
    };
  }

  private async apiCall<T = any>(
    endpoint: string, 
    method: string = 'GET', 
    data: any = null, 
    timeout: number = 30000, 
    maxRetries: number = 3
  ): Promise<T> {
    await this.ensureInitialized();
    
    const url = `${this.baseUrl}${endpoint}`;
    const headers = await this.getAuthHeaders();
    
    const options: RequestInit = {
      method,
      headers
    };
    
    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }
    
    console.log('📤 クラウドAPI呼び出し:', { method, url, hasData: !!data });
    
    // リトライロジック
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        
        return await this.handleResponse<T>(response, method);
        
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          console.warn(`⏱️ API呼び出しタイムアウト (${timeout}ms): 試行 ${attempt}/${maxRetries}`);
          error = new Error(`Request timeout after ${timeout}ms`);
        }
        
        if (this.isRetryableError(error) && attempt < maxRetries) {
          const delay = this.calculateBackoffDelay(attempt);
          console.warn(`🔄 リトライ ${attempt}/${maxRetries} - ${delay}ms後に再試行:`, error.message);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        console.error(`❌ API呼び出し最終失敗 (${attempt}/${maxRetries} 試行):`, error.message);
        throw error;
      }
    }
  }

  private async handleResponse<T>(response: Response, method: string): Promise<T> {
    if (response.status === 404 && method === 'DELETE') {
      console.log('☁️ 削除対象が見つからない (既に削除済み)');
      return { message: 'Already deleted', success: true } as T;
    }
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '60';
      const error = new Error(`Rate limited. Retry after ${retryAfter} seconds`);
      (error as any).status = 429;
      (error as any).retryAfter = parseInt(retryAfter);
      throw error;
    }
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorBody = '';
      
      try {
        errorBody = await response.text();
        errorMessage += ` - ${errorBody}`;
        
        // UNIQUE制約違反の検出
        if (response.status === 500 && errorBody.includes('UNIQUE constraint failed: nodes.id')) {
          console.warn('🔄 UNIQUE制約違反検出: ノードIDの再生成が必要');
          const error = new Error('UNIQUE_CONSTRAINT_VIOLATION');
          (error as any).originalError = errorMessage;
          (error as any).needsRetry = true;
          throw error;
        }
        
        // Parent node not foundの検出
        if (response.status === 400 && errorBody.includes('Parent node not found')) {
          console.warn('🔄 Parent node not found 検出: マップ同期が必要');
          const error = new Error('PARENT_NODE_NOT_FOUND');
          (error as any).originalError = errorMessage;
          (error as any).needsMapSync = true;
          throw error;
        }
        
      } catch (e) {
        if (e.message === 'UNIQUE_CONSTRAINT_VIOLATION' || e.message === 'PARENT_NODE_NOT_FOUND') {
          throw e;
        }
      }
      
      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).statusText = response.statusText;
      (error as any).body = errorBody;
      throw error;
    }
    
    const result = await response.json();
    console.log('📥 クラウドAPI応答成功:', { method, success: true });
    return result;
  }

  private isRetryableError(error: any): boolean {
    const retryableMessages = [
      'Request timeout',
      'Network error',
      'fetch failed',
      'Failed to fetch'
    ];
    
    const retryableStatuses = [500, 502, 503, 504];
    
    return (
      retryableMessages.some(msg => error.message.includes(msg)) ||
      retryableStatuses.includes(error.status) ||
      error.name === 'TypeError'
    );
  }

  private calculateBackoffDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
  }

  // マップ管理
  async getAllMaps(): Promise<MindMapData[]> {
    console.log('☁️ クラウド: マップ一覧取得開始');
    
    const response = await this.apiCall<{ mindmaps?: MindMapData[], maps?: MindMapData[] } | MindMapData[]>('/mindmaps', 'GET');
    
    const maps = Array.isArray(response) ? response : ((response as any).mindmaps || (response as any).maps || []);
    console.log('☁️ クラウド: マップ一覧取得完了', maps.length, '件');
    return maps;
  }

  async getMap(mapId: string): Promise<MindMapData> {
    console.log('☁️ クラウド: マップ取得開始', mapId);
    
    const map = await this.apiCall<MindMapData>(`/mindmaps/${mapId}`, 'GET');
    
    // データ構造の検証と正規化
    this.validateAndNormalizeMapData(map);
    
    console.log('☁️ クラウド: マップ取得完了', map.title);
    return map;
  }

  private validateAndNormalizeMapData(map: MindMapData): void {
    if (!map || !map.rootNode) {
      throw new Error('クラウドサーバーからのデータにrootNodeが含まれていません');
    }

    // rootNodeが文字列の場合はパース
    if (typeof map.rootNode === 'string') {
      try {
        console.log('📦 rootNodeをJSONパース中...');
        map.rootNode = JSON.parse(map.rootNode);
        console.log('✅ rootNodeパース成功');
      } catch (parseError) {
        console.error('❌ rootNodeパース失敗:', parseError);
        throw new Error(`rootNodeのパースに失敗しました: ${parseError.message}`);
      }
    }
    
    // 基本構造の検証
    if (!map.rootNode.id) {
      console.warn('⚠️ rootNode.idが見つかりません');
      map.rootNode.id = 'root';
    }
    
    if (!map.rootNode.children) {
      console.warn('⚠️ rootNode.childrenが見つかりません、空配列で初期化');
      map.rootNode.children = [];
    }
    
    if (!Array.isArray(map.rootNode.children)) {
      console.error('❌ rootNode.childrenが配列ではありません:', typeof map.rootNode.children);
      map.rootNode.children = [];
    }
    
    console.log('✅ クラウドデータ構造検証完了:', {
      rootNodeId: map.rootNode.id,
      childrenCount: map.rootNode.children.length
    });
  }

  async createMap(mapData: MindMapData): Promise<StorageResult<MindMapData>> {
    try {
      console.log('☁️ クラウド: マップ作成開始', mapData.title);
      
      const result = await this.apiCall<MindMapData>('/mindmaps', 'POST', mapData);
      console.log('☁️ クラウド: マップ作成完了', result.title);
      
      return { success: true, data: result };
    } catch (error) {
      console.error('☁️ クラウド: マップ作成失敗:', error);
      return { success: false, error: error.message };
    }
  }

  async updateMap(mapId: string, mapData: MindMapData): Promise<StorageResult<MindMapData>> {
    try {
      console.log('☁️ クラウド: マップ更新開始:', mapId, mapData.title);
      
      const dataToSend = {
        ...mapData,
        id: mapId
      };
      
      const result = await this.apiCall<MindMapData>(`/mindmaps/${mapId}`, 'PUT', dataToSend);
      console.log('☁️ クラウド: マップ更新完了:', result.title);
      
      this.lastSyncTime = new Date().toISOString();
      return { success: true, data: result };
    } catch (error) {
      console.error('☁️ クラウド: マップ更新失敗:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteMap(mapId: string): Promise<StorageResult<boolean>> {
    try {
      console.log('☁️ クラウド: マップ削除開始', mapId);
      
      await this.apiCall(`/mindmaps/${mapId}`, 'DELETE');
      console.log('☁️ クラウド: マップ削除完了');
      
      return { success: true, data: true };
    } catch (error) {
      console.error('☁️ クラウド: マップ削除失敗:', error);
      return { success: false, error: error.message };
    }
  }

  // 現在のマップ管理（クラウドモードでは個別管理）
  async getCurrentMap(): Promise<MindMapData | null> {
    console.log('☁️ クラウドモード: getCurrentMap をスキップ（個別ロード方式）');
    return null;
  }

  async setCurrentMap(mapData: MindMapData): Promise<StorageResult<MindMapData>> {
    console.log('☁️ クラウドモード: setCurrentMap（互換性のため成功）', mapData.title);
    return { success: true, data: mapData };
  }

  // ノード操作
  async addNode(mapId: string, nodeData: Node, parentId: string): Promise<StorageResult<Node>> {
    try {
      console.log('☁️ クラウド: ノード追加開始', nodeData.id);
      
      // データ検証
      if (!nodeData.id || typeof nodeData.id !== 'string') {
        return { success: false, error: 'Invalid node ID' };
      }
      if (!parentId || typeof parentId !== 'string') {
        return { success: false, error: 'Invalid parent ID' };
      }
      if (typeof nodeData.x !== 'number' || typeof nodeData.y !== 'number') {
        return { success: false, error: 'Invalid node coordinates' };
      }

      // ルートノードの場合の特別処理
      if (parentId === 'root') {
        console.log('🔍 ルートノードへの追加: サーバー側でルートノード存在確認');
        
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
      
      const result = await this.apiCall(`/nodes/${mapId}`, 'POST', requestBody);
      console.log('☁️ クラウド: ノード追加完了', {
        originalId: nodeData.id,
        finalId: result.id,
        newId: result.newId
      });
      
      return { 
        success: true, 
        data: { ...nodeData, ...result },
        newId: result.newId || result.id
      };

    } catch (error) {
      return await this.handleNodeError(error, 'add', { mapId, nodeData, parentId });
    }
  }

  private async handleNodeError(error: any, operation: string, params: any): Promise<StorageResult<any>> {
    if (error.message === 'UNIQUE_CONSTRAINT_VIOLATION') {
      console.warn('🔄 UNIQUE制約違反: ノードIDを再生成してリトライします', params.nodeData?.id);
      return await this.retryWithNewId(params.mapId, params.nodeData, params.parentId);
    }
    
    if (error.message === 'PARENT_NODE_NOT_FOUND') {
      console.warn('🔄 Parent node not found: ルートノード同期後リトライします', { mapId: params.mapId, parentId: params.parentId });
      try {
        await this.forceMapSync(params.mapId);
        console.log('✅ マップ同期完了、操作をリトライします');
        
        // リトライ実行
        switch (operation) {
          case 'add':
            const requestBody = {
              mapId: params.mapId,
              node: params.nodeData,
              parentId: params.parentId,
              operation: 'add'
            };
            const result = await this.apiCall(`/nodes/${params.mapId}`, 'POST', requestBody);
            return { success: true, data: { ...params.nodeData, ...result } };
        }
      } catch (syncError) {
        console.error('❌ マップ同期失敗:', syncError);
        return { success: false, error: `Parent node not found (マップ同期も失敗): ${syncError.message}` };
      }
    }

    console.error('☁️ クラウド: ノード操作失敗:', error);
    
    // 失敗した操作をキューに追加
    const operationKey = `${operation}_${params.nodeData?.id || params.nodeId || Date.now()}`;
    this.pendingOperations.set(operationKey, {
      type: operation,
      ...params,
      timestamp: Date.now()
    });
    
    return { success: false, error: error.message };
  }

  private async ensureRootNodeExists(mapId: string): Promise<boolean> {
    try {
      const mapData = await this.apiCall<MindMapData>(`/mindmaps/${mapId}`, 'GET');
      
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

  private async forceMapSync(mapId: string): Promise<boolean> {
    try {
      const mapData = await this.getMap(mapId);
      if (!mapData) {
        throw new Error('マップデータが取得できません');
      }

      const updateResult = await this.updateMap(mapId, mapData);
      if (!updateResult.success) {
        throw new Error('マップ更新に失敗しました');
      }

      console.log('✅ マップ強制更新でルートノード同期完了');
      return true;
    } catch (error) {
      console.error('❌ マップ同期エラー:', error);
      throw error;
    }
  }

  private async retryWithNewId(
    mapId: string, 
    originalNodeData: Node, 
    parentId: string, 
    maxRetries: number = 3
  ): Promise<StorageResult<Node>> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const newId = generateId();
        const newNodeData = { ...originalNodeData, id: newId };
        
        console.log(`🔄 リトライ ${attempt}/${maxRetries}: 新ID生成`, {
          originalId: originalNodeData.id,
          newId: newId,
          attempt
        });

        const requestBody = {
          mapId,
          node: newNodeData,
          parentId,
          operation: 'add'
        };

        try {
          const result = await this.apiCall(`/nodes/${mapId}`, 'POST', requestBody);
          console.log('✅ ID再生成リトライ成功:', newId);
          return { success: true, data: { ...newNodeData, ...result }, newId };
        } catch (error) {
          console.warn(`❌ リトライ ${attempt} 失敗:`, error.message);
          
          if (error.message === 'UNIQUE_CONSTRAINT_VIOLATION') {
            continue;
          } else {
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
    
    return { success: false, error: `ID再生成リトライが ${maxRetries} 回失敗しました` };
  }

  async updateNode(mapId: string, nodeId: string, updates: Partial<Node>): Promise<StorageResult<Node>> {
    try {
      console.log('☁️ クラウド: ノード更新開始', nodeId);
      
      const result = await this.apiCall(`/nodes/${mapId}/${nodeId}`, 'PUT', {
        mapId,
        updates,
        operation: 'update'
      });
      
      console.log('☁️ クラウド: ノード更新完了');
      return { success: true, data: { id: nodeId, ...updates, ...result } as Node };

    } catch (error) {
      return await this.handleNodeError(error, 'update', { mapId, nodeId, updates });
    }
  }

  async deleteNode(mapId: string, nodeId: string): Promise<StorageResult<boolean>> {
    try {
      console.log('☁️ クラウド: ノード削除開始', nodeId);
      
      await this.apiCall(`/nodes/${mapId}/${nodeId}`, 'DELETE', {
        mapId,
        operation: 'delete'
      });
      
      console.log('☁️ クラウド: ノード削除完了');
      return { success: true, data: true };

    } catch (error) {
      return await this.handleNodeError(error, 'delete', { mapId, nodeId });
    }
  }

  async moveNode(mapId: string, nodeId: string, newParentId: string): Promise<StorageResult<boolean>> {
    try {
      console.log('☁️ クラウド: ノード移動開始', nodeId, '->', newParentId);
      
      await this.apiCall(`/nodes/${mapId}/${nodeId}/move`, 'PUT', {
        mapId,
        newParentId,
        operation: 'move'
      });
      
      console.log('☁️ クラウド: ノード移動完了');
      return { success: true, data: true };

    } catch (error) {
      return await this.handleNodeError(error, 'move', { mapId, nodeId, newParentId });
    }
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
    console.log('☁️ クラウド: JSONエクスポート完了', mapData.title);
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

  // 同期・接続
  async testConnection(): Promise<boolean> {
    try {
      await this.getAllMaps();
      return true;
    } catch (error) {
      console.error('☁️ クラウド接続テスト失敗:', error);
      return false;
    }
  }

  getSyncStatus(): SyncStatus {
    return {
      isOnline: navigator.onLine,
      pendingCount: this.pendingOperations.size,
      lastSync: this.lastSyncTime,
      mode: 'cloud'
    };
  }

  // 失敗操作のリトライ
  async retryPendingOperations(): Promise<void> {
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

        let result: StorageResult<any>;
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

  // ユーティリティ（クラウドモードでは該当なし）
  async hasLocalData(): Promise<boolean> {
    return false; // クラウドモードではローカルデータは管理しない
  }

  async cleanupCorruptedData() {
    console.log('☁️ クラウドモード: ローカルデータクリーンアップは不要');
    return {
      before: 0,
      after: 0,
      removed: 0,
      corruptedMaps: []
    };
  }

  async clearAllData(): Promise<boolean> {
    console.log('☁️ クラウドモード: ローカルデータクリアは不要');
    return true;
  }
}

// ファクトリー関数（認証状態チェック付き）
export function createCloudEngine(): CloudEngine {
  if (!authManager.isAuthenticated()) {
    throw new Error('クラウドエンジンは認証が必要です');
  }
  
  return new CloudEngine();
}