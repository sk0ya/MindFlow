import { VectorClock, VectorClockData } from './VectorClock';

// ===== Type Definitions =====

/** Connection quality levels */
export type ConnectionQuality = 'unknown' | 'excellent' | 'good' | 'poor' | 'bad';

/** User presence status */
export type PresenceStatus = 'active' | 'idle' | 'away' | 'offline';

/** Operation status */
export type OperationStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Cursor position information */
export interface CursorPosition {
  x: number;
  y: number;
  nodeId?: string;
  timestamp: string;
}

/** User session information */
export interface UserSession {
  id: string;
  name?: string;
  avatar?: string;
  joinedAt: string;
  lastActivity: string;
  [key: string]: unknown;
}

/** User presence information */
export interface UserPresence {
  status: PresenceStatus;
  timestamp: string;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
  [key: string]: unknown;
}

/** Operation data structure */
export interface Operation {
  id: string;
  type: string;
  userId: string;
  timestamp: string;
  data: unknown;
  vectorClock?: VectorClockData;
  queuedAt?: string;
  retryCount?: number;
  status?: OperationStatus;
  completedAt?: string;
  [key: string]: unknown;
}

/** Error record */
export interface ErrorRecord {
  id: string;
  message: string;
  context: string;
  timestamp: string;
  stack?: string;
}

/** Sync state structure */
export interface SyncState {
  // Connection state
  isOnline: boolean;
  isConnected: boolean;
  isSyncing: boolean;
  connectionQuality: ConnectionQuality;
  lastSyncTime: string | null;
  lastPingTime: string | null;
  pingLatency: number | null;
  
  // Operation management
  pendingOperations: Operation[];
  vectorClock: VectorClockData;
  operationHistory: Operation[];
  conflictQueue: Operation[];
  
  // Active users
  activeUsers: Map<string, UserSession>;
  userPresences: Map<string, UserPresence>;
  
  // Edit state
  editingUsers: Map<string, Set<string>>; // nodeId -> Set<userId>
  cursorPositions: Map<string, CursorPosition>; // userId -> CursorPosition
  
  // Error management
  connectionRetryCount: number;
  lastError: ErrorRecord | null;
  errors: ErrorRecord[];
  
  // Performance
  messageCount: number;
  messageRate: number;
  bandwidthUsage: number;
  
  // Settings
  autoSyncInterval: number;
  maxRetryAttempts: number;
  operationHistoryLimit: number;
}

/** Sync state manager event */
export interface SyncStateEvent {
  event: string;
  data?: unknown;
}

/** Sync state listener function */
export type SyncStateListener = (event: SyncStateEvent) => void;

/** State update data */
export interface StateUpdateData {
  oldState: SyncState;
  newState: SyncState;
  updates: Partial<SyncState>;
}

/** Statistics data */
export interface SyncStats {
  activeUserCount: number;
  pendingOperationCount: number;
  operationHistoryCount: number;
  errorCount: number;
  editingNodeCount: number;
  connectionQuality: ConnectionQuality;
  messageRate: number;
  pingLatency: number | null;
}

// ===== Main Class =====

/**
 * SyncStateManager - 同期状態の一元管理
 * ネットワーク状態、ユーザープレゼンス、操作キュー等を管理
 */
export class SyncStateManager {
  public state: SyncState;
  private listeners: Set<SyncStateListener>;
  private vectorClock: VectorClock;
  private performanceTrackingInterval?: number;

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

    this.listeners = new Set<SyncStateListener>();
    this.vectorClock = new VectorClock();
    
