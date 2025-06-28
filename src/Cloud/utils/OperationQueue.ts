import { VectorClock, VectorClockData } from './VectorClock';
import { SyncStateManager, Operation } from './SyncStateManager';

// ===== Type Definitions =====

/** API client interface for operation sending */
export interface ApiClient {
  post(url: string, data: unknown): Promise<Response>;
}

/** Enhanced operation with queue-specific properties */
export interface QueuedOperation extends Operation {
  _resolve?: (value: unknown) => void;
  _reject?: (reason?: unknown) => void;
}

/** Operation statistics by type */
export interface OperationStatsByType {
  [operationType: string]: number;
}

/** Operation statistics by status */
export interface OperationStatsByStatus {
  [status: string]: number;
}

/** Queue statistics */
export interface QueueStats {
  total: number;
  byType: OperationStatsByType;
  byStatus: OperationStatsByStatus;
  avgRetryCount: number;
  oldestOperation: QueuedOperation | null;
}

/** Queue state information */
export interface QueueState {
  queueLength: number;
  processing: boolean;
  pendingRequests: number;
  stats: QueueStats;
}

/** Auth manager interface */
export interface AuthManager {
  getCurrentUser(): { id?: string } | null;
}

/** Extended sync state manager with auth */
export interface ExtendedSyncStateManager extends SyncStateManager {
  authManager?: AuthManager;
}

/** API response for operations */
export interface OperationResponse {
  vector_clock?: VectorClockData;
  [key: string]: unknown;
}

/** Sync state event */
export interface SyncStateEvent {
  event: string;
  data?: {
    newState?: {
      isConnected?: boolean;
    };
    [key: string]: unknown;
  };
}

// ===== Main Class =====

/**
 * OperationQueue - 操作キューイングとバッチ処理
 * オフライン時の操作蓄積と、オンライン復帰時の同期処理を管理
 */
export class OperationQueue {
  private syncStateManager: ExtendedSyncStateManager;
  private apiClient: ApiClient;
  private queue: QueuedOperation[];
  private processing: boolean;
  private pendingRequests: Map<string, Promise<unknown>>;
  private batchSize: number;
  private batchTimeout: number;
  private maxRetries: number;
  private retryDelay: number;

  constructor(syncStateManager: ExtendedSyncStateManager, apiClient: ApiClient) {
    this.syncStateManager = syncStateManager;
    this.apiClient = apiClient;
    this.queue = [];
    this.processing = false;
    this.pendingRequests = new Map<string, Promise<unknown>>();
    this.batchSize = 10;
    this.batchTimeout = 1000; // 1秒
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1秒

    this.setupEventListeners();
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    // ネットワーク復帰時に自動処理開始
    this.syncStateManager.subscribe((event: SyncStateEvent) => {
      if (event.event === 'network_online' || event.event === 'state_changed') {
        if (event.data?.newState?.isConnected && this.queue.length > 0) {
          this.processQueue();
        }
      }
    });
  }

  /**
   * 操作をキューに追加
   * @param operation - 操作データ
   * @returns 操作完了Promise
   */
  async addOperation(operation: Partial<Operation>): Promise<unknown> {
    const userId = this.getCurrentUserId();
    
    // ベクタークロックを更新
    this.syncStateManager.incrementVectorClock(userId);
    const vectorClock = this.syncStateManager.state.vectorClock;

    const enhancedOperation: QueuedOperation = {
      ...operation,
      id: this.generateOperationId(),
      type: operation.type || 'unknown',
      userId,
      timestamp: new Date().toISOString(),
      data: operation.data || {},
      vectorClock,
      status: 'pending',
      retryCount: 0,
      queuedAt: new Date().toISOString()
    } as QueuedOperation;

    // キューに追加
    this.queue.push(enhancedOperation);
    this.syncStateManager.addPendingOperation(enhancedOperation);

    // Promise作成（外部から完了を待機できるように）
    const promise = new Promise<unknown>((resolve, reject) => {
      enhancedOperation._resolve = resolve;
      enhancedOperation._reject = reject;
    });

    this.pendingRequests.set(enhancedOperation.id, promise);

    // オンラインかつ処理中でない場合は即座に処理開始
    if (this.syncStateManager.state.isConnected && !this.processing) {
      this.processQueue();
    }

    return promise;
  }

  /**
   * キューを処理
   */
  async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    if (!this.syncStateManager.state.isConnected) {
      console.log('Offline: operations queued for later processing');
      return;
    }

    this.processing = true;
    this.syncStateManager.updateState({ isSyncing: true });

    try {
      while (this.queue.length > 0 && this.syncStateManager.state.isConnected) {
        const batch = this.queue.splice(0, this.batchSize);
        await this.processBatch(batch);
        
        // バッチ間の短い待機
        if (this.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('Queue processing error:', error);
      this.syncStateManager.addError(error, 'queue_processing');
    } finally {
      this.processing = false;
      this.syncStateManager.updateState({ 
        isSyncing: false,
        lastSyncTime: new Date().toISOString()
      });
    }
  }

  /**
   * 操作バッチを処理
   * @param batch - 操作のバッチ
   */
  private async processBatch(batch: QueuedOperation[]): Promise<void> {
    const promises = batch.map(operation => this.processOperation(operation));
    
    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Batch processing error:', error);
    }
  }

