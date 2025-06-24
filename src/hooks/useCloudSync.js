import { useState, useEffect, useCallback, useRef } from 'react';
import { SyncStateManager } from '../utils/SyncStateManager.js';
import { OperationQueue } from '../utils/OperationQueue.js';
import { RealtimeCommunication } from '../utils/RealtimeCommunication.js';
import { ConflictResolver } from '../utils/ConflictResolver.js';

/**
 * CloudSyncService - 統合同期サービス
 * 全同期コンポーネントを統合し、Reactフックとして提供
 */
class CloudSyncService {
  constructor() {
    this.syncStateManager = new SyncStateManager();
    this.operationQueue = null; // APIクライアント設定後に初期化
    this.realtimeCommunication = null;
    this.conflictResolver = new ConflictResolver(this.syncStateManager);
    this.currentMindmapId = null;
    this.apiClient = null;
    this.isInitialized = false;
    
    this.setupEventHandlers();
  }

  /**
   * イベントハンドラーを設定
   */
  setupEventHandlers() {
    // リアルタイム通信からの操作適用
    document.addEventListener('operation_applied', this.handleOperationApplied.bind(this));
    
    // 競合解決完了
    document.addEventListener('conflict_resolved', this.handleConflictResolved.bind(this));
    
    // ローカル操作更新
    document.addEventListener('local_operation_updated', this.handleLocalOperationUpdated.bind(this));
  }

  /**
   * サービス初期化
   * @param {string} mindmapId - マインドマップID
   * @param {Object} config - 設定
   */
  async initialize(mindmapId, config = {}) {
    if (this.isInitialized && this.currentMindmapId === mindmapId) {
      return;
    }

    this.currentMindmapId = mindmapId;
    
    // API クライアント設定
    this.apiClient = new APIClient(config.apiBaseUrl, config.authToken);
    
    // 操作キュー初期化
    this.operationQueue = new OperationQueue(this.syncStateManager, this.apiClient);
    
    // リアルタイム通信初期化
    if (config.websocketUrl && config.authToken) {
      this.realtimeCommunication = new RealtimeCommunication(
        config.websocketUrl,
        config.authToken
      );
      
      try {
        await this.realtimeCommunication.connect(mindmapId);
      } catch (error) {
        console.warn('Real-time communication failed to connect:', error);
        // リアルタイム通信なしでも動作を継続
      }
    }

    // 定期同期設定
    this.setupPeriodicSync();
    
    // 未送信操作の処理
    if (this.operationQueue) {
      await this.operationQueue.processQueue();
    }

    this.isInitialized = true;
  }

  /**
   * 定期同期を設定
   */
  setupPeriodicSync() {
    // 30秒ごとに同期状態をチェック
    this.periodicSyncInterval = setInterval(() => {
      if (this.syncStateManager.state.isOnline && 
          !this.syncStateManager.state.isSyncing &&
          this.operationQueue) {
        this.operationQueue.processQueue();
      }
    }, 30000);
  }

  // ===== 操作API =====

  /**
   * ノード作成
   * @param {Object} nodeData - ノードデータ
   * @returns {Promise} - 操作ID
   */
  async createNode(nodeData) {
    if (!this.operationQueue) {
      throw new Error('CloudSyncService not initialized');
    }

    const operation = {
      operation_type: 'create',
      target_type: 'node',
      target_id: nodeData.id,
      mindmap_id: this.currentMindmapId,
      data: nodeData
    };

    return await this.operationQueue.addOperation(operation);
  }

  /**
   * ノード更新
   * @param {string} nodeId - ノードID
   * @param {Object} updates - 更新データ
   * @returns {Promise} - 操作ID
   */
  async updateNode(nodeId, updates) {
    if (!this.operationQueue) {
      throw new Error('CloudSyncService not initialized');
    }

    const operation = {
      operation_type: 'update',
      target_type: 'node',
      target_id: nodeId,
      mindmap_id: this.currentMindmapId,
      data: updates
    };

    return await this.operationQueue.addOperation(operation);
  }

