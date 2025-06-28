// ===== Type Definitions =====

/** WebSocket connection states */
export enum WebSocketState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3
}

/** Message priority levels */
export type MessagePriority = 'low' | 'normal' | 'high';

/** Message types for real-time communication */
export type MessageType = 
  | 'ack'
  | 'ping'
  | 'pong'
  | 'user_join'
  | 'user_leave'
  | 'cursor_update'
  | 'editing_start'
  | 'editing_end'
  | 'sync_operation'
  | 'presence_update'
  | 'system_error'
  | 'rate_limit';

/** Base message structure */
export interface BaseMessage {
  id: string;
  type: MessageType;
  timestamp: string;
  sequence: number;
  requiresAck?: boolean;
  priority?: MessagePriority;
  timeout?: number;
  compressed?: boolean;
}

/** ACK message data */
export interface AckMessageData {
  messageId: string;
  success: boolean;
  error?: string;
  result?: unknown;
}

/** Ping message data */
export interface PingMessageData {
  pingId: string;
  timestamp: string;
}

/** Pong message data */
export interface PongMessageData {
  pingId: string;
  timestamp: string;
}

/** User information */
export interface UserInfo {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
  color?: string;
}

/** User join message data */
export interface UserJoinMessageData {
  userId: string;
  userInfo: UserInfo;
  sessionId: string;
}

/** User leave message data */
export interface UserLeaveMessageData {
  userId: string;
  reason?: string;
}

/** Cursor position */
export interface CursorPosition {
  x: number;
  y: number;
  nodeId?: string;
  timestamp: string;
}

/** Cursor update message data */
export interface CursorUpdateMessageData {
  userId: string;
  position: CursorPosition;
}

/** Editing start message data */
export interface EditingStartMessageData {
  nodeId: string;
  userId: string;
  timestamp: string;
}

/** Editing end message data */
export interface EditingEndMessageData {
  nodeId: string;
  userId: string;
  timestamp: string;
  changes?: unknown;
}

/** Sync operation types */
export type SyncOperationType = 
  | 'node_create'
  | 'node_update'
  | 'node_delete'
  | 'node_move'
  | 'map_update'
  | 'map_create'
  | 'map_delete';

/** Sync operation data */
export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  timestamp: string;
  userId: string;
  data: unknown;
  version: number;
}

/** Sync operation message data */
export interface SyncOperationMessageData {
  operation: SyncOperation;
  mapId: string;
}

/** User presence status */
export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

/** User presence data */
export interface UserPresence {
  status: PresenceStatus;
  lastSeen: string;
  currentActivity?: string;
}

/** Presence update message data */
export interface PresenceUpdateMessageData {
  userId: string;
  presence: UserPresence;
}

/** System error data */
export interface SystemErrorData {
  error: string;
  code: string;
  details?: unknown;
  timestamp: string;
}

/** Rate limit data */
export interface RateLimitData {
  messageType: string;
  retryAfter: number;
  limit: number;
  remaining: number;
  resetTime: string;
}

/** Message data union type */
export type MessageData = 
  | AckMessageData
  | PingMessageData
  | PongMessageData
  | UserJoinMessageData
  | UserLeaveMessageData
  | CursorUpdateMessageData
  | EditingStartMessageData
  | EditingEndMessageData
  | SyncOperationMessageData
  | PresenceUpdateMessageData
  | SystemErrorData
  | RateLimitData;

/** Complete message structure */
export interface Message extends BaseMessage {
  data: MessageData;
}

/** Send message options */
export interface SendMessageOptions {
  requiresAck?: boolean;
  priority?: MessagePriority;
  timeout?: number;
  queueOnFailure?: boolean;
}

/** Send message result */
export interface SendMessageResult {
  success: boolean;
  messageId: string;
  result?: unknown;
}

/** Pending message handler */
export interface PendingMessageHandler {
  resolve: (result: SendMessageResult) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
}

/** Message handler function */
export type MessageHandler = (message: Message) => void;

/** Rate limit configuration */
export interface RateLimitConfig {
  count: number;
  window: number;
}