  /**
   * 単一操作を処理
   * @param operation - 操作データ
   */
  private async processOperation(operation: QueuedOperation): Promise<void> {
    try {
      operation.status = 'processing';
      
      const result = await this.sendOperation(operation);
      
      // 成功時の処理
      operation.status = 'completed';
      operation.completedAt = new Date().toISOString();
      
      // ベクタークロック更新
      const operationResult = result as OperationResponse;
      if (operationResult.vector_clock) {
        this.syncStateManager.mergeVectorClock(operationResult.vector_clock);
      }

      // 履歴に追加
      this.syncStateManager.addToOperationHistory(operation);
      
      // ペンディング操作から削除
      this.syncStateManager.removePendingOperation(operation.id);

      // Promise解決
      if (operation._resolve) {
        operation._resolve(result);
      }

    } catch (error) {
      await this.handleOperationError(operation, error);
    }
  }

  /**
   * 操作送信
   * @param operation - 操作データ
   * @returns API応答
   */
  private async sendOperation(operation: QueuedOperation): Promise<OperationResponse> {
    const response = await this.apiClient.post('/api/sync/operation', operation);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Sync operation failed');
    }

    return await response.json() as OperationResponse;
  }

  /**
   * 操作エラーハンドリング
   * @param operation - 操作データ
   * @param error - エラー
   */
  private async handleOperationError(operation: QueuedOperation, error: Error): Promise<void> {
    operation.retryCount = (operation.retryCount || 0) + 1;
    (operation as QueuedOperation & { lastError: string }).lastError = error.message;
    operation.status = 'failed';

    console.error(`Operation ${operation.id} failed (attempt ${operation.retryCount}):`, error);

    if ((operation.retryCount || 0) < this.maxRetries) {
      // リトライ
      operation.status = 'pending';
      
      // 指数バックオフで遅延
      const delay = this.retryDelay * Math.pow(2, (operation.retryCount || 1) - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // キューの先頭に再挿入
      this.queue.unshift(operation);
      
    } else {
      // 最大リトライ回数に達した場合
      console.error(`Operation ${operation.id} permanently failed after ${this.maxRetries} attempts`);
      
      // 競合キューに移動
      this.syncStateManager.state.conflictQueue.push({
        ...operation,
        permanentFailure: true,
        finalError: error.message
      });

      // ペンディング操作から削除
      this.syncStateManager.removePendingOperation(operation.id);

      // Promise拒否
      if (operation._reject) {
        operation._reject(error);
      }
    }
  }

  /**
   * 特定の操作をキャンセル
   * @param operationId - 操作ID
   */
  cancelOperation(operationId: string): void {
    // キューから削除
    const index = this.queue.findIndex(op => op.id === operationId);
    if (index !== -1) {
      const operation = this.queue.splice(index, 1)[0];
      
      // Promise拒否
      if (operation._reject) {
        operation._reject(new Error('Operation cancelled'));
      }
    }

    // ペンディング操作から削除
    this.syncStateManager.removePendingOperation(operationId);
    this.pendingRequests.delete(operationId);
  }

  /**
   * キューをクリア
   */
  clearQueue(): void {
    // 全てのPromiseを拒否
    this.queue.forEach(operation => {
      if (operation._reject) {
        operation._reject(new Error('Queue cleared'));
      }
    });

    this.queue = [];
    this.pendingRequests.clear();
    
    this.syncStateManager.updateState({
      pendingOperations: []
    });
  }

  /**
   * 操作の優先度を設定
   * @param operationId - 操作ID
   * @param priority - 優先度（数値が小さいほど高優先度）
   */
  setPriority(operationId: string, priority: number): void {
    const operation = this.queue.find(op => op.id === operationId);
    if (operation) {
      (operation as QueuedOperation & { priority: number }).priority = priority;
      
      // 優先度でソート
      this.queue.sort((a, b) => {
        const aPriority = (a as QueuedOperation & { priority?: number }).priority || 0;
        const bPriority = (b as QueuedOperation & { priority?: number }).priority || 0;
        return aPriority - bPriority;
      });
    }
  }

  /**
   * 操作タイプ別の統計を取得
   * @returns 統計データ
   */
  getStats(): QueueStats {
    const stats: QueueStats = {
      total: this.queue.length,
      byType: {},
      byStatus: {},
      avgRetryCount: 0,
      oldestOperation: null
    };

    let totalRetries = 0;
    let oldestTimestamp = null;

    this.queue.forEach(operation => {
      // タイプ別カウント
      const operationType = operation.type || 'unknown';
      stats.byType[operationType] = (stats.byType[operationType] || 0) + 1;

      // ステータス別カウント
      const status = operation.status || 'unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      // リトライ回数の合計
      totalRetries += operation.retryCount || 0;

      // 最古の操作
      if (!oldestTimestamp || operation.timestamp < oldestTimestamp) {
        oldestTimestamp = operation.timestamp;
        stats.oldestOperation = operation;
      }
    });

    stats.avgRetryCount = this.queue.length > 0 ? totalRetries / this.queue.length : 0;

    return stats;
  }

  /**
   * ユーザーID取得（クラウド専用）
   * @returns 現在のユーザーID
   */
  private getCurrentUserId(): string {
    // Cloud mode: get user ID from auth manager or session
    const authManager = this.syncStateManager?.authManager;
    if (authManager && authManager.getCurrentUser()) {
      return authManager.getCurrentUser().id || 'authenticated_user';
    }
    return 'anonymous';
  }

  /**
   * 操作ID生成
   * @returns ユニークな操作ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * キューの状態を取得
   * @returns キューの状態
   */
  getState(): QueueState {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      pendingRequests: this.pendingRequests.size,
      stats: this.getStats()
    };
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.clearQueue();
    this.processing = false;
  }
}