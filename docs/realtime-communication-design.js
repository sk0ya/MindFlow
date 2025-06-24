// MindFlow Real-time Communication Design
// WebSocketベースのリアルタイム協調編集システム

// ===== WebSocketイベント定義 =====
const WebSocketEvents = {
  // 接続管理
  CONNECTION: {
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    HEARTBEAT: 'heartbeat',
    RECONNECT: 'reconnect'
  },

  // データ同期
  SYNC: {
    OPERATION: 'sync:operation',
    OPERATION_ACK: 'sync:operation_ack',
    OPERATION_CONFLICT: 'sync:operation_conflict',
    FULL_SYNC: 'sync:full_sync',
    SYNC_STATE: 'sync:state'
  },

  // 協調編集
  COLLABORATION: {
    CURSOR_UPDATE: 'collab:cursor_update',
    SELECTION_UPDATE: 'collab:selection_update',
    EDITING_START: 'collab:editing_start',
    EDITING_END: 'collab:editing_end',
    USER_JOIN: 'collab:user_join',
    USER_LEAVE: 'collab:user_leave',
    PRESENCE_UPDATE: 'collab:presence_update'
  },

  // システム
  SYSTEM: {
    ERROR: 'system:error',
    WARNING: 'system:warning',
    INFO: 'system:info',
    RATE_LIMIT: 'system:rate_limit'
  }
};

// ===== リアルタイム状態管理 =====
class RealtimeStateManager {
  constructor() {
    this.state = {
      // 接続状態
      isConnected: false,
      connectionQuality: 'unknown', // excellent, good, poor, bad
      lastPingTime: null,
      pingLatency: null,
      
      // アクティブユーザー
      activeUsers: new Map(), // userId -> UserSession
      userPresences: new Map(), // userId -> PresenceInfo
      
      // 編集状態
      editingUsers: new Map(), // nodeId -> Set<userId>
      cursorPositions: new Map(), // userId -> CursorPosition
      
      // 同期状態
      operationQueue: [],
      lastSyncTimestamp: null,
      conflictCount: 0,
      
      // パフォーマンス
      messageCount: 0,
      messageRate: 0,
      bandwidthUsage: 0
    };

    this.listeners = new Set();
    this.messageBuffer = [];
    this.performanceTracker = new PerformanceTracker();
  }

  updateState(updates) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    this.notifyListeners({
      oldState,
      newState: this.state,
      updates
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(change) {
    this.listeners.forEach(listener => {
      try {
        listener(change);
      } catch (error) {
        console.error('Realtime listener error:', error);
      }
    });
  }

  // ユーザーセッション管理
  addUserSession(userId, sessionInfo) {
    this.state.activeUsers.set(userId, {
      ...sessionInfo,
      joinedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    });

    this.updateState({
      activeUsers: new Map(this.state.activeUsers)
    });
  }

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
  }

  // プレゼンス管理
  updateUserPresence(userId, presence) {
    this.state.userPresences.set(userId, {
      ...presence,
      timestamp: new Date().toISOString()
    });

    this.updateState({
      userPresences: new Map(this.state.userPresences)
    });
  }

  // カーソル位置管理
  updateCursorPosition(userId, position) {
    this.state.cursorPositions.set(userId, {
      ...position,
      timestamp: new Date().toISOString()
    });

    this.updateState({
      cursorPositions: new Map(this.state.cursorPositions)
    });
  }

  // 編集状態管理
  startEditing(nodeId, userId) {
    if (!this.state.editingUsers.has(nodeId)) {
      this.state.editingUsers.set(nodeId, new Set());
    }
    this.state.editingUsers.get(nodeId).add(userId);

    this.updateState({
      editingUsers: new Map(this.state.editingUsers)
    });
  }

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
  }
}

// ===== パフォーマンス追跡 =====
class PerformanceTracker {
  constructor() {
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      totalLatency: 0,
      latencyCount: 0,
      bandwidthUsed: 0,
      errorCount: 0,
      reconnectCount: 0
    };