/** Rate limit status */
export interface RateLimitStatus {
  used: number;
  limit: number;
  remaining: number;
  window: number;
}

/** Queue state */
export interface QueueState {
  queueLength: number;
  pendingAcks: number;
  rateLimitStatus: Record<string, RateLimitStatus>;
}

/** Message statistics */
export interface MessageStats {
  messagesSent: number;
  queueLength: number;
  pendingAcks: number;
  rateLimitViolations: number;
}

/** WebSocket event data */
export interface WebSocketEventData {
  message: Message;
  timestamp: string;
}

/** Sync state manager interface */
export interface SyncStateManager {
  state: {
    messageCount: number;
    bandwidthUsage: number;
    lastPingTime?: string;
    pingLatency?: number;
  };
  updateState(updates: Partial<SyncStateManager['state']>): void;
  addError(error: Error | string, context: string): void;
  addUserSession(userId: string, userInfo: UserInfo): void;
  removeUserSession(userId: string): void;
  updateCursorPosition(userId: string, position: CursorPosition): void;
  startEditing(nodeId: string, userId: string): void;
  endEditing(nodeId: string, userId: string): void;
  updateUserPresence(userId: string, presence: UserPresence): void;
}

/**
 * MessageManager - WebSocketメッセージ管理
 * メッセージ送受信、レート制限、ACK管理を担当
 */
export class MessageManager {
  private websocket: WebSocket;
  private syncStateManager: SyncStateManager;
  private messageQueue: Message[];
  private pendingMessages: Map<string, PendingMessageHandler>;
  private rateLimiter: RateLimiter;
  private sequenceNumber: number;
  private messageHandlers: Map<MessageType, MessageHandler>;
  private compressionEnabled: boolean;
  private queueProcessor: NodeJS.Timeout | null;

  constructor(websocket: WebSocket, syncStateManager: SyncStateManager) {
    this.websocket = websocket;
    this.syncStateManager = syncStateManager;
    this.messageQueue = [];
    this.pendingMessages = new Map();
    this.rateLimiter = new RateLimiter();
    this.sequenceNumber = 0;
    this.messageHandlers = new Map();
    this.compressionEnabled = false;
    this.queueProcessor = null;
    
    this.setupMessageHandlers();
    this.startQueueProcessor();
  }

