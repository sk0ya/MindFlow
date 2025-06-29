/**
 * IndexedDBベースのCloudEngine - バックグラウンド同期対応
 */

import { indexedDBManager, type MindMapIndexedData } from '../../../../utils/indexedDBManager';
import { backgroundSyncManager, type CloudSyncAPI } from '../../../../utils/backgroundSyncManager';
import { authManager } from '../../../features/auth/authManager.js';
import { generateId } from '../../../shared/types/dataTypes.js';
import type { MindMapData, Node, StorageResult, SyncStatus } from '../types.js';

export class CloudEngine implements CloudSyncAPI {
  readonly mode = 'cloud' as const;
  readonly name = 'クラウドストレージエンジン (IndexedDB)';
  
  private baseUrl = '';
  private isInitialized = false;
  private initPromise: Promise<void>;

  constructor() {
    console.log('☁️ CloudEngine: 初期化開始');
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    console.log('☁️ CloudEngine: 初期化開始');
    
    // API base URL を環境別に設定
    this.baseUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
      ? 'http://localhost:8787/api' 
      : 'https://mindflow-api-production.shigekazukoya.workers.dev/api';
    
    // IndexedDBとバックグラウンド同期を初期化
    await indexedDBManager.initialize();
    await backgroundSyncManager.initialize(this, {
      enabled: true,
      intervalMs: 30000, // 30秒間隔
      maxRetries: 3,
      retryDelayMs: 5000,
      batchSize: 10
    });
    
    // 認証状態が有効な場合はバックグラウンド同期を開始
    if (authManager.isAuthenticated()) {
      backgroundSyncManager.startBackgroundSync();
    }
    
    console.log('☁️ CloudEngine: 初期化完了', {
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
        
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        
        let processedError: Error;
        if (error instanceof Error) {
          processedError = error;
          if (error.name === 'AbortError') {
            console.warn(`⏱️ API呼び出しタイムアウト (${timeout}ms): 試行 ${attempt}/${maxRetries}`);
            processedError = new Error(`Request timeout after ${timeout}ms`);
          }
        } else {
          processedError = new Error(`Unknown error: ${String(error)}`);
        }
        
        if (this.isRetryableError(processedError) && attempt < maxRetries) {
          const delay = this.calculateBackoffDelay(attempt);
          console.warn(`🔄 リトライ ${attempt}/${maxRetries} - ${delay}ms後に再試行:`, processedError.message);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        console.error(`❌ API呼び出し最終失敗 (${attempt}/${maxRetries} 試行):`, processedError.message);
        throw processedError;
      }
    }
    
    throw new Error(`Max retries (${maxRetries}) exceeded without successful response`);
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
      } catch (e) {
        // JSON parse error is expected for some responses
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

  private isRetryableError(error: Error): boolean {
    const retryableMessages = [
      'Request timeout',
      'Network error',
      'fetch failed',
      'Failed to fetch'
    ];
    
    const retryableStatuses = [500, 502, 503, 504];
    
    return (
      retryableMessages.some(msg => error.message.includes(msg)) ||
      retryableStatuses.includes((error as any).status) ||
      error.name === 'TypeError'
    );
  }

  private calculateBackoffDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
  }

  /**
   * CloudSyncAPI実装 - バックグラウンド同期用
   */
  async getMindMaps(): Promise<any[]> {
    const response = await this.apiCall<{ mindmaps?: MindMapData[], maps?: MindMapData[] } | MindMapData[]>('/mindmaps', 'GET');
    return Array.isArray(response) ? response : ((response as any).mindmaps || (response as any).maps || []);
  }

  async getMindMap(id: string): Promise<any> {
    return await this.apiCall<MindMapData>(`/mindmaps/${id}`, 'GET');
  }

  async createMindMap(data: any): Promise<any> {
    return await this.apiCall<MindMapData>('/mindmaps', 'POST', data);
  }

  async updateMindMap(id: string, data: any): Promise<any> {
    return await this.apiCall<MindMapData>(`/mindmaps/${id}`, 'PUT', { ...data, id });
  }

  async deleteMindMap(id: string): Promise<void> {
    await this.apiCall(`/mindmaps/${id}`, 'DELETE');
  }

  async createNode(mapId: string, nodeData: any): Promise<any> {
    return await this.apiCall(`/nodes/${mapId}`, 'POST', {
      mapId,
      node: nodeData,
      parentId: nodeData.parentId,
      operation: 'add'
    });
  }

  // CloudSyncAPI実装 - バックグラウンド同期で使用される部分をオーバーライド
  async updateNode(mapId: string, nodeId: string, nodeData: any): Promise<any> {
    // CloudSyncAPIとして使用される場合は直接API呼び出し
    return await this.apiCall(`/nodes/${mapId}/${nodeId}`, 'PUT', {
      mapId,
      updates: nodeData,
      operation: 'update'
    });
  }

  async deleteNode(mapId: string, nodeId: string): Promise<void> {
    // CloudSyncAPIとして使用される場合は直接API呼び出し
    await this.apiCall(`/nodes/${mapId}/${nodeId}`, 'DELETE', {
      mapId,
      operation: 'delete'
    });
  }

  async moveNode(mapId: string, nodeId: string, moveData: any): Promise<any> {
    // CloudSyncAPIとして使用される場合は直接API呼び出し
    return await this.apiCall(`/nodes/${mapId}/${nodeId}/move`, 'PUT', {
      mapId,
      newParentId: moveData.newParentId,
      operation: 'move'
    });
  }

  /**
   * マップ管理 - ローカルファーストアプローチ
   */
  async getAllMaps(): Promise<MindMapData[]> {
    await this.ensureInitialized();
    console.log('☁️ IndexedDB: マップ一覧取得開始');
    
    const user = authManager.getCurrentUser();
    const localMaps = await indexedDBManager.getAllMindMaps(user?.email);
    
    // IndexedDBからMindMapData形式に変換
    const maps = localMaps.map(this.convertToMindMapData);
    
    console.log('☁️ IndexedDB: マップ一覧取得完了', maps.length, '件');
    return maps;
  }

  async getMap(mapId: string): Promise<MindMapData> {
    await this.ensureInitialized();
    console.log('☁️ IndexedDB: マップ取得開始', mapId);
    
    const localMap = await indexedDBManager.getMindMap(mapId);
    if (!localMap) {
      throw new Error(`マップが見つかりません: ${mapId}`);
    }
    
    const map = this.convertToMindMapData(localMap);
    console.log('☁️ IndexedDB: マップ取得完了', map.title);
    return map;
  }

  async createMap(mapData: MindMapData): Promise<StorageResult<MindMapData>> {
    try {
      await this.ensureInitialized();
      console.log('☁️ IndexedDB: マップ作成開始', mapData.title);
      
      const user = authManager.getCurrentUser();
      const indexedData: MindMapIndexedData = {
        id: mapData.id,
        title: mapData.title,
        rootNode: mapData.rootNode,
        settings: mapData.settings || { autoSave: true, autoLayout: false },
        lastModified: Date.now(),
        syncStatus: 'pending',
        localVersion: 1,
        userId: user?.email
      };
      
      // ローカルに保存
      await indexedDBManager.saveMindMap(indexedData);
      
      // バックグラウンド同期に登録
      await indexedDBManager.addSyncOperation({
        mapId: mapData.id,
        operation: 'create',
        data: mapData,
        timestamp: Date.now()
      });
      
      console.log('☁️ IndexedDB: マップ作成完了（同期待ち）', mapData.title);
      return { success: true, data: mapData };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('☁️ IndexedDB: マップ作成失敗:', error);
      return { success: false, error: errorMessage };
    }
  }

  async updateMap(mapId: string, mapData: MindMapData): Promise<StorageResult<MindMapData>> {
    try {
      await this.ensureInitialized();
      console.log('☁️ IndexedDB: マップ更新開始:', mapId, mapData.title);
      
      const existingMap = await indexedDBManager.getMindMap(mapId);
      if (!existingMap) {
        throw new Error(`更新対象のマップが見つかりません: ${mapId}`);
      }
      
      const updatedMap: MindMapIndexedData = {
        ...existingMap,
        title: mapData.title,
        rootNode: mapData.rootNode,
        settings: mapData.settings || existingMap.settings,
        lastModified: Date.now(),
        syncStatus: 'pending',
        localVersion: existingMap.localVersion + 1
      };
      
      // ローカルに保存
      await indexedDBManager.saveMindMap(updatedMap);
      
      // バックグラウンド同期に登録
      await indexedDBManager.addSyncOperation({
        mapId: mapId,
        operation: 'update',
        data: mapData,
        timestamp: Date.now()
      });
      
      console.log('☁️ IndexedDB: マップ更新完了（同期待ち）:', mapData.title);
      return { success: true, data: mapData };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('☁️ IndexedDB: マップ更新失敗:', error);
      return { success: false, error: errorMessage };
    }
  }

  async deleteMap(mapId: string): Promise<StorageResult<boolean>> {
    try {
      await this.ensureInitialized();
      console.log('☁️ IndexedDB: マップ削除開始', mapId);
      
      // ローカルから削除
      await indexedDBManager.deleteMindMap(mapId);
      
      // バックグラウンド同期に登録
      await indexedDBManager.addSyncOperation({
        mapId: mapId,
        operation: 'delete',
        data: { mapId },
        timestamp: Date.now()
      });
      
      console.log('☁️ IndexedDB: マップ削除完了（同期待ち）');
      return { success: true, data: true };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('☁️ IndexedDB: マップ削除失敗:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * ノード操作
   */
  async addNode(mapId: string, nodeData: Node, parentId: string): Promise<StorageResult<Node>> {
    try {
      await this.ensureInitialized();
      console.log('☁️ IndexedDB: ノード追加開始', nodeData.id);
      
      // ローカルマップを更新
      const localMap = await indexedDBManager.getMindMap(mapId);
      if (!localMap) {
        throw new Error(`マップが見つかりません: ${mapId}`);
      }
      
      // ノードをローカルに追加
      this.addNodeToRootNode(localMap.rootNode, nodeData, parentId);
      
      // マップを保存
      localMap.lastModified = Date.now();
      localMap.syncStatus = 'pending';
      localMap.localVersion++;
      await indexedDBManager.saveMindMap(localMap);
      
      // バックグラウンド同期に登録
      await indexedDBManager.addSyncOperation({
        mapId: mapId,
        operation: 'node_create',
        data: { ...nodeData, parentId },
        timestamp: Date.now()
      });
      
      console.log('☁️ IndexedDB: ノード追加完了（同期待ち）', nodeData.id);
      return { success: true, data: nodeData };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('☁️ IndexedDB: ノード追加失敗:', error);
      return { success: false, error: errorMessage };
    }
  }

  async updateNodeLocal(mapId: string, nodeId: string, updates: Partial<Node>): Promise<StorageResult<Node>> {
    try {
      await this.ensureInitialized();
      console.log('☁️ IndexedDB: ノード更新開始', nodeId);
      
      // ローカルマップを更新
      const localMap = await indexedDBManager.getMindMap(mapId);
      if (!localMap) {
        throw new Error(`マップが見つかりません: ${mapId}`);
      }
      
      // ノードをローカルで更新
      const updatedNode = this.updateNodeInRootNode(localMap.rootNode, nodeId, updates);
      if (!updatedNode) {
        throw new Error(`ノードが見つかりません: ${nodeId}`);
      }
      
      // マップを保存
      localMap.lastModified = Date.now();
      localMap.syncStatus = 'pending';
      localMap.localVersion++;
      await indexedDBManager.saveMindMap(localMap);
      
      // バックグラウンド同期に登録
      await indexedDBManager.addSyncOperation({
        mapId: mapId,
        operation: 'node_update',
        data: { nodeId, ...updates },
        timestamp: Date.now()
      });
      
      console.log('☁️ IndexedDB: ノード更新完了（同期待ち）');
      return { success: true, data: updatedNode };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('☁️ IndexedDB: ノード更新失敗:', error);
      return { success: false, error: errorMessage };
    }
  }

  async deleteNodeLocal(mapId: string, nodeId: string): Promise<StorageResult<boolean>> {
    try {
      await this.ensureInitialized();
      console.log('☁️ IndexedDB: ノード削除開始', nodeId);
      
      // ローカルマップを更新
      const localMap = await indexedDBManager.getMindMap(mapId);
      if (!localMap) {
        throw new Error(`マップが見つかりません: ${mapId}`);
      }
      
      // ノードをローカルから削除
      const deleted = this.deleteNodeFromRootNode(localMap.rootNode, nodeId);
      if (!deleted) {
        throw new Error(`ノードが見つかりません: ${nodeId}`);
      }
      
      // マップを保存
      localMap.lastModified = Date.now();
      localMap.syncStatus = 'pending';
      localMap.localVersion++;
      await indexedDBManager.saveMindMap(localMap);
      
      // バックグラウンド同期に登録
      await indexedDBManager.addSyncOperation({
        mapId: mapId,
        operation: 'node_delete',
        data: { nodeId },
        timestamp: Date.now()
      });
      
      console.log('☁️ IndexedDB: ノード削除完了（同期待ち）');
      return { success: true, data: true };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('☁️ IndexedDB: ノード削除失敗:', error);
      return { success: false, error: errorMessage };
    }
  }

  async moveNodeLocal(mapId: string, nodeId: string, newParentId: string): Promise<StorageResult<boolean>> {
    try {
      await this.ensureInitialized();
      console.log('☁️ IndexedDB: ノード移動開始', nodeId, '->', newParentId);
      
      // ローカルマップを更新
      const localMap = await indexedDBManager.getMindMap(mapId);
      if (!localMap) {
        throw new Error(`マップが見つかりません: ${mapId}`);
      }
      
      // ノードをローカルで移動
      const moved = this.moveNodeInRootNode(localMap.rootNode, nodeId, newParentId);
      if (!moved) {
        throw new Error(`ノード移動に失敗しました: ${nodeId}`);
      }
      
      // マップを保存
      localMap.lastModified = Date.now();
      localMap.syncStatus = 'pending';
      localMap.localVersion++;
      await indexedDBManager.saveMindMap(localMap);
      
      // バックグラウンド同期に登録
      await indexedDBManager.addSyncOperation({
        mapId: mapId,
        operation: 'node_move',
        data: { nodeId, newParentId },
        timestamp: Date.now()
      });
      
      console.log('☁️ IndexedDB: ノード移動完了（同期待ち）');
      return { success: true, data: true };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('☁️ IndexedDB: ノード移動失敗:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * ヘルパー関数
   */
  private convertToMindMapData(indexedData: MindMapIndexedData): MindMapData {
    return {
      id: indexedData.id,
      title: indexedData.title,
      rootNode: indexedData.rootNode,
      settings: indexedData.settings,
      createdAt: new Date(indexedData.lastModified).toISOString(),
      updatedAt: new Date(indexedData.lastModified).toISOString()
    };
  }

  private addNodeToRootNode(rootNode: any, nodeData: Node, parentId: string): void {
    if (parentId === 'root' || parentId === rootNode.id) {
      if (!rootNode.children) {
        rootNode.children = [];
      }
      rootNode.children.push(nodeData);
      return;
    }

    if (rootNode.children) {
      for (const child of rootNode.children) {
        if (child.id === parentId) {
          if (!child.children) {
            child.children = [];
          }
          child.children.push(nodeData);
          return;
        }
        this.addNodeToRootNode(child, nodeData, parentId);
      }
    }
  }

  private updateNodeInRootNode(rootNode: any, nodeId: string, updates: Partial<Node>): Node | null {
    if (rootNode.id === nodeId) {
      Object.assign(rootNode, updates);
      return rootNode;
    }

    if (rootNode.children) {
      for (const child of rootNode.children) {
        const result = this.updateNodeInRootNode(child, nodeId, updates);
        if (result) return result;
      }
    }

    return null;
  }

  private deleteNodeFromRootNode(rootNode: any, nodeId: string): boolean {
    if (rootNode.children) {
      const initialLength = rootNode.children.length;
      rootNode.children = rootNode.children.filter((child: any) => child.id !== nodeId);
      
      if (rootNode.children.length < initialLength) {
        return true;
      }

      for (const child of rootNode.children) {
        if (this.deleteNodeFromRootNode(child, nodeId)) {
          return true;
        }
      }
    }

    return false;
  }

  private moveNodeInRootNode(rootNode: any, nodeId: string, newParentId: string): boolean {
    // 1. ノードを見つけて削除
    const nodeToMove = this.findAndRemoveNode(rootNode, nodeId);
    if (!nodeToMove) {
      return false;
    }

    // 2. 新しい親に追加
    this.addNodeToRootNode(rootNode, nodeToMove, newParentId);
    return true;
  }

  private findAndRemoveNode(rootNode: any, nodeId: string): Node | null {
    if (rootNode.children) {
      for (let i = 0; i < rootNode.children.length; i++) {
        if (rootNode.children[i].id === nodeId) {
          return rootNode.children.splice(i, 1)[0];
        }
        
        const found = this.findAndRemoveNode(rootNode.children[i], nodeId);
        if (found) return found;
      }
    }
    
    return null;
  }

  /**
   * 同期・接続
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getMindMaps();
      return true;
    } catch (error: unknown) {
      console.error('☁️ IndexedDB接続テスト失敗:', error);
      return false;
    }
  }

  getSyncStatus(): SyncStatus {
    const syncStatus = backgroundSyncManager.getSyncStatus();
    return {
      isOnline: navigator.onLine,
      pendingCount: 0, // バックグラウンド同期で管理
      lastSync: null,
      mode: 'cloud',
      backgroundSync: syncStatus
    };
  }

  // バックグラウンド同期制御
  async startBackgroundSync(): Promise<void> {
    await this.ensureInitialized();
    backgroundSyncManager.startBackgroundSync();
    console.log('🔄 バックグラウンド同期開始');
  }

  async stopBackgroundSync(): Promise<void> {
    backgroundSyncManager.stopBackgroundSync();
    console.log('⏹️ バックグラウンド同期停止');
  }

  async performManualSync(): Promise<void> {
    await this.ensureInitialized();
    const result = await backgroundSyncManager.performManualSync();
    console.log('🔄 手動同期完了:', result);
  }

  // エクスポート・インポート・ユーティリティ
  async exportMapAsJSON(mapData: MindMapData): Promise<void> {
    const dataStr = JSON.stringify(mapData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `${mapData.title || 'mindmap'}.json`;
    link.click();
    
    URL.revokeObjectURL(link.href);
    console.log('☁️ IndexedDB: JSONエクスポート完了', mapData.title);
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
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          resolve({ 
            success: false, 
            error: `マインドマップファイルの解析に失敗しました: ${errorMessage}` 
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

  // 現在のマップ管理（互換性のため）
  async getCurrentMap(): Promise<MindMapData | null> {
    console.log('☁️ IndexedDBモード: getCurrentMap をスキップ（個別ロード方式）');
    return null;
  }

  async setCurrentMap(mapData: MindMapData): Promise<StorageResult<MindMapData>> {
    console.log('☁️ IndexedDBモード: setCurrentMap（互換性のため成功）', mapData.title);
    return { success: true, data: mapData };
  }

  async hasLocalData(): Promise<boolean> {
    const maps = await indexedDBManager.getAllMindMaps();
    return maps.length > 0;
  }

  async cleanupCorruptedData(): Promise<{
    before: number;
    after: number;
    removed: number;
    corruptedMaps: any[];
  }> {
    console.log('☁️ IndexedDBモード: データクリーンアップ開始');
    const maps = await indexedDBManager.getAllMindMaps();
    
    return {
      before: maps.length,
      after: maps.length,
      removed: 0,
      corruptedMaps: []
    };
  }

  async clearAllData(): Promise<boolean> {
    try {
      await indexedDBManager.clearDatabase();
      console.log('☁️ IndexedDBモード: 全データクリア完了');
      return true;
    } catch (error) {
      console.error('☁️ IndexedDBモード: データクリア失敗:', error);
      return false;
    }
  }
}

// ファクトリー関数
export function createCloudEngine(): CloudEngine {
  console.log('☁️ CloudEngineファクトリー: インスタンス作成');
  return new CloudEngine();
}