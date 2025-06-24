/**
 * MessageManager - WebSocketメッセージ管理
 * メッセージ送受信、レート制限、ACK管理を担当
 */
export class MessageManager {
  constructor(websocket, syncStateManager) {
    this.websocket = websocket;
    this.syncStateManager = syncStateManager;
    this.messageQueue = [];
    this.pendingMessages = new Map(); // messageId -> { resolve, reject, timeout }
    this.rateLimiter = new RateLimiter();
    this.sequenceNumber = 0;
    this.messageHandlers = new Map();
    this.compressionEnabled = false;
    
    this.setupMessageHandlers();
    this.startQueueProcessor();
  }

  /**
   * メッセージハンドラーを設定
   */
  setupMessageHandlers() {
    this.messageHandlers.set('ack', this.handleAck.bind(this));
    this.messageHandlers.set('ping', this.handlePing.bind(this));
    this.messageHandlers.set('pong', this.handlePong.bind(this));
    this.messageHandlers.set('user_join', this.handleUserJoin.bind(this));
    this.messageHandlers.set('user_leave', this.handleUserLeave.bind(this));
    this.messageHandlers.set('cursor_update', this.handleCursorUpdate.bind(this));
    this.messageHandlers.set('editing_start', this.handleEditingStart.bind(this));
    this.messageHandlers.set('editing_end', this.handleEditingEnd.bind(this));
    this.messageHandlers.set('sync_operation', this.handleSyncOperation.bind(this));
    this.messageHandlers.set('presence_update', this.handlePresenceUpdate.bind(this));
    this.messageHandlers.set('system_error', this.handleSystemError.bind(this));
    this.messageHandlers.set('rate_limit', this.handleRateLimit.bind(this));
  }

  /**
   * キュープロセッサーを開始
   */
  startQueueProcessor() {
    this.queueProcessor = setInterval(() => {
      this.processMessageQueue();
    }, 100);
  }

  /**
   * メッセージ送信
   * @param {string} type - メッセージタイプ
   * @param {Object} data - メッセージデータ
   * @param {Object} options - オプション
   * @returns {Promise} - 送信結果
   */
  async sendMessage(type, data, options = {}) {
    const message = {
      id: this.generateMessageId(),
      type,
      data,
      timestamp: new Date().toISOString(),
      sequence: ++this.sequenceNumber,
      requiresAck: options.requiresAck || false,
      priority: options.priority || 'normal',
      timeout: options.timeout || 5000
    };

    // レート制限チェック
    if (!this.rateLimiter.allowMessage(type)) {
      if (options.priority === 'high') {
        // 高優先度メッセージは例外的に許可
        console.warn(`Rate limit bypassed for high priority message: ${type}`);
      } else {
        throw new Error(`Rate limit exceeded for message type: ${type}`);
      }
    }

    try {
      await this.sendMessageInternal(message);
      
      if (message.requiresAck) {
        return await this.waitForAck(message.id, message.timeout);
      }
      
      return { success: true, messageId: message.id };
    } catch (error) {
      console.error('Message send failed:', error);
      
      // 重要なメッセージの場合はキューに追加
      if (options.queueOnFailure !== false) {
        this.addToQueue(message);
      }
      
      throw error;
    }
  }