    this.latencyHistory = [];
    this.bandwidthHistory = [];
    this.startTime = Date.now();
  }

  recordMessageSent(size) {
    this.metrics.messagesSent++;
    this.metrics.bandwidthUsed += size;
    this.bandwidthHistory.push({
      timestamp: Date.now(),
      bytes: size,
      direction: 'out'
    });
  }

  recordMessageReceived(size) {
    this.metrics.messagesReceived++;
    this.metrics.bandwidthUsed += size;
    this.bandwidthHistory.push({
      timestamp: Date.now(),
      bytes: size,
      direction: 'in'
    });
  }

  recordLatency(latency) {
    this.metrics.totalLatency += latency;
    this.metrics.latencyCount++;
    this.latencyHistory.push({
      timestamp: Date.now(),
      latency
    });

    // 履歴の制限（最新100件）
    if (this.latencyHistory.length > 100) {
      this.latencyHistory.shift();
    }
  }

  recordError() {
    this.metrics.errorCount++;
  }

  recordReconnect() {
    this.metrics.reconnectCount++;
  }

  getAverageLatency() {
    return this.metrics.latencyCount > 0 
      ? this.metrics.totalLatency / this.metrics.latencyCount 
      : 0;
  }

  getCurrentBandwidthUsage() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentMessages = this.bandwidthHistory.filter(
      entry => entry.timestamp > oneMinuteAgo
    );

    return recentMessages.reduce((total, entry) => total + entry.bytes, 0);
  }

  getConnectionQuality() {
    const avgLatency = this.getAverageLatency();
    const errorRate = this.metrics.errorCount / Math.max(this.metrics.messagesReceived, 1);

    if (avgLatency < 50 && errorRate < 0.01) return 'excellent';
    if (avgLatency < 100 && errorRate < 0.05) return 'good';
    if (avgLatency < 300 && errorRate < 0.1) return 'poor';
    return 'bad';
  }

  getMetrics() {
    return {
      ...this.metrics,
      averageLatency: this.getAverageLatency(),
      currentBandwidth: this.getCurrentBandwidthUsage(),
      connectionQuality: this.getConnectionQuality(),
      uptime: Date.now() - this.startTime
    };
  }
}

// ===== メッセージ管理 =====
class MessageManager {
  constructor(websocket, stateManager) {
    this.websocket = websocket;
    this.stateManager = stateManager;
    this.messageQueue = [];
    this.pendingMessages = new Map(); // messageId -> { resolve, reject, timeout }
    this.rateLimiter = new RateLimiter();
    this.sequenceNumber = 0;
  }

  // メッセージ送信
  async sendMessage(type, data, options = {}) {
    const message = {
      id: this.generateMessageId(),
      type,
      data,
      timestamp: new Date().toISOString(),
      sequence: ++this.sequenceNumber,
      requiresAck: options.requiresAck || false
    };

    // レート制限チェック
    if (!this.rateLimiter.allowMessage(type)) {
      throw new Error('Rate limit exceeded');
    }

    try {
      await this.sendMessageInternal(message);
      
      if (message.requiresAck) {
        return await this.waitForAck(message.id, options.timeout || 5000);
      }
      
      return { success: true, messageId: message.id };
    } catch (error) {
      console.error('Message send failed:', error);
      throw error;
    }
  }

  async sendMessageInternal(message) {
    if (this.websocket.readyState !== WebSocket.OPEN) {
      // オフラインキューに追加
      this.messageQueue.push(message);
      throw new Error('WebSocket not connected');
    }

    const messageStr = JSON.stringify(message);
    this.websocket.send(messageStr);
    
    this.stateManager.performanceTracker.recordMessageSent(messageStr.length);
  }

