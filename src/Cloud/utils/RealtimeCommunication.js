import { SyncStateManager } from './SyncStateManager.js';
import { MessageManager } from './MessageManager.js';
import { ConflictResolver } from './ConflictResolver.js';

/**
 * WebSocketイベント定義
 */
export const WebSocketEvents = {
  // 接続管理
  CONNECTION: {
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    HEARTBEAT: 'heartbeat',
    RECONNECT: 'reconnect'
  },

  // データ同期
  SYNC: {
    OPERATION: 'sync_operation',
    OPERATION_ACK: 'sync_operation_ack',
    OPERATION_CONFLICT: 'sync_operation_conflict',
    FULL_SYNC: 'sync_full_sync',
    SYNC_STATE: 'sync_state'
  },

  // 協調編集
  COLLABORATION: {
    CURSOR_UPDATE: 'cursor_update',
    SELECTION_UPDATE: 'selection_update',
    EDITING_START: 'editing_start',
    EDITING_END: 'editing_end',
    USER_JOIN: 'user_join',
    USER_LEAVE: 'user_leave',
    PRESENCE_UPDATE: 'presence_update'
  },

  // システム
  SYSTEM: {
    ERROR: 'system_error',
    WARNING: 'system_warning',
    INFO: 'system_info',
    RATE_LIMIT: 'rate_limit'
  }
};

/**
 * RealtimeCommunication - リアルタイム通信管理
 * WebSocket接続、メッセージ処理、自動再接続を担当
 */
export class RealtimeCommunication {
  constructor(websocketUrl, authToken) {
    this.websocketUrl = websocketUrl;
    this.authToken = authToken;
    this.websocket = null;
    this.messageManager = null;
    this.syncStateManager = new SyncStateManager();
    this.conflictResolver = new ConflictResolver(this.syncStateManager);
    
    this.currentMindmapId = null;
    this.isIntentionalClose = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.heartbeatInterval = null;
    this.connectionTimeout = null;
    
    this.eventListeners = new Map();
    this.performanceMetrics = {
      connectionTime: null,
      messagesPerSecond: 0,
      averageLatency: 0,
      errorRate: 0,
      lastErrorTime: null
    };

    this.setupEventHandlers();
  }

  /**
   * イベントハンドラーを設定
   */
  setupEventHandlers() {
    // 同期操作の受信処理
    document.addEventListener('sync_operation_received', this.handleRemoteOperation.bind(this));
    
    // ローカル操作の更新処理
    document.addEventListener('local_operation_update', this.handleLocalOperationUpdate.bind(this));
    
    // 解決済み操作の適用
    document.addEventListener('apply_resolved_operation', this.handleResolvedOperation.bind(this));
  }

  /**
   * WebSocket接続開始
   * @param {string} mindmapId - マインドマップID
   * @returns {Promise} - 接続Promise
   */
  async connect(mindmapId) {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      // 既に接続済みの場合は一度切断
      await this.disconnect();
    }

    this.currentMindmapId = mindmapId;
    this.isIntentionalClose = false;
    
    const connectionStartTime = Date.now();