  /**
   * メッセージ内部送信
   * @param {Object} message - メッセージ
   */
  async sendMessageInternal(message) {
    if (this.websocket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    let messageStr = JSON.stringify(message);
    
    // 圧縮が有効な場合
    if (this.compressionEnabled && messageStr.length > 1024) {
      messageStr = this.compressMessage(messageStr);
      message.compressed = true;
    }

    this.websocket.send(messageStr);
    
    // 統計更新
    this.updateSendStats(messageStr.length);
  }

  /**
   * メッセージをキューに追加
   * @param {Object} message - メッセージ
   */
  addToQueue(message) {
    // 優先度に応じて挿入位置を決定
    if (message.priority === 'high') {
      this.messageQueue.unshift(message);
    } else {
      this.messageQueue.push(message);
    }

    // キューサイズ制限
    if (this.messageQueue.length > 1000) {
      this.messageQueue.splice(500, this.messageQueue.length - 500);
      console.warn('Message queue trimmed due to size limit');
    }
  }

  /**
   * キューされたメッセージを処理
   */
  async processMessageQueue() {
    if (this.messageQueue.length === 0 || this.websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const batchSize = 5;
    const batch = this.messageQueue.splice(0, batchSize);

    for (const message of batch) {
      try {
        await this.sendMessageInternal(message);
        
        if (message.requiresAck) {
          // ACK待ちリストに追加
          this.waitForAck(message.id, message.timeout).catch(error => {
            console.error(`Queued message ACK failed: ${message.id}`, error);
          });
        }
      } catch (error) {
        console.error('Queued message send failed:', error);
        // 再度キューに戻す
        this.messageQueue.unshift(message);
        break;
      }
    }
  }

  /**
   * ACK待機
   * @param {string} messageId - メッセージID
   * @param {number} timeout - タイムアウト時間
   * @returns {Promise} - ACK結果
   */
  async waitForAck(messageId, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error('Message acknowledgment timeout'));
      }, timeout);