  /**
   * ノード削除
   * @param {string} nodeId - ノードID
   * @returns {Promise} - 操作ID
   */
  async deleteNode(nodeId) {
    if (!this.operationQueue) {
      throw new Error('CloudSyncService not initialized');
    }

    const operation = {
      operation_type: 'delete',
      target_type: 'node',
      target_id: nodeId,
      mindmap_id: this.currentMindmapId,
      data: {}
    };

    return await this.operationQueue.addOperation(operation);
  }

  /**
   * ノード移動
   * @param {string} nodeId - ノードID
   * @param {Object} newPosition - 新しい位置 {x, y, parent_id}
   * @returns {Promise} - 操作ID
   */
  async moveNode(nodeId, newPosition) {
    if (!this.operationQueue) {
      throw new Error('CloudSyncService not initialized');
    }

    const operation = {
      operation_type: 'move',
      target_type: 'node',
      target_id: nodeId,
      mindmap_id: this.currentMindmapId,
      data: newPosition
    };

    return await this.operationQueue.addOperation(operation);
  }

  // ===== リアルタイム協調編集 =====

  /**
   * カーソル位置更新
   * @param {Object} cursorData - カーソルデータ
   */
  updateCursor(cursorData) {
    if (this.realtimeCommunication) {
      this.realtimeCommunication.sendCursorUpdate(cursorData);
    }
  }

  /**
   * 編集開始通知
   * @param {string} nodeId - ノードID
   */
  startEditing(nodeId) {
    if (this.realtimeCommunication) {
      this.realtimeCommunication.sendEditingStart(nodeId);
    }
    this.syncStateManager.startEditing(nodeId, this.getCurrentUserId());
  }

  /**
   * 編集終了通知
   * @param {string} nodeId - ノードID
   */
  endEditing(nodeId) {
    if (this.realtimeCommunication) {
      this.realtimeCommunication.sendEditingEnd(nodeId);
    }
    this.syncStateManager.endEditing(nodeId, this.getCurrentUserId());
  }

  /**
   * プレゼンス更新
   * @param {Object} presence - プレゼンス情報
   */
  updatePresence(presence) {
    if (this.realtimeCommunication) {
      this.realtimeCommunication.sendPresenceUpdate(presence);
    }
  }

  // ===== 手動同期 =====

  /**
   * 強制同期
   * @returns {Promise} - 同期結果
   */
  async forceSync() {
    if (!this.operationQueue) {
      throw new Error('CloudSyncService not initialized');
    }

    if (this.syncStateManager.state.isOnline) {
      return await this.operationQueue.processQueue();
    } else {
      throw new Error('Cannot sync while offline');
    }
  }

  /**
   * 完全同期（サーバーからの全データ取得）
   * @returns {Promise} - 同期されたデータ
   */
  async fullSync() {
    if (!this.apiClient) {
      throw new Error('CloudSyncService not initialized');
    }

    try {
      const response = await this.apiClient.get(`/api/mindmaps/${this.currentMindmapId}`);
      const serverData = await response.json();

      // ローカルデータとの競合をチェック
      await this.resolveFullSyncConflicts(serverData);

      return serverData;
    } catch (error) {
      this.syncStateManager.addError(error, 'full_sync');
      throw error;
    }
  }

  /**
   * 完全同期時の競合解決
   * @param {Object} serverData - サーバーデータ
   */
  async resolveFullSyncConflicts(serverData) {
    // 実装では詳細な競合解決ロジックを適用
    console.log('Resolving full sync conflicts with server data:', serverData);
    
    // ベクタークロック比較
    if (serverData.vector_clock) {
      const hasConflicts = this.conflictResolver.detectConflict(
        serverData.vector_clock,
        this.syncStateManager.state.vectorClock
      );

      if (hasConflicts) {
        // 競合がある場合は手動解決を要求
        this.syncStateManager.notifyListeners('full_sync_conflict', {
          serverData,
          localData: this.getLocalData()
        });
      }
    }
  }