    try {
      const url = `${this.websocketUrl}?mindmapId=${mindmapId}&token=${this.authToken}`;
      this.websocket = new WebSocket(url);
      this.messageManager = new MessageManager(this.websocket, this.syncStateManager);

      this.setupWebSocketHandlers();
      
      return new Promise((resolve, reject) => {
        this.connectionTimeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.websocket.onopen = () => {
          clearTimeout(this.connectionTimeout);
          this.performanceMetrics.connectionTime = Date.now() - connectionStartTime;
          this.onConnected();
          resolve();
        };

        this.websocket.onerror = (error) => {
          clearTimeout(this.connectionTimeout);
          this.updateErrorMetrics();
          reject(error);
        };
      });
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.updateErrorMetrics();
      throw error;
    }
  }

  /**
   * WebSocketイベントハンドラーを設定
   */
  setupWebSocketHandlers() {
    this.websocket.onopen = () => this.onConnected();
    this.websocket.onclose = (event) => this.onDisconnected(event);
    this.websocket.onerror = (error) => this.onError(error);
    this.websocket.onmessage = (event) => {
      if (this.messageManager) {
        this.messageManager.handleMessage(event.data);
      }
    };
  }

  /**
   * 接続成功時の処理
   */
  onConnected() {
    console.log('WebSocket connected');
    this.reconnectAttempts = 0;
    this.syncStateManager.updateState({
      isConnected: true,
      connectionQuality: 'good',
      lastError: null
    });

    this.startHeartbeat();
    this.notifyEventListeners('connected', {
      mindmapId: this.currentMindmapId,
      connectionTime: this.performanceMetrics.connectionTime
    });

    // 初期プレゼンス情報を送信
    this.sendPresenceUpdate();
  }

  /**
   * 切断時の処理
   * @param {CloseEvent} event - 切断イベント
   */
  onDisconnected(event) {
    console.log('WebSocket disconnected:', event.code, event.reason);
    this.syncStateManager.updateState({
      isConnected: false,
      connectionQuality: 'bad'
    });

    this.stopHeartbeat();
    this.notifyEventListeners('disconnected', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    });

    // 意図的な切断でない場合は再接続を試行
    if (!this.isIntentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  /**
   * エラー時の処理
   * @param {Event} error - エラーイベント
   */
  onError(error) {
    console.error('WebSocket error:', error);
    this.updateErrorMetrics();
    this.syncStateManager.addError(error, 'websocket_error');
    this.notifyEventListeners('error', error);
  }

  /**
   * ハートビート開始
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      if (this.websocket?.readyState === WebSocket.OPEN && this.messageManager) {
        try {
          const startTime = Date.now();
          await this.messageManager.sendMessage('ping', {}, { 
            requiresAck: true, 
            timeout: 3000,
            priority: 'high'
          });
          
          const latency = Date.now() - startTime;
          this.updateLatencyMetrics(latency);
          
        } catch (error) {
          console.warn('Heartbeat failed:', error);
          this.updateErrorMetrics();
        }
      }
    }, 30000);
  }

  /**
   * ハートビート停止
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * 再接続のスケジューリング
   */
  scheduleReconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(async () => {
      if (!this.syncStateManager.state.isConnected && 
          this.reconnectAttempts <= this.maxReconnectAttempts &&
          !this.isIntentionalClose) {
        
        try {
          await this.connect(this.currentMindmapId);
          this.notifyEventListeners('reconnected', {
            attempts: this.reconnectAttempts
          });
        } catch (error) {
          console.error(`Reconnect attempt ${this.reconnectAttempts} failed:`, error);
          
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.notifyEventListeners('reconnect_failed', {
              attempts: this.reconnectAttempts,
              error: error.message
            });
          }
        }
      }
    }, delay);
  }

  // ===== リモート操作ハンドラー =====

  /**
   * リモート操作の処理
   * @param {CustomEvent} event - リモート操作イベント
   */
  async handleRemoteOperation(event) {
    const operation = event.detail;
    
    try {
      // 競合検出
      const hasConflict = this.conflictResolver.detectConflict(
        operation.vector_clock,
        this.syncStateManager.state.vectorClock
      );

      if (hasConflict) {
        // 競合解決処理
        const resolution = await this.conflictResolver.resolveConflict(operation);
        
        if (resolution.shouldApply) {
          await this.applyOperation(resolution.resolvedOperation);
        }

        // 競合情報を通知
        this.notifyEventListeners('conflict_resolved', {
          operation,
          resolution,
          conflictInfo: resolution.conflictInfo
        });
        
      } else {
        // 競合なしの場合は直接適用
        await this.applyOperation(operation);
      }

      // ベクタークロックを更新
      this.syncStateManager.mergeVectorClock(operation.vector_clock);

    } catch (error) {
      console.error('Remote operation handling failed:', error);
      this.syncStateManager.addError(error, 'remote_operation_handling');
    }
  }

  /**
   * ローカル操作更新の処理
   * @param {CustomEvent} event - ローカル操作更新イベント
   */
  handleLocalOperationUpdate(event) {
    const { operationId, updatedOperation } = event.detail;
    
    // UI更新イベントを発行
    this.notifyEventListeners('local_operation_updated', {
      operationId,
      updatedOperation
    });
  }

  /**
   * 解決済み操作の処理
   * @param {CustomEvent} event - 解決済み操作イベント
   */
  async handleResolvedOperation(event) {
    const operation = event.detail;
    await this.applyOperation(operation);
  }

  /**
   * 操作を適用
   * @param {Object} operation - 操作
   */
  async applyOperation(operation) {
    // UIに操作適用を通知
    this.notifyEventListeners('operation_applied', operation);
  }

  // ===== パブリックAPI =====

  /**
   * 同期操作を送信
   * @param {Object} operation - 操作データ
   * @returns {Promise} - 送信結果
   */
  async sendSyncOperation(operation) {
    if (!this.messageManager) {
      throw new Error('Not connected');
    }

    return await this.messageManager.sendMessage(
      WebSocketEvents.SYNC.OPERATION,
      operation,
      { requiresAck: true, priority: 'high' }
    );
  }

  /**
   * カーソル位置を送信
   * @param {Object} position - カーソル位置 {x, y, nodeId}
   * @returns {Promise} - 送信結果
   */
  async sendCursorUpdate(position) {
    if (!this.messageManager) return;

    return await this.messageManager.sendMessage(
      WebSocketEvents.COLLABORATION.CURSOR_UPDATE,
      { position },
      { queueOnFailure: false }
    );
  }

  /**
   * 編集開始を送信
   * @param {string} nodeId - ノードID
   * @returns {Promise} - 送信結果
   */
  async sendEditingStart(nodeId) {
    if (!this.messageManager) return;

    return await this.messageManager.sendMessage(
      WebSocketEvents.COLLABORATION.EDITING_START,
      { nodeId }
    );
  }

  /**
   * 編集終了を送信
   * @param {string} nodeId - ノードID
   * @returns {Promise} - 送信結果
   */
  async sendEditingEnd(nodeId) {
    if (!this.messageManager) return;

    return await this.messageManager.sendMessage(
      WebSocketEvents.COLLABORATION.EDITING_END,
      { nodeId }
    );
  }

  /**
   * プレゼンス情報を送信
   * @param {Object} presence - プレゼンス情報
   * @returns {Promise} - 送信結果
   */
  async sendPresenceUpdate(presence = {}) {
    if (!this.messageManager) return;

    const defaultPresence = {
      status: 'active',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };

    return await this.messageManager.sendMessage(
      WebSocketEvents.COLLABORATION.PRESENCE_UPDATE,
      { presence: { ...defaultPresence, ...presence } }
    );
  }

  // ===== イベントリスナー管理 =====

  /**
   * イベントリスナーを追加
   * @param {string} event - イベント名
   * @param {Function} listener - リスナー関数
   * @returns {Function} - リスナー削除関数
   */
  addEventListener(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(listener);

    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }

  /**
   * イベントリスナーに通知
   * @param {string} event - イベント名
   * @param {*} data - イベントデータ
   */
  notifyEventListeners(event, data) {
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

  // ===== 状態取得 =====

  /**
   * 同期状態を取得
   * @returns {Object} - 同期状態
   */
  getSyncState() {
    return this.syncStateManager.state;
  }

  /**
   * パフォーマンスメトリクスを取得
   * @returns {Object} - パフォーマンスメトリクス
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      syncState: this.syncStateManager.getStats(),
      messageManager: this.messageManager?.getStats() || {},
      conflictResolver: this.conflictResolver.getConflictStats(this.currentMindmapId)
    };
  }

  /**
   * 接続状態を取得
   * @returns {Object} - 接続状態
   */
  getConnectionState() {
    return {
      isConnected: this.syncStateManager.state.isConnected,
      connectionQuality: this.syncStateManager.state.connectionQuality,
      reconnectAttempts: this.reconnectAttempts,
      lastPingTime: this.syncStateManager.state.lastPingTime,
      pingLatency: this.syncStateManager.state.pingLatency
    };
  }

  // ===== メトリクス更新 =====

  /**
   * レイテンシメトリクスを更新
   * @param {number} latency - レイテンシ
   */
  updateLatencyMetrics(latency) {
    this.performanceMetrics.averageLatency = 
      (this.performanceMetrics.averageLatency * 0.9) + (latency * 0.1);
  }

  /**
   * エラーメトリクスを更新
   */
  updateErrorMetrics() {
    this.performanceMetrics.lastErrorTime = Date.now();
    this.performanceMetrics.errorRate = 
      (this.performanceMetrics.errorRate * 0.95) + 0.05;
  }

  // ===== クリーンアップ =====

  /**
   * 切断
   */
  async disconnect() {
    this.isIntentionalClose = true;
    this.stopHeartbeat();
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    if (this.messageManager) {
      this.messageManager.cleanup();
      this.messageManager = null;
    }
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    this.syncStateManager.updateState({
      isConnected: false,
      connectionQuality: 'unknown'
    });

    this.notifyEventListeners('disconnected', { intentional: true });
  }

  /**
   * 完全なクリーンアップ
   */
  cleanup() {
    this.disconnect();
    this.syncStateManager.cleanup();
    this.conflictResolver.cleanup();
    this.eventListeners.clear();

    // イベントリスナーを削除
    document.removeEventListener('sync_operation_received', this.handleRemoteOperation);
    document.removeEventListener('local_operation_update', this.handleLocalOperationUpdate);
    document.removeEventListener('apply_resolved_operation', this.handleResolvedOperation);
  }
}