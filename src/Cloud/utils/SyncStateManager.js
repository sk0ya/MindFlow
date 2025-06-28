import { VectorClock } from './VectorClock.js';

/**
 * SyncStateManager - 同期状態の一元管理
 * ネットワーク状態、ユーザープレゼンス、操作キュー等を管理
 */
export class SyncStateManager {
  constructor() {
    this.state = {
      // 接続状態
      isOnline: navigator.onLine,
      isConnected: false,
      isSyncing: false,
      connectionQuality: 'unknown', // excellent, good, poor, bad
      lastSyncTime: null,
      lastPingTime: null,
      pingLatency: null,
      
      // 操作管理
      pendingOperations: [],
      vectorClock: {},
      operationHistory: [],
      conflictQueue: [],
      
      // アクティブユーザー
      activeUsers: new Map(),
      userPresences: new Map(),
      
      // 編集状態
      editingUsers: new Map(), // nodeId -> Set<userId>
      cursorPositions: new Map(), // userId -> CursorPosition
      
      // エラー管理
      connectionRetryCount: 0,
      lastError: null,
      errors: [],
      
      // パフォーマンス
      messageCount: 0,
      messageRate: 0,
      bandwidthUsage: 0,
      
      // 設定
      autoSyncInterval: 30000,
      maxRetryAttempts: 5,
      operationHistoryLimit: 100
    };

    this.listeners = new Set();
    this.vectorClock = new VectorClock();
    
    this.setupNetworkListeners();
    this.startPerformanceTracking();
  }