    this.setupNetworkListeners();
    this.startPerformanceTracking();
  }

  /**
   * ネットワーク状態の監視を開始
   */
  private setupNetworkListeners(): void {
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
  private startPerformanceTracking(): void {
    this.performanceTrackingInterval = window.setInterval(() => {
      this.calculateMessageRate();
      this.calculateConnectionQuality();
    }, 5000);
  }

  /**
   * 状態更新
   * @param updates - 更新する状態
   */
  updateState(updates: Partial<SyncState>): void {
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
   * @param listener - 状態変更リスナー
   * @returns リスナー解除関数
   */
  subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * リスナーに通知
   * @param event - イベント名
   * @param data - イベントデータ
   */
  private notifyListeners(event: string, data?: unknown): void {
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
   * @param userId - ユーザーID
   */
  incrementVectorClock(userId: string): void {
    this.vectorClock.increment(userId);
    this.updateState({
      vectorClock: this.vectorClock.toJSON()
    });
  }

  /**
   * ベクタークロックを統合
   * @param remoteVectorClock - リモートのベクタークロック
   */
  mergeVectorClock(remoteVectorClock: VectorClockData): void {
    this.vectorClock.update(remoteVectorClock);
    this.updateState({
      vectorClock: this.vectorClock.toJSON()
    });
  }

  // ===== ユーザーセッション管理 =====

  /**
   * ユーザーセッションを追加
   * @param userId - ユーザーID
   * @param sessionInfo - セッション情報
   */
  addUserSession(userId: string, sessionInfo: Partial<UserSession>): void {
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
   * @param userId - ユーザーID
   */
  removeUserSession(userId: string): void {
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
   * @param userId - ユーザーID
   * @param presence - プレゼンス情報
   */
  updateUserPresence(userId: string, presence: Partial<UserPresence>): void {
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
   * @param nodeId - ノードID
   * @param userId - ユーザーID
   */
  startEditing(nodeId: string, userId: string): void {
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
   * @param nodeId - ノードID
   * @param userId - ユーザーID
   */
  endEditing(nodeId: string, userId: string): void {
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
   * @param userId - ユーザーID
   * @param position - カーソル位置 {x, y, nodeId}
   */
  updateCursorPosition(userId: string, position: Omit<CursorPosition, 'timestamp'>): void {
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
   * @param operation - 操作データ
   */
  addPendingOperation(operation: Operation): void {
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
   * @param operationId - 操作ID
   */
  removePendingOperation(operationId: string): void {
    this.state.pendingOperations = this.state.pendingOperations.filter(
      op => op.id !== operationId
    );

    this.updateState({
      pendingOperations: [...this.state.pendingOperations]
    });
  }

  /**
   * 操作を履歴に追加
   * @param operation - 操作データ
   */
  addToOperationHistory(operation: Operation): void {
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
   * @param error - エラー
   * @param context - エラーのコンテキスト
   */
  addError(error: Error | string, context: string = 'unknown'): void {
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
  clearErrors(): void {
    this.updateState({
      errors: [],
      lastError: null
    });
  }

  // ===== パフォーマンス計測 =====

  /**
   * メッセージレートを計算
   */
  private calculateMessageRate(): void {
    const now = Date.now();
    const _oneMinuteAgo = now - 60000; // Reserved for future time-based filtering
    
    // 過去1分間のメッセージ数から計算
    const recentMessageCount = this.state.messageCount; // 簡略化
    const rate = recentMessageCount / 60; // messages per second

    this.updateState({ messageRate: rate });
  }

  /**
   * 接続品質を計算
   */
  private calculateConnectionQuality(): void {
    const latency = this.state.pingLatency;
    const errorCount = this.state.errors.length;
    const isConnected = this.state.isConnected;

    let quality: ConnectionQuality = 'unknown';

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
   * @returns 統計データ
   */
  getStats(): SyncStats {
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
  cleanup(): void {
    this.listeners.clear();
    
    if (this.performanceTrackingInterval) {
      window.clearInterval(this.performanceTrackingInterval);
      this.performanceTrackingInterval = undefined;
    }
    
    // Note: Network listeners are anonymous functions, so they can't be removed directly
    // In a real implementation, we would store references to the listeners
  }
}