  async waitForAck(messageId, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error('Message acknowledgment timeout'));
      }, timeout);

      this.pendingMessages.set(messageId, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
    });
  }

  // メッセージ受信処理
  handleMessage(messageStr) {
    try {
      const message = JSON.parse(messageStr);
      this.stateManager.performanceTracker.recordMessageReceived(messageStr.length);

      // ACK処理
      if (message.type === 'ack') {
        this.handleAck(message);
        return;
      }

      // イベント別処理
      switch (message.type) {
        case WebSocketEvents.COLLABORATION.USER_JOIN:
          this.handleUserJoin(message.data);
          break;
        case WebSocketEvents.COLLABORATION.USER_LEAVE:
          this.handleUserLeave(message.data);
          break;
        case WebSocketEvents.COLLABORATION.CURSOR_UPDATE:
          this.handleCursorUpdate(message.data);
          break;
        case WebSocketEvents.COLLABORATION.EDITING_START:
          this.handleEditingStart(message.data);
          break;
        case WebSocketEvents.COLLABORATION.EDITING_END:
          this.handleEditingEnd(message.data);
          break;
        case WebSocketEvents.SYNC.OPERATION:
          this.handleSyncOperation(message.data);
          break;
        case WebSocketEvents.SYSTEM.ERROR:
          this.handleSystemError(message.data);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }

      // カスタムイベント発行
      document.dispatchEvent(new CustomEvent('websocket_message', {
        detail: message
      }));

    } catch (error) {
      console.error('Message handling error:', error);
      this.stateManager.performanceTracker.recordError();
    }
  }

  handleAck(message) {
    const pending = this.pendingMessages.get(message.data.messageId);
    if (pending) {
      if (message.data.success) {
        pending.resolve(message.data);
      } else {
        pending.reject(new Error(message.data.error));
      }
      this.pendingMessages.delete(message.data.messageId);
    }
  }

  handleUserJoin(data) {
    this.stateManager.addUserSession(data.userId, data.userInfo);
  }

  handleUserLeave(data) {
    this.stateManager.removeUserSession(data.userId);
  }

  handleCursorUpdate(data) {
    this.stateManager.updateCursorPosition(data.userId, data.position);
  }

  handleEditingStart(data) {
    this.stateManager.startEditing(data.nodeId, data.userId);
  }

  handleEditingEnd(data) {
    this.stateManager.endEditing(data.nodeId, data.userId);
  }

  handleSyncOperation(data) {
    // 同期操作の処理
    document.dispatchEvent(new CustomEvent('sync_operation_received', {
      detail: data
    }));
  }

  handleSystemError(data) {
    console.error('System error:', data);
    this.stateManager.performanceTracker.recordError();
  }

  // キューされたメッセージの送信
  async processMessageQueue() {
    while (this.messageQueue.length > 0 && this.websocket.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      try {
        await this.sendMessageInternal(message);
      } catch (error) {
        console.error('Queued message send failed:', error);
        // 再度キューに戻す
        this.messageQueue.unshift(message);
        break;
      }
    }
  }

  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ===== レート制限 =====
class RateLimiter {
  constructor() {
    this.limits = {
      [WebSocketEvents.COLLABORATION.CURSOR_UPDATE]: { count: 10, window: 1000 },
      [WebSocketEvents.SYNC.OPERATION]: { count: 30, window: 1000 },
      [WebSocketEvents.COLLABORATION.EDITING_START]: { count: 5, window: 1000 },
      default: { count: 100, window: 1000 }
    };

    this.counters = new Map();
  }

  allowMessage(messageType) {
    const limit = this.limits[messageType] || this.limits.default;
    const now = Date.now();
    const windowStart = now - limit.window;

    // カウンターの初期化または古いエントリの削除
    if (!this.counters.has(messageType)) {
      this.counters.set(messageType, []);
    }

    const counter = this.counters.get(messageType);
    
    // 古いタイムスタンプを削除
    while (counter.length > 0 && counter[0] < windowStart) {
      counter.shift();
    }

    // 制限チェック
    if (counter.length >= limit.count) {
      return false;
    }

    // カウント追加
    counter.push(now);
    return true;
  }

  getRemainingQuota(messageType) {
    const limit = this.limits[messageType] || this.limits.default;
    const counter = this.counters.get(messageType) || [];
    return Math.max(0, limit.count - counter.length);
  }
}

// ===== メインリアルタイム通信クラス =====
class RealtimeCommunication {
  constructor(websocketUrl, authToken) {
    this.websocketUrl = websocketUrl;
    this.authToken = authToken;
    this.websocket = null;
    this.stateManager = new RealtimeStateManager();
    this.messageManager = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.isIntentionalClose = false;
  }

  async connect(mindmapId) {
    try {
      const url = `${this.websocketUrl}?mindmapId=${mindmapId}&token=${this.authToken}`;
      this.websocket = new WebSocket(url);
      this.messageManager = new MessageManager(this.websocket, this.stateManager);

      this.setupWebSocketHandlers();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.websocket.onopen = () => {
          clearTimeout(timeout);
          this.onConnected();
          resolve();
        };

        this.websocket.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      throw error;
    }
  }

  setupWebSocketHandlers() {
    this.websocket.onopen = () => this.onConnected();
    this.websocket.onclose = (event) => this.onDisconnected(event);
    this.websocket.onerror = (error) => this.onError(error);
    this.websocket.onmessage = (event) => this.messageManager.handleMessage(event.data);
  }

  onConnected() {
    console.log('WebSocket connected');
    this.reconnectAttempts = 0;
    this.stateManager.updateState({
      isConnected: true,
      connectionQuality: 'good'
    });

    // キューされたメッセージを送信
    this.messageManager.processMessageQueue();

    // ハートビート開始
    this.startHeartbeat();
  }

  onDisconnected(event) {
    console.log('WebSocket disconnected:', event.code, event.reason);
    this.stateManager.updateState({
      isConnected: false,
      connectionQuality: 'bad'
    });

    this.stopHeartbeat();

    // 意図的な切断でない場合は再接続を試行
    if (!this.isIntentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  onError(error) {
    console.error('WebSocket error:', error);
    this.stateManager.performanceTracker.recordError();
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        const startTime = Date.now();
        try {
          await this.messageManager.sendMessage('ping', {}, { requiresAck: true, timeout: 3000 });
          const latency = Date.now() - startTime;
          this.stateManager.performanceTracker.recordLatency(latency);
          
          this.stateManager.updateState({
            lastPingTime: new Date().toISOString(),
            pingLatency: latency,
            connectionQuality: this.stateManager.performanceTracker.getConnectionQuality()
          });
        } catch (error) {
          console.warn('Heartbeat failed:', error);
        }
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  scheduleReconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    setTimeout(() => {
      if (!this.stateManager.state.isConnected && this.reconnectAttempts <= this.maxReconnectAttempts) {
        console.log(`Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.stateManager.performanceTracker.recordReconnect();
        this.connect(this.currentMindmapId);
      }
    }, delay);
  }

  // ===== パブリックAPI =====

  async sendCursorUpdate(position) {
    return await this.messageManager.sendMessage(
      WebSocketEvents.COLLABORATION.CURSOR_UPDATE,
      { position }
    );
  }

  async sendEditingStart(nodeId) {
    return await this.messageManager.sendMessage(
      WebSocketEvents.COLLABORATION.EDITING_START,
      { nodeId }
    );
  }

  async sendEditingEnd(nodeId) {
    return await this.messageManager.sendMessage(
      WebSocketEvents.COLLABORATION.EDITING_END,
      { nodeId }
    );
  }

  async sendSyncOperation(operation) {
    return await this.messageManager.sendMessage(
      WebSocketEvents.SYNC.OPERATION,
      operation,
      { requiresAck: true }
    );
  }

  // 状態監視
  onStateChange(listener) {
    return this.stateManager.subscribe(listener);
  }

  getState() {
    return { ...this.stateManager.state };
  }

  getPerformanceMetrics() {
    return this.stateManager.performanceTracker.getMetrics();
  }

  // 切断
  disconnect() {
    this.isIntentionalClose = true;
    this.stopHeartbeat();
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }
}

export { 
  RealtimeCommunication, 
  WebSocketEvents, 
  RealtimeStateManager,
  MessageManager,
  PerformanceTracker,
  RateLimiter
};