  /**
   * ネットワーク状態の監視を開始
   */
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.updateState({ 
        isOnline: true,
        connectionRetryCount: 0
      });
      this.notifyListeners('network_online');
    });

    window.addEventListener('offline', () => {
      this.updateState({ 
        isOnline: false, 
        isConnected: false,
        connectionQuality: 'bad'
      });
      this.notifyListeners('network_offline');
    });
  }

  /**
   * パフォーマンス追跡を開始
   */
  startPerformanceTracking() {
    setInterval(() => {
      this.calculateMessageRate();
      this.calculateConnectionQuality();
    }, 5000);
  }

  /**
   * 状態更新
   * @param {Object} updates - 更新する状態
   */
  updateState(updates) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    this.notifyListeners('state_changed', {
      oldState,
      newState: this.state,
      updates
    });
  }

  /**
   * リスナー登録
   * @param {Function} listener - 状態変更リスナー
   * @returns {Function} - リスナー解除関数
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * リスナーに通知
   * @param {string} event - イベント名
   * @param {*} data - イベントデータ
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener({ event, data });
      } catch (error) {
        console.error('SyncStateManager listener error:', error);
      }
    });
  }

  // ===== ベクタークロック管理 =====

  /**
   * ベクタークロックを進める
   * @param {string} userId - ユーザーID
   */
  incrementVectorClock(userId) {
    this.vectorClock.increment(userId);
    this.updateState({
      vectorClock: this.vectorClock.toJSON()
    });
  }

  /**
   * ベクタークロックを統合
   * @param {Object} remoteVectorClock - リモートのベクタークロック
   */
  mergeVectorClock(remoteVectorClock) {
    this.vectorClock.update(remoteVectorClock);
    this.updateState({
      vectorClock: this.vectorClock.toJSON()
    });
  }

  // ===== ユーザーセッション管理 =====

  /**
   * ユーザーセッションを追加
   * @param {string} userId - ユーザーID
   * @param {Object} sessionInfo - セッション情報
   */
  addUserSession(userId, sessionInfo) {
    this.state.activeUsers.set(userId, {
      ...sessionInfo,
      joinedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    });

    this.updateState({
      activeUsers: new Map(this.state.activeUsers)
    });

    this.notifyListeners('user_joined', { userId, sessionInfo });
  }

  /**
   * ユーザーセッションを削除
   * @param {string} userId - ユーザーID
   */
  removeUserSession(userId) {
    this.state.activeUsers.delete(userId);
    this.state.userPresences.delete(userId);
    this.state.cursorPositions.delete(userId);

    // 編集中のノードからユーザーを削除
    for (const [nodeId, editingUsers] of this.state.editingUsers) {
      editingUsers.delete(userId);
      if (editingUsers.size === 0) {
        this.state.editingUsers.delete(nodeId);
      }
    }

    this.updateState({
      activeUsers: new Map(this.state.activeUsers),
      userPresences: new Map(this.state.userPresences),
      cursorPositions: new Map(this.state.cursorPositions),
      editingUsers: new Map(this.state.editingUsers)
    });

    this.notifyListeners('user_left', { userId });
  }

  /**
   * ユーザープレゼンス更新
   * @param {string} userId - ユーザーID
   * @param {Object} presence - プレゼンス情報
   */
  updateUserPresence(userId, presence) {
    this.state.userPresences.set(userId, {
      ...presence,
      timestamp: new Date().toISOString()
    });

    // ユーザーの最終活動時刻を更新
    const user = this.state.activeUsers.get(userId);
    if (user) {
      user.lastActivity = new Date().toISOString();
    }

    this.updateState({
      userPresences: new Map(this.state.userPresences),
      activeUsers: new Map(this.state.activeUsers)
    });
  }

  // ===== 編集状態管理 =====

  /**
   * ノード編集開始
   * @param {string} nodeId - ノードID
   * @param {string} userId - ユーザーID
   */
  startEditing(nodeId, userId) {
    if (!this.state.editingUsers.has(nodeId)) {
      this.state.editingUsers.set(nodeId, new Set());
    }
    this.state.editingUsers.get(nodeId).add(userId);

    this.updateState({
      editingUsers: new Map(this.state.editingUsers)
    });

    this.notifyListeners('editing_started', { nodeId, userId });
  }

  /**
   * ノード編集終了
   * @param {string} nodeId - ノードID
   * @param {string} userId - ユーザーID
   */
  endEditing(nodeId, userId) {
    const editingUsers = this.state.editingUsers.get(nodeId);
    if (editingUsers) {
      editingUsers.delete(userId);
      if (editingUsers.size === 0) {
        this.state.editingUsers.delete(nodeId);
      }
    }

    this.updateState({
      editingUsers: new Map(this.state.editingUsers)
    });

    this.notifyListeners('editing_ended', { nodeId, userId });
  }

  /**
   * カーソル位置更新
   * @param {string} userId - ユーザーID
   * @param {Object} position - カーソル位置 {x, y, nodeId}
   */
  updateCursorPosition(userId, position) {
    this.state.cursorPositions.set(userId, {
      ...position,
      timestamp: new Date().toISOString()
    });

    this.updateState({
      cursorPositions: new Map(this.state.cursorPositions)
    });
  }

  // ===== 操作管理 =====

  /**
   * 操作をキューに追加
   * @param {Object} operation - 操作データ
   */
  addPendingOperation(operation) {
    this.state.pendingOperations.push({
      ...operation,
      queuedAt: new Date().toISOString(),
      retryCount: 0
    });

    this.updateState({
      pendingOperations: [...this.state.pendingOperations]
    });
  }

  /**
   * 操作をキューから削除
   * @param {string} operationId - 操作ID
   */
  removePendingOperation(operationId) {
    this.state.pendingOperations = this.state.pendingOperations.filter(
      op => op.id !== operationId
    );

    this.updateState({
      pendingOperations: [...this.state.pendingOperations]
    });
  }

  /**
   * 操作を履歴に追加
   * @param {Object} operation - 操作データ
   */
  addToOperationHistory(operation) {
    this.state.operationHistory.push({
      ...operation,
      processedAt: new Date().toISOString()
    });

    // 履歴サイズ制限
    if (this.state.operationHistory.length > this.state.operationHistoryLimit) {
      this.state.operationHistory.shift();
    }

    this.updateState({
      operationHistory: [...this.state.operationHistory]
    });
  }

  // ===== エラー管理 =====

  /**
   * エラーを記録
   * @param {Error|string} error - エラー
   * @param {string} context - エラーのコンテキスト
   */
  addError(error, context = 'unknown') {
    const errorRecord = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: error instanceof Error ? error.message : error,
      context,
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : null
    };

    this.state.errors.push(errorRecord);
    
    // エラー履歴は最新50件まで
    if (this.state.errors.length > 50) {
      this.state.errors.shift();
    }

    this.updateState({
      lastError: errorRecord,
      errors: [...this.state.errors]
    });

    this.notifyListeners('error_occurred', errorRecord);
  }

  /**
   * エラーをクリア
   */
  clearErrors() {
    this.updateState({
      errors: [],
      lastError: null
    });
  }

  // ===== パフォーマンス計測 =====

  /**
   * メッセージレートを計算
   */
  calculateMessageRate() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // 過去1分間のメッセージ数から計算
    const recentMessageCount = this.state.messageCount; // 簡略化
    const rate = recentMessageCount / 60; // messages per second

    this.updateState({ messageRate: rate });
  }

  /**
   * 接続品質を計算
   */
  calculateConnectionQuality() {
    const latency = this.state.pingLatency;
    const errorCount = this.state.errors.length;
    const isConnected = this.state.isConnected;

    let quality = 'unknown';

    if (!isConnected) {
      quality = 'bad';
    } else if (latency !== null) {
      if (latency < 50 && errorCount < 5) {
        quality = 'excellent';
      } else if (latency < 100 && errorCount < 10) {
        quality = 'good';
      } else if (latency < 300 && errorCount < 20) {
        quality = 'poor';
      } else {
        quality = 'bad';
      }
    }

    if (this.state.connectionQuality !== quality) {
      this.updateState({ connectionQuality: quality });
      this.notifyListeners('connection_quality_changed', quality);
    }
  }

  /**
   * 統計情報を取得
   * @returns {Object} - 統計データ
   */
  getStats() {
    return {
      activeUserCount: this.state.activeUsers.size,
      pendingOperationCount: this.state.pendingOperations.length,
      operationHistoryCount: this.state.operationHistory.length,
      errorCount: this.state.errors.length,
      editingNodeCount: this.state.editingUsers.size,
      connectionQuality: this.state.connectionQuality,
      messageRate: this.state.messageRate,
      pingLatency: this.state.pingLatency
    };
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    this.listeners.clear();
    window.removeEventListener('online', this.setupNetworkListeners);
    window.removeEventListener('offline', this.setupNetworkListeners);
  }
}