  // ===== イベントハンドラー =====

  /**
   * 操作適用の処理
   * @param {CustomEvent} event - 操作適用イベント
   */
  handleOperationApplied(event) {
    const operation = event.detail;
    
    // UI更新イベントを発行
    this.syncStateManager.notifyListeners('operation_applied_to_ui', operation);
  }

  /**
   * 競合解決の処理
   * @param {CustomEvent} event - 競合解決イベント
   */
  handleConflictResolved(event) {
    const { operation, resolution } = event.detail;
    
    // 競合解決通知
    this.syncStateManager.notifyListeners('conflict_resolved', {
      operation,
      resolution,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * ローカル操作更新の処理
   * @param {CustomEvent} event - ローカル操作更新イベント
   */
  handleLocalOperationUpdated(event) {
    const { operationId, updatedOperation } = event.detail;
    
    // 必要に応じてUI更新
    this.syncStateManager.notifyListeners('local_operation_updated', {
      operationId,
      updatedOperation
    });
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
   * 統計情報を取得
   * @returns {Object} - 統計情報
   */
  getStats() {
    return {
      syncState: this.syncStateManager.getStats(),
      operationQueue: this.operationQueue?.getStats() || {},
      realtimeCommunication: this.realtimeCommunication?.getPerformanceMetrics() || {},
      conflictResolver: this.conflictResolver.getConflictStats(this.currentMindmapId)
    };
  }

  /**
   * ローカルデータを取得
   * @returns {Object} - ローカルデータ
   */
  getLocalData() {
    // 実装では実際のローカルデータを返す
    return {
      mindmapId: this.currentMindmapId,
      vectorClock: this.syncStateManager.state.vectorClock,
      pendingOperations: this.syncStateManager.state.pendingOperations
    };
  }

  /**
   * 現在のユーザーID取得
   * @returns {string} - ユーザーID
   */
  getCurrentUserId() {
    return localStorage.getItem('user_id') || 'anonymous';
  }

  // ===== 状態監視 =====

  /**
   * 状態変更リスナーを追加
   * @param {Function} listener - リスナー関数
   * @returns {Function} - リスナー削除関数
   */
  onStateChange(listener) {
    return this.syncStateManager.subscribe(listener);
  }

  /**
   * リアルタイムイベントリスナーを追加
   * @param {string} event - イベント名
   * @param {Function} listener - リスナー関数
   * @returns {Function} - リスナー削除関数
   */
  onRealtimeEvent(event, listener) {
    if (this.realtimeCommunication) {
      return this.realtimeCommunication.addEventListener(event, listener);
    }
    return () => {}; // noop
  }

  // ===== クリーンアップ =====

  /**
   * クリーンアップ
   */
  cleanup() {
    if (this.periodicSyncInterval) {
      clearInterval(this.periodicSyncInterval);
      this.periodicSyncInterval = null;
    }

    if (this.realtimeCommunication) {
      this.realtimeCommunication.cleanup();
      this.realtimeCommunication = null;
    }

    if (this.operationQueue) {
      this.operationQueue.cleanup();
      this.operationQueue = null;
    }

    this.syncStateManager.cleanup();
    this.conflictResolver.cleanup();
    
    // イベントリスナー削除
    document.removeEventListener('operation_applied', this.handleOperationApplied);
    document.removeEventListener('conflict_resolved', this.handleConflictResolved);
    document.removeEventListener('local_operation_updated', this.handleLocalOperationUpdated);

    this.isInitialized = false;
  }
}

/**
 * API Client - HTTP API 通信
 */
class APIClient {
  constructor(baseUrl, authToken) {
    this.baseUrl = baseUrl || 'https://mindflow-api-production.shigekazukoya.workers.dev';
    this.authToken = authToken;
  }

  /**
   * GET リクエスト
   * @param {string} path - パス
   * @param {Object} options - オプション
   * @returns {Promise} - Fetchレスポンス
   */
  async get(path, options = {}) {
    return await this.request('GET', path, null, options);
  }

  /**
   * POST リクエスト
   * @param {string} path - パス
   * @param {Object} data - データ
   * @param {Object} options - オプション
   * @returns {Promise} - Fetchレスポンス
   */
  async post(path, data, options = {}) {
    return await this.request('POST', path, data, options);
  }

  /**
   * PUT リクエスト
   * @param {string} path - パス
   * @param {Object} data - データ
   * @param {Object} options - オプション
   * @returns {Promise} - Fetchレスポンス
   */
  async put(path, data, options = {}) {
    return await this.request('PUT', path, data, options);
  }

  /**
   * DELETE リクエスト
   * @param {string} path - パス
   * @param {Object} options - オプション
   * @returns {Promise} - Fetchレスポンス
   */
  async delete(path, options = {}) {
    return await this.request('DELETE', path, null, options);
  }

  /**
   * HTTP リクエスト実行
   * @param {string} method - HTTPメソッド
   * @param {string} path - パス
   * @param {Object} data - データ
   * @param {Object} options - オプション
   * @returns {Promise} - Fetchレスポンス
   */
  async request(method, path, data, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const config = {
      method,
      headers,
      ...options
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }
}

/**
 * useCloudSync - Reactフック
 * @param {string} mindmapId - マインドマップID
 * @param {Object} config - 設定
 * @returns {Object} - 同期API
 */
export function useCloudSync(mindmapId, config = {}) {
  const [syncService] = useState(() => new CloudSyncService());
  const [syncState, setSyncState] = useState(syncService.getSyncState());
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const initializeRef = useRef(false);

  // 初期化
  useEffect(() => {
    if (mindmapId && !initializeRef.current) {
      initializeRef.current = true;
      
      syncService.initialize(mindmapId, config)
        .then(() => {
          setIsInitialized(true);
          setError(null);
        })
        .catch(err => {
          console.error('CloudSync initialization failed:', err);
          setError(err);
          setIsInitialized(false);
        });
    }

    return () => {
      initializeRef.current = false;
    };
  }, [mindmapId, syncService, config]);

  // 状態監視
  useEffect(() => {
    const unsubscribe = syncService.onStateChange(({ data }) => {
      if (data?.newState) {
        setSyncState(data.newState);
      }
    });
    
    return unsubscribe;
  }, [syncService]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      syncService.cleanup();
    };
  }, [syncService]);

  // API関数をメモ化
  const createNode = useCallback((nodeData) => 
    syncService.createNode(nodeData), [syncService]);
  
  const updateNode = useCallback((nodeId, updates) => 
    syncService.updateNode(nodeId, updates), [syncService]);
  
  const deleteNode = useCallback((nodeId) => 
    syncService.deleteNode(nodeId), [syncService]);
  
  const moveNode = useCallback((nodeId, position) => 
    syncService.moveNode(nodeId, position), [syncService]);
  
  const updateCursor = useCallback((cursor) => 
    syncService.updateCursor(cursor), [syncService]);
  
  const startEditing = useCallback((nodeId) => 
    syncService.startEditing(nodeId), [syncService]);
  
  const endEditing = useCallback((nodeId) => 
    syncService.endEditing(nodeId), [syncService]);
  
  const forceSync = useCallback(() => 
    syncService.forceSync(), [syncService]);
  
  const fullSync = useCallback(() => 
    syncService.fullSync(), [syncService]);

  return {
    // 状態
    syncState,
    isInitialized,
    error,
    
    // 操作API
    createNode,
    updateNode,
    deleteNode,
    moveNode,
    
    // リアルタイム協調編集
    updateCursor,
    startEditing,
    endEditing,
    
    // 同期制御
    forceSync,
    fullSync,
    
    // 状態監視
    onStateChange: useCallback((listener) => 
      syncService.onStateChange(listener), [syncService]),
    onRealtimeEvent: useCallback((event, listener) => 
      syncService.onRealtimeEvent(event, listener), [syncService]),
    
    // 統計
    getStats: useCallback(() => 
      syncService.getStats(), [syncService])
  };
}