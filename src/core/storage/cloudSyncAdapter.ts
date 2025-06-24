/**
 * CloudSyncAdapter - クラウド同期拡張アダプター
 * 既存のCloudStorageAdapterを拡張してリアルタイム同期機能に対応
 */

import { cloudAuthManager } from '../../features/auth/cloudAuthManager.js';
import { cloudStorage } from './cloudStorage.js';

interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'move';
  target: 'map' | 'node';
  targetId: string;
  data: any;
  timestamp: string;
  vectorClock: Record<string, number>;
  retryCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface ConflictResolution {
  operation: SyncOperation;
  localData: any;
  remoteData: any;
  resolution: 'local_wins' | 'remote_wins' | 'merge' | 'manual';
  mergedData?: any;
}

export class CloudSyncAdapter {
  private baseUrl: string;
  private isInitialized: boolean = false;
  private operationQueue: SyncOperation[] = [];
  private isProcessingQueue: boolean = false;
  private vectorClock: Record<string, number> = {};
  private conflictQueue: ConflictResolution[] = [];
  private eventListeners: Map<string, Set<Function>> = new Map();
  
  // パフォーマンス統計
  private stats = {
    operationsProcessed: 0,
    conflictsResolved: 0,
    averageLatency: 0,
    errorCount: 0,
    lastSyncTime: null as string | null
  };

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    this.setupEventHandlers();
    this.startQueueProcessor();
  }

  /**
   * イベントハンドラーを設定
   */
  private setupEventHandlers() {
    // 認証状態の変化を監視
    cloudAuthManager.addEventListener((event) => {
      switch (event.event) {
        case 'login_success':
        case 'oauth_success':
          this.initialize();
          break;
        case 'logout':
        case 'cloud_logout':
        case 'token_expired':
          this.cleanup();
          break;
      }
    });

    // ネットワーク状態の監視
    window.addEventListener('online', () => {
      this.processOperationQueue();
    });

    window.addEventListener('offline', () => {
      this.emitEvent('network_offline', null);
    });
  }

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    if (!cloudAuthManager.isCloudAuthEnabled()) {
      throw new Error('Cloud authentication required');
    }

    try {
      // ヘルスチェック
      const isHealthy = await cloudAuthManager.healthCheck();
      if (!isHealthy) {
        throw new Error('Cloud service health check failed');
      }

      // ベクタークロックを初期化
      await this.initializeVectorClock();

      // キューに残った操作を処理
      this.processOperationQueue();

      this.isInitialized = true;
      this.emitEvent('initialized', null);
      
      console.log('🌐 CloudSyncAdapter initialized successfully');
    } catch (error) {
      console.error('CloudSyncAdapter initialization failed:', error);
      throw error;
    }
  }

  /**
   * ベクタークロックを初期化
   */
  private async initializeVectorClock(): Promise<void> {
    try {
      const response = await this.apiCall('/sync/vector-clock', 'GET');
      this.vectorClock = response.vectorClock || {};
      
      const userId = cloudAuthManager.getCloudUser()?.id;
      if (userId && !this.vectorClock[`user_${userId}`]) {
        this.vectorClock[`user_${userId}`] = 0;
      }
    } catch (error) {
      console.warn('Failed to initialize vector clock:', error);
      // フォールバック: ローカルで初期化
      const userId = cloudAuthManager.getCloudUser()?.id;
      this.vectorClock = userId ? { [`user_${userId}`]: 0 } : {};
    }
  }

  /**
   * キュープロセッサーを開始
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      if (this.isInitialized && navigator.onLine && !this.isProcessingQueue) {
        this.processOperationQueue();
      }
    }, 5000); // 5秒ごとに処理
  }

  // ===== マップ操作 =====

  async getAllMaps(): Promise<any[]> {
    await this.ensureInitialized();
    
    try {
      const response = await this.apiCall('/mindmaps', 'GET');
      this.emitEvent('maps_loaded', response.maps);
      return response.maps || [];
    } catch (error) {
      this.handleError('getAllMaps', error);
      throw error;
    }
  }

  async getMap(mapId: string): Promise<any> {
    await this.ensureInitialized();
    
    try {
      const response = await this.apiCall(`/mindmaps/${mapId}`, 'GET');
      
      // 競合チェック
      if (response.vectorClock) {
        await this.checkAndResolveConflicts(mapId, response);
      }
      
      this.emitEvent('map_loaded', response);
      return response;
    } catch (error) {
      this.handleError('getMap', error);
      throw error;
    }
  }

  async createMap(mapData: any): Promise<any> {
    const operation: SyncOperation = {
      id: this.generateOperationId(),
      type: 'create',
      target: 'map',
      targetId: mapData.id,
      data: mapData,
      timestamp: new Date().toISOString(),
      vectorClock: this.incrementVectorClock(),
      retryCount: 0,
      status: 'pending'
    };

    return await this.executeOperation(operation);
  }

  async updateMap(mapId: string, mapData: any): Promise<any> {
    const operation: SyncOperation = {
      id: this.generateOperationId(),
      type: 'update',
      target: 'map',
      targetId: mapId,
      data: mapData,
      timestamp: new Date().toISOString(),
      vectorClock: this.incrementVectorClock(),
      retryCount: 0,
      status: 'pending'
    };

    return await this.executeOperation(operation);
  }

  async deleteMap(mapId: string): Promise<any> {
    const operation: SyncOperation = {
      id: this.generateOperationId(),
      type: 'delete',
      target: 'map',
      targetId: mapId,
      data: {},
      timestamp: new Date().toISOString(),
      vectorClock: this.incrementVectorClock(),
      retryCount: 0,
      status: 'pending'
    };

    return await this.executeOperation(operation);
  }

  // ===== ノード操作 =====

  async addNode(mapId: string, nodeData: any, parentId?: string): Promise<any> {
    const operation: SyncOperation = {
      id: this.generateOperationId(),
      type: 'create',
      target: 'node',
      targetId: nodeData.id,
      data: { ...nodeData, parentId, mapId },
      timestamp: new Date().toISOString(),
      vectorClock: this.incrementVectorClock(),
      retryCount: 0,
      status: 'pending'
    };

    return await this.executeOperation(operation);
  }

  async updateNode(mapId: string, nodeId: string, updates: any): Promise<any> {
    const operation: SyncOperation = {
      id: this.generateOperationId(),
      type: 'update',
      target: 'node',
      targetId: nodeId,
      data: { ...updates, mapId },
      timestamp: new Date().toISOString(),
      vectorClock: this.incrementVectorClock(),
      retryCount: 0,
      status: 'pending'
    };

    return await this.executeOperation(operation);
  }

  async deleteNode(mapId: string, nodeId: string): Promise<any> {
    const operation: SyncOperation = {
      id: this.generateOperationId(),
      type: 'delete',
      target: 'node',
      targetId: nodeId,
      data: { mapId },
      timestamp: new Date().toISOString(),
      vectorClock: this.incrementVectorClock(),
      retryCount: 0,
      status: 'pending'
    };

    return await this.executeOperation(operation);
  }

  async moveNode(mapId: string, nodeId: string, newParentId?: string): Promise<any> {
    const operation: SyncOperation = {
      id: this.generateOperationId(),
      type: 'move',
      target: 'node',
      targetId: nodeId,
      data: { mapId, newParentId },
      timestamp: new Date().toISOString(),
      vectorClock: this.incrementVectorClock(),
      retryCount: 0,
      status: 'pending'
    };

    return await this.executeOperation(operation);
  }

  // ===== 操作実行 =====

  private async executeOperation(operation: SyncOperation): Promise<any> {
    this.operationQueue.push(operation);
    this.emitEvent('operation_queued', operation);

    if (this.isInitialized && navigator.onLine) {
      return await this.processOperation(operation);
    } else {
      // オフライン時は楽観的結果を返す
      return { success: true, operation, offline: true };
    }
  }

  private async processOperation(operation: SyncOperation): Promise<any> {
    const startTime = Date.now();
    operation.status = 'processing';

    try {
      const endpoint = this.getOperationEndpoint(operation);
      const method = this.getOperationMethod(operation);
      
      const response = await this.apiCall(endpoint, method, {
        operation,
        vectorClock: operation.vectorClock
      });

      // ベクタークロックを更新
      if (response.vectorClock) {
        this.mergeVectorClock(response.vectorClock);
      }

      operation.status = 'completed';
      this.removeFromQueue(operation.id);
      
      // 統計更新
      const latency = Date.now() - startTime;
      this.updateStats(latency);

      this.emitEvent('operation_completed', { operation, response });
      return response;

    } catch (error) {
      await this.handleOperationError(operation, error);
      throw error;
    }
  }

  private async processOperationQueue(): Promise<void> {
    if (this.isProcessingQueue || this.operationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const pendingOps = this.operationQueue.filter(op => op.status === 'pending');
      
      for (const operation of pendingOps) {
        try {
          await this.processOperation(operation);
        } catch (error) {
          console.error(`Operation ${operation.id} failed:`, error);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  // ===== 競合解決 =====

  private async checkAndResolveConflicts(mapId: string, remoteData: any): Promise<void> {
    try {
      // ローカルデータとの比較
      const localData = await this.getLocalData(mapId);
      
      if (this.hasVectorClockConflict(localData.vectorClock, remoteData.vectorClock)) {
        const resolution = await this.resolveConflict(localData, remoteData);
        
        this.conflictQueue.push({
          operation: {
            id: this.generateOperationId(),
            type: 'update',
            target: 'map',
            targetId: mapId,
            data: resolution.mergedData,
            timestamp: new Date().toISOString(),
            vectorClock: this.incrementVectorClock(),
            retryCount: 0,
            status: 'pending'
          },
          localData,
          remoteData,
          resolution: resolution.strategy,
          mergedData: resolution.mergedData
        });

        this.stats.conflictsResolved++;
        this.emitEvent('conflict_resolved', resolution);
      }
    } catch (error) {
      console.error('Conflict resolution failed:', error);
    }
  }

  private hasVectorClockConflict(localClock: Record<string, number>, remoteClock: Record<string, number>): boolean {
    const allKeys = new Set([...Object.keys(localClock || {}), ...Object.keys(remoteClock || {})]);
    
    let localIsGreater = false;
    let remoteIsGreater = false;

    for (const key of allKeys) {
      const localVal = localClock?.[key] || 0;
      const remoteVal = remoteClock?.[key] || 0;

      if (localVal > remoteVal) localIsGreater = true;
      if (remoteVal > localVal) remoteIsGreater = true;
    }

    return localIsGreater && remoteIsGreater; // 並行性を検出
  }

  private async resolveConflict(localData: any, remoteData: any): Promise<{ strategy: string, mergedData: any }> {
    // 簡単な競合解決ロジック（実際の実装ではより詳細な解決が必要）
    const localTimestamp = new Date(localData.lastModified || 0).getTime();
    const remoteTimestamp = new Date(remoteData.lastModified || 0).getTime();

    if (remoteTimestamp > localTimestamp) {
      return { strategy: 'remote_wins', mergedData: remoteData };
    } else {
      return { strategy: 'local_wins', mergedData: localData };
    }
  }

  // ===== ヘルパーメソッド =====

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private async apiCall(endpoint: string, method: string, data?: any): Promise<any> {
    const token = cloudAuthManager.getCloudSyncToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  private incrementVectorClock(): Record<string, number> {
    const userId = cloudAuthManager.getCloudUser()?.id;
    if (userId) {
      const userKey = `user_${userId}`;
      this.vectorClock[userKey] = (this.vectorClock[userKey] || 0) + 1;
    }
    return { ...this.vectorClock };
  }

  private mergeVectorClock(remoteClock: Record<string, number>): void {
    for (const [key, value] of Object.entries(remoteClock)) {
      this.vectorClock[key] = Math.max(this.vectorClock[key] || 0, value);
    }
  }

  private getOperationEndpoint(operation: SyncOperation): string {
    switch (operation.target) {
      case 'map':
        switch (operation.type) {
          case 'create': return '/mindmaps';
          case 'update': return `/mindmaps/${operation.targetId}`;
          case 'delete': return `/mindmaps/${operation.targetId}`;
          default: return '/sync/operation';
        }
      case 'node':
        return '/sync/operation';
      default:
        return '/sync/operation';
    }
  }

  private getOperationMethod(operation: SyncOperation): string {
    switch (operation.type) {
      case 'create': return 'POST';
      case 'update': return 'PUT';
      case 'delete': return 'DELETE';
      case 'move': return 'PUT';
      default: return 'POST';
    }
  }

  private async getLocalData(mapId: string): Promise<any> {
    // 実装: ローカルデータを取得
    return cloudStorage.getMap(mapId);
  }

  private removeFromQueue(operationId: string): void {
    const index = this.operationQueue.findIndex(op => op.id === operationId);
    if (index !== -1) {
      this.operationQueue.splice(index, 1);
    }
  }

  private async handleOperationError(operation: SyncOperation, error: any): Promise<void> {
    operation.retryCount++;
    operation.status = 'failed';

    if (operation.retryCount < 3) {
      // リトライ
      operation.status = 'pending';
      setTimeout(() => {
        this.processOperation(operation);
      }, 1000 * Math.pow(2, operation.retryCount));
    } else {
      // 最大リトライ回数に達した場合
      this.emitEvent('operation_failed', { operation, error });
    }

    this.stats.errorCount++;
  }

  private handleError(context: string, error: any): void {
    console.error(`CloudSyncAdapter ${context} error:`, error);
    this.stats.errorCount++;
    this.emitEvent('error', { context, error });
  }

  private updateStats(latency: number): void {
    this.stats.operationsProcessed++;
    this.stats.averageLatency = 
      (this.stats.averageLatency * 0.9) + (latency * 0.1);
    this.stats.lastSyncTime = new Date().toISOString();
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Event listener error for ${event}:`, error);
        }
      });
    }
  }

  // ===== パブリック API =====

  addEventListener(event: string, listener: Function): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);

    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }

  getStats(): any {
    return {
      ...this.stats,
      queueLength: this.operationQueue.length,
      conflictQueueLength: this.conflictQueue.length,
      vectorClock: { ...this.vectorClock },
      isInitialized: this.isInitialized
    };
  }

  getOperationQueue(): SyncOperation[] {
    return [...this.operationQueue];
  }

  getConflictQueue(): ConflictResolution[] {
    return [...this.conflictQueue];
  }

  async manualSync(): Promise<void> {
    await this.processOperationQueue();
  }

  cleanup(): void {
    this.isInitialized = false;
    this.operationQueue = [];
    this.conflictQueue = [];
    this.vectorClock = {};
    this.eventListeners.clear();
  }
}

// シングルトンインスタンス
export const cloudSyncAdapter = new CloudSyncAdapter();