  /**
   * メッセージハンドラーを設定
   */
  private setupMessageHandlers(): void {
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
  private startQueueProcessor(): void {
    this.queueProcessor = setInterval(() => {
      this.processMessageQueue();
    }, 100);
  }

  /**
   * メッセージ送信
   * @param type - メッセージタイプ
   * @param data - メッセージデータ
   * @param options - オプション
   * @returns 送信結果
   */
  async sendMessage(
    type: MessageType,
    data: MessageData,
    options: SendMessageOptions = {}
  ): Promise<SendMessageResult> {
    const message: Message = {
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
   * @param message - メッセージ
   */
  private async sendMessageInternal(message: Message): Promise<void> {
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
   * @param message - メッセージ
   */
  private addToQueue(message: Message): void {
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
  private async processMessageQueue(): Promise<void> {
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
   * @param messageId - メッセージID
   * @param timeout - タイムアウト時間
   * @returns ACK結果
   */
  private async waitForAck(messageId: string, timeout: number): Promise<SendMessageResult> {
    return new Promise<SendMessageResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error('Message acknowledgment timeout'));
      }, timeout);

      this.pendingMessages.set(messageId, {
        resolve: (result: SendMessageResult) => {
          clearTimeout(timeoutId);
          this.pendingMessages.delete(messageId);
          resolve(result);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          this.pendingMessages.delete(messageId);
          reject(error);
        },
        timeout: timeoutId
      });
    });
  }

  /**
   * メッセージ受信処理
   * @param messageStr - 受信メッセージ文字列
   */
  handleMessage(messageStr: string): void {
    try {
      let message: Message;
      
      // 圧縮チェック
      if (messageStr.startsWith('{')) {
        message = JSON.parse(messageStr) as Message;
      } else {
        message = JSON.parse(this.decompressMessage(messageStr)) as Message;
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
   * @param message - ACKメッセージ
   */
  private handleAck(message: Message): void {
    const ackData = message.data as AckMessageData;
    const pending = this.pendingMessages.get(ackData.messageId);
    if (pending) {
      if (ackData.success) {
        pending.resolve({ success: true, messageId: ackData.messageId, result: ackData.result });
      } else {
        pending.reject(new Error(ackData.error || 'ACK failed'));
      }
    }
  }

  /**
   * Pingハンドラー
   * @param message - Pingメッセージ
   */
  private handlePing(message: Message): void {
    // Pongで応答
    const pongData: PongMessageData = {
      pingId: message.id,
      timestamp: new Date().toISOString()
    };
    this.sendMessage('pong', pongData);
  }

  /**
   * Pongハンドラー
   * @param message - Pongメッセージ
   */
  private handlePong(message: Message): void {
    const pongData = message.data as PongMessageData;
    const now = Date.now();
    const pingTime = new Date(pongData.timestamp).getTime();
    const latency = now - pingTime;

    this.syncStateManager.updateState({
      lastPingTime: pongData.timestamp,
      pingLatency: latency
    });
  }

  /**
   * ユーザー参加ハンドラー
   * @param message - ユーザー参加メッセージ
   */
  private handleUserJoin(message: Message): void {
    const joinData = message.data as UserJoinMessageData;
    this.syncStateManager.addUserSession(joinData.userId, joinData.userInfo);
  }

  /**
   * ユーザー離脱ハンドラー
   * @param message - ユーザー離脱メッセージ
   */
  private handleUserLeave(message: Message): void {
    const leaveData = message.data as UserLeaveMessageData;
    this.syncStateManager.removeUserSession(leaveData.userId);
  }

  /**
   * カーソル更新ハンドラー
   * @param message - カーソル更新メッセージ
   */
  private handleCursorUpdate(message: Message): void {
    const cursorData = message.data as CursorUpdateMessageData;
    this.syncStateManager.updateCursorPosition(
      cursorData.userId, 
      cursorData.position
    );
  }

  /**
   * 編集開始ハンドラー
   * @param message - 編集開始メッセージ
   */
  private handleEditingStart(message: Message): void {
    const editingData = message.data as EditingStartMessageData;
    this.syncStateManager.startEditing(editingData.nodeId, editingData.userId);
  }

  /**
   * 編集終了ハンドラー
   * @param message - 編集終了メッセージ
   */
  private handleEditingEnd(message: Message): void {
    const editingData = message.data as EditingEndMessageData;
    this.syncStateManager.endEditing(editingData.nodeId, editingData.userId);
  }

  /**
   * 同期操作ハンドラー
   * @param message - 同期操作メッセージ
   */
  private handleSyncOperation(message: Message): void {
    const syncData = message.data as SyncOperationMessageData;
    // 競合解決器に委譲
    document.dispatchEvent(new CustomEvent('sync_operation_received', {
      detail: syncData
    }));
  }

  /**
   * プレゼンス更新ハンドラー
   * @param message - プレゼンス更新メッセージ
   */
  private handlePresenceUpdate(message: Message): void {
    const presenceData = message.data as PresenceUpdateMessageData;
    this.syncStateManager.updateUserPresence(
      presenceData.userId, 
      presenceData.presence
    );
  }

  /**
   * システムエラーハンドラー
   * @param message - システムエラーメッセージ
   */
  private handleSystemError(message: Message): void {
    const errorData = message.data as SystemErrorData;
    console.error('System error:', errorData);
    this.syncStateManager.addError(errorData.error, 'system_error');
  }

  /**
   * レート制限ハンドラー
   * @param message - レート制限メッセージ
   */
  private handleRateLimit(message: Message): void {
    const rateLimitData = message.data as RateLimitData;
    console.warn('Rate limit exceeded:', rateLimitData);
    this.rateLimiter.handleRateLimit(rateLimitData);
  }

  /**
   * 未知のメッセージハンドラー
   * @param message - 未知のメッセージ
   */
  private handleUnknownMessage(message: Message): void {
    console.warn('Unknown message type received:', message.type, message);
  }

  // ===== ユーティリティメソッド =====

  /**
   * メッセージイベントを発行
   * @param message - メッセージ
   */
  private emitMessageEvent(message: Message): void {
    const eventData: WebSocketEventData = {
      message,
      timestamp: new Date().toISOString()
    };
    const event = new CustomEvent('websocket_message', {
      detail: eventData
    });
    document.dispatchEvent(event);
  }

  /**
   * 送信統計を更新
   * @param size - メッセージサイズ
   */
  private updateSendStats(size: number): void {
    const currentStats = this.syncStateManager.state;
    this.syncStateManager.updateState({
      messageCount: currentStats.messageCount + 1,
      bandwidthUsage: currentStats.bandwidthUsage + size
    });
  }

  /**
   * 受信統計を更新
   * @param size - メッセージサイズ
   */
  private updateReceiveStats(size: number): void {
    const currentStats = this.syncStateManager.state;
    this.syncStateManager.updateState({
      bandwidthUsage: currentStats.bandwidthUsage + size
    });
  }

  /**
   * メッセージ圧縮
   * @param message - メッセージ
   * @returns 圧縮されたメッセージ
   */
  private compressMessage(message: string): string {
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
   * @param compressedMessage - 圧縮されたメッセージ
   * @returns 解凍されたメッセージ
   */
  private decompressMessage(compressedMessage: string): string {
    try {
      return this.simpleDecompress(compressedMessage);
    } catch (error) {
      console.warn('Message decompression failed:', error);
      return compressedMessage;
    }
  }

  /**
   * 簡単な圧縮実装
   * @param str - 文字列
   * @returns 圧縮された文字列
   */
  private simpleCompress(str: string): string {
    // RLE（Run Length Encoding）の簡単な実装
    return str.replace(/(.)\1+/g, (match, char) => {
      return char + match.length;
    });
  }

  /**
   * 簡単な解凍実装
   * @param str - 圧縮された文字列
   * @returns 解凍された文字列
   */
  private simpleDecompress(str: string): string {
    // RLE解凍
    return str.replace(/(.)(\d+)/g, (match, char, count) => {
      return char.repeat(parseInt(count));
    });
  }

  /**
   * メッセージID生成
   * @returns ユニークなメッセージID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * キューの状態を取得
   * @returns キューの状態
   */
  getQueueState(): QueueState {
    return {
      queueLength: this.messageQueue.length,
      pendingAcks: this.pendingMessages.size,
      rateLimitStatus: this.rateLimiter.getStatus()
    };
  }

  /**
   * 統計情報を取得
   * @returns 統計情報
   */
  getStats(): MessageStats {
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
  cleanup(): void {
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
      this.queueProcessor = null;
    }

    // ペンディングメッセージをクリア
    this.pendingMessages.forEach(({ reject, timeout }) => {
      if (timeout) {
        clearTimeout(timeout);
      }
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
  private limits: Record<string, RateLimitConfig>;
  private counters: Map<string, number[]>;
  private violations: number;
  private lastViolation: string | null;

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
   * @param messageType - メッセージタイプ
   * @returns 送信許可
   */
  allowMessage(messageType: string): boolean {
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
   * @param messageType - メッセージタイプ
   * @returns 残りクォータ
   */
  getRemainingQuota(messageType: string): number {
    const limit = this.limits[messageType] || this.limits.default;
    const counter = this.counters.get(messageType) || [];
    return Math.max(0, limit.count - counter.length);
  }

  /**
   * レート制限の処理
   * @param rateLimitData - レート制限データ
   */
  handleRateLimit(rateLimitData: RateLimitData): void {
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
   * @returns レート制限ステータス
   */
  getStatus(): Record<string, RateLimitStatus> {
    const status: Record<string, RateLimitStatus> = {};
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
   * @returns 違反回数
   */
  getViolationCount(): number {
    return this.violations;
  }

  /**
   * カウンターをリセット
   */
  reset(): void {
    this.counters.clear();
    this.violations = 0;
    this.lastViolation = null;
  }
}