      this.pendingMessages.set(messageId, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          this.pendingMessages.delete(messageId);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          this.pendingMessages.delete(messageId);
          reject(error);
        }
      });
    });
  }

  /**
   * メッセージ受信処理
   * @param {string} messageStr - 受信メッセージ文字列
   */
  handleMessage(messageStr) {
    try {
      let message;
      
      // 圧縮チェック
      if (messageStr.startsWith('{')) {
        message = JSON.parse(messageStr);
      } else {
        message = JSON.parse(this.decompressMessage(messageStr));
      }

      // 統計更新
      this.updateReceiveStats(messageStr.length);

      // ハンドラー実行
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        handler(message);
      } else {
        console.warn('Unknown message type:', message.type);
        this.handleUnknownMessage(message);
      }

      // グローバルイベント発行
      this.emitMessageEvent(message);

    } catch (error) {
      console.error('Message handling error:', error);
      this.syncStateManager.addError(error, 'message_handling');
    }
  }

  // ===== メッセージハンドラー =====

  /**
   * ACKハンドラー
   * @param {Object} message - ACKメッセージ
   */
  handleAck(message) {
    const pending = this.pendingMessages.get(message.data.messageId);
    if (pending) {
      if (message.data.success) {
        pending.resolve(message.data);
      } else {
        pending.reject(new Error(message.data.error || 'ACK failed'));
      }
    }
  }

  /**
   * Pingハンドラー
   * @param {Object} message - Pingメッセージ
   */
  handlePing(message) {
    // Pongで応答
    this.sendMessage('pong', { 
      pingId: message.id,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Pongハンドラー
   * @param {Object} message - Pongメッセージ
   */
  handlePong(message) {
    const now = Date.now();
    const pingTime = new Date(message.data.timestamp).getTime();
    const latency = now - pingTime;

    this.syncStateManager.updateState({
      lastPingTime: message.data.timestamp,
      pingLatency: latency
    });
  }

  /**
   * ユーザー参加ハンドラー
   * @param {Object} message - ユーザー参加メッセージ
   */
  handleUserJoin(message) {
    this.syncStateManager.addUserSession(message.data.userId, message.data.userInfo);
  }

  /**
   * ユーザー離脱ハンドラー
   * @param {Object} message - ユーザー離脱メッセージ
   */
  handleUserLeave(message) {
    this.syncStateManager.removeUserSession(message.data.userId);
  }

  /**
   * カーソル更新ハンドラー
   * @param {Object} message - カーソル更新メッセージ
   */
  handleCursorUpdate(message) {
    this.syncStateManager.updateCursorPosition(
      message.data.userId, 
      message.data.position
    );
  }

  /**
   * 編集開始ハンドラー
   * @param {Object} message - 編集開始メッセージ
   */
  handleEditingStart(message) {
    this.syncStateManager.startEditing(message.data.nodeId, message.data.userId);
  }

  /**
   * 編集終了ハンドラー
   * @param {Object} message - 編集終了メッセージ
   */
  handleEditingEnd(message) {
    this.syncStateManager.endEditing(message.data.nodeId, message.data.userId);
  }

  /**
   * 同期操作ハンドラー
   * @param {Object} message - 同期操作メッセージ
   */
  handleSyncOperation(message) {
    // 競合解決器に委譲
    document.dispatchEvent(new CustomEvent('sync_operation_received', {
      detail: message.data
    }));
  }

  /**
   * プレゼンス更新ハンドラー
   * @param {Object} message - プレゼンス更新メッセージ
   */
  handlePresenceUpdate(message) {
    this.syncStateManager.updateUserPresence(
      message.data.userId, 
      message.data.presence
    );
  }

  /**
   * システムエラーハンドラー
   * @param {Object} message - システムエラーメッセージ
   */
  handleSystemError(message) {
    console.error('System error:', message.data);
    this.syncStateManager.addError(message.data.error, 'system_error');
  }

  /**
   * レート制限ハンドラー
   * @param {Object} message - レート制限メッセージ
   */
  handleRateLimit(message) {
    console.warn('Rate limit exceeded:', message.data);
    this.rateLimiter.handleRateLimit(message.data);
  }

  /**
   * 未知のメッセージハンドラー
   * @param {Object} message - 未知のメッセージ
   */
  handleUnknownMessage(message) {
    console.warn('Unknown message type received:', message.type, message);
  }

  // ===== ユーティリティメソッド =====

  /**
   * メッセージイベントを発行
   * @param {Object} message - メッセージ
   */
  emitMessageEvent(message) {
    const event = new CustomEvent('websocket_message', {
      detail: { message, timestamp: new Date().toISOString() }
    });
    document.dispatchEvent(event);
  }

  /**
   * 送信統計を更新
   * @param {number} size - メッセージサイズ
   */
  updateSendStats(size) {
    const currentStats = this.syncStateManager.state;
    this.syncStateManager.updateState({
      messageCount: currentStats.messageCount + 1,
      bandwidthUsage: currentStats.bandwidthUsage + size
    });
  }

  /**
   * 受信統計を更新
   * @param {number} size - メッセージサイズ
   */
  updateReceiveStats(size) {
    const currentStats = this.syncStateManager.state;
    this.syncStateManager.updateState({
      bandwidthUsage: currentStats.bandwidthUsage + size
    });
  }

  /**
   * メッセージ圧縮
   * @param {string} message - メッセージ
   * @returns {string} - 圧縮されたメッセージ
   */
  compressMessage(message) {
    // 簡単なgzip風圧縮（実際の実装ではlz-stringなどを使用）
    try {
      // ブラウザのCompressionStream APIが利用可能な場合
      if (typeof CompressionStream !== 'undefined') {
        // WebStreams APIを使用した圧縮
        // 実装の詳細は省略
      }
      
      // フォールバック：LZ圧縮のシンプルな実装
      return this.simpleCompress(message);
    } catch (error) {
      console.warn('Message compression failed:', error);
      return message;
    }
  }

  /**
   * メッセージ解凍
   * @param {string} compressedMessage - 圧縮されたメッセージ
   * @returns {string} - 解凍されたメッセージ
   */
  decompressMessage(compressedMessage) {
    try {
      return this.simpleDecompress(compressedMessage);
    } catch (error) {
      console.warn('Message decompression failed:', error);
      return compressedMessage;
    }
  }

  /**
   * 簡単な圧縮実装
   * @param {string} str - 文字列
   * @returns {string} - 圧縮された文字列
   */
  simpleCompress(str) {
    // RLE（Run Length Encoding）の簡単な実装
    return str.replace(/(.)\1+/g, (match, char) => {
      return char + match.length;
    });
  }

  /**
   * 簡単な解凍実装
   * @param {string} str - 圧縮された文字列
   * @returns {string} - 解凍された文字列
   */
  simpleDecompress(str) {
    // RLE解凍
    return str.replace(/(.)(\d+)/g, (match, char, count) => {
      return char.repeat(parseInt(count));
    });
  }

  /**
   * メッセージID生成
   * @returns {string} - ユニークなメッセージID
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * キューの状態を取得
   * @returns {Object} - キューの状態
   */
  getQueueState() {
    return {
      queueLength: this.messageQueue.length,
      pendingAcks: this.pendingMessages.size,
      rateLimitStatus: this.rateLimiter.getStatus()
    };
  }

  /**
   * 統計情報を取得
   * @returns {Object} - 統計情報
   */
  getStats() {
    return {
      messagesSent: this.sequenceNumber,
      queueLength: this.messageQueue.length,
      pendingAcks: this.pendingMessages.size,
      rateLimitViolations: this.rateLimiter.getViolationCount()
    };
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
      this.queueProcessor = null;
    }

    // ペンディングメッセージをクリア
    this.pendingMessages.forEach(({ reject }) => {
      reject(new Error('MessageManager cleanup'));
    });
    this.pendingMessages.clear();

    // キューをクリア
    this.messageQueue = [];
    this.messageHandlers.clear();
  }
}

/**
 * RateLimiter - レート制限管理
 */
class RateLimiter {
  constructor() {
    this.limits = {
      'cursor_update': { count: 10, window: 1000 },
      'sync_operation': { count: 30, window: 1000 },
      'editing_start': { count: 5, window: 1000 },
      'editing_end': { count: 5, window: 1000 },
      'presence_update': { count: 5, window: 5000 },
      'default': { count: 100, window: 1000 }
    };

    this.counters = new Map();
    this.violations = 0;
    this.lastViolation = null;
  }

  /**
   * メッセージ送信許可チェック
   * @param {string} messageType - メッセージタイプ
   * @returns {boolean} - 送信許可
   */
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
      this.violations++;
      this.lastViolation = new Date().toISOString();
      return false;
    }

    // カウント追加
    counter.push(now);
    return true;
  }

  /**
   * 残りクォータを取得
   * @param {string} messageType - メッセージタイプ
   * @returns {number} - 残りクォータ
   */
  getRemainingQuota(messageType) {
    const limit = this.limits[messageType] || this.limits.default;
    const counter = this.counters.get(messageType) || [];
    return Math.max(0, limit.count - counter.length);
  }

  /**
   * レート制限の処理
   * @param {Object} rateLimitData - レート制限データ
   */
  handleRateLimit(rateLimitData) {
    // サーバーからのレート制限通知を処理
    const { messageType, retryAfter } = rateLimitData;
    
    // 該当メッセージタイプの制限を一時的に強化
    if (messageType && this.limits[messageType]) {
      this.limits[messageType].count = Math.max(1, this.limits[messageType].count * 0.5);
    }

    console.warn(`Rate limited for ${messageType}, retry after ${retryAfter}ms`);
  }

  /**
   * ステータスを取得
   * @returns {Object} - レート制限ステータス
   */
  getStatus() {
    const status = {};
    for (const [messageType, counter] of this.counters) {
      const limit = this.limits[messageType] || this.limits.default;
      status[messageType] = {
        used: counter.length,
        limit: limit.count,
        remaining: Math.max(0, limit.count - counter.length),
        window: limit.window
      };
    }
    return status;
  }

  /**
   * 違反回数を取得
   * @returns {number} - 違反回数
   */
  getViolationCount() {
    return this.violations;
  }

  /**
   * カウンターをリセット
   */
  reset() {
    this.counters.clear();
    this.violations = 0;
    this.lastViolation = null;
  }
}