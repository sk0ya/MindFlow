import { VectorClock } from './VectorClock.js';

/**
 * OperationQueue - 操作キューイングとバッチ処理
 * オフライン時の操作蓄積と、オンライン復帰時の同期処理を管理
 */
export class OperationQueue {
  constructor(syncStateManager, apiClient) {
    this.syncStateManager = syncStateManager;
    this.apiClient = apiClient;
    this.queue = [];
    this.processing = false;
    this.pendingRequests = new Map(); // operationId -> Promise
    this.batchSize = 10;
    this.batchTimeout = 1000; // 1秒
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1秒

    this.setupEventListeners();
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners() {
    // ネットワーク復帰時に自動処理開始
    this.syncStateManager.subscribe(({ event, data }) => {
      if (event === 'network_online' || event === 'state_changed') {
        if (data?.newState?.isConnected && this.queue.length > 0) {
          this.processQueue();
        }
      }
    });
  }

  /**
   * 操作をキューに追加
   * @param {Object} operation - 操作データ
   * @returns {Promise} - 操作完了Promise
   */
  async addOperation(operation) {
    const userId = this.getCurrentUserId();
    
    // ベクタークロックを更新
    this.syncStateManager.incrementVectorClock(userId);
    const vectorClock = this.syncStateManager.state.vectorClock;

    const enhancedOperation = {
      ...operation,
      id: this.generateOperationId(),
      userId,
      timestamp: new Date().toISOString(),
      vector_clock: vectorClock,
      status: 'pending',
      retryCount: 0,
      queuedAt: new Date().toISOString()
    };

    // キューに追加
    this.queue.push(enhancedOperation);
    this.syncStateManager.addPendingOperation(enhancedOperation);

    // Promise作成（外部から完了を待機できるように）
    const promise = new Promise((resolve, reject) => {
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
  async processQueue() {
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
   * @param {Array} batch - 操作のバッチ
   */
  async processBatch(batch) {
    const promises = batch.map(operation => this.processOperation(operation));
    
    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Batch processing error:', error);
    }
  }

  /**
   * 単一操作を処理
   * @param {Object} operation - 操作データ
   */
  async processOperation(operation) {
    try {
      operation.status = 'processing';
      
      const result = await this.sendOperation(operation);
      
      // 成功時の処理
      operation.status = 'completed';
      operation.completedAt = new Date().toISOString();
      
      // ベクタークロック更新
      if (result.vector_clock) {
        this.syncStateManager.mergeVectorClock(result.vector_clock);
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
   * @param {Object} operation - 操作データ
   * @returns {Promise} - API応答
   */
  async sendOperation(operation) {
    const response = await this.apiClient.post('/api/sync/operation', operation);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Sync operation failed');
    }

    return await response.json();
  }

  /**
   * 操作エラーハンドリング
   * @param {Object} operation - 操作データ
   * @param {Error} error - エラー
   */
  async handleOperationError(operation, error) {
    operation.retryCount++;
    operation.lastError = error.message;
    operation.status = 'failed';

    console.error(`Operation ${operation.id} failed (attempt ${operation.retryCount}):`, error);

    if (operation.retryCount < this.maxRetries) {
      // リトライ
      operation.status = 'pending';
      
      // 指数バックオフで遅延
      const delay = this.retryDelay * Math.pow(2, operation.retryCount - 1);
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
   * @param {string} operationId - 操作ID
   */
  cancelOperation(operationId) {
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
  clearQueue() {
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
   * @param {string} operationId - 操作ID
   * @param {number} priority - 優先度（数値が小さいほど高優先度）
   */
  setPriority(operationId, priority) {
    const operation = this.queue.find(op => op.id === operationId);
    if (operation) {
      operation.priority = priority;
      
      // 優先度でソート
      this.queue.sort((a, b) => (a.priority || 0) - (b.priority || 0));
    }
  }

  /**
   * 操作タイプ別の統計を取得
   * @returns {Object} - 統計データ
   */
  getStats() {
    const stats = {
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
      stats.byType[operation.operation_type] = 
        (stats.byType[operation.operation_type] || 0) + 1;

      // ステータス別カウント
      stats.byStatus[operation.status] = 
        (stats.byStatus[operation.status] || 0) + 1;

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
   * ユーザーID取得
   * @returns {string} - 現在のユーザーID
   */
  getCurrentUserId() {
    return localStorage.getItem('user_id') || 'anonymous';
  }

  /**
   * 操作ID生成
   * @returns {string} - ユニークな操作ID
   */
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * キューの状態を取得
   * @returns {Object} - キューの状態
   */
  getState() {
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
  cleanup() {
    this.clearQueue();
    this.processing = false;
  }
}