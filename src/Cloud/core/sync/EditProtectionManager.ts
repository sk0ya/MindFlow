/**
 * EditProtectionManager - 編集中データ保護システム
 * 
 * 機能:
 * - 編集セッション管理
 * - 自動保存からの編集データ保護
 * - キューされた更新の管理
 * - 協調編集での競合回避
 */

export type EditMode = 'local' | 'cloud';

export interface UpdateOptions {
  priority?: 'high' | 'normal' | 'low';
  reason?: string;
  source?: string;
}

export interface EditEventData {
  nodeId: string;
  userId: string;
  session?: EditSession;
  data?: any;
  finalValue?: string;
  originalValue?: string;
  hasChanges?: boolean;
  duration?: number;
  options?: UpdateOptions;
  queueSize?: number;
  processedCount?: number;
  remainingQueue?: number;
}

export interface EditStats {
  activeEdits: number;
  queuedUpdates: number;
  mode: EditMode;
  editingSessions: Array<{
    nodeId: string;
    userId: string;
    duration: number;
    hasChanges: boolean;
  }>;
}

export type EventListener = (data: EditEventData) => void;
export type EventUnsubscriber = () => void;

export class EditSession {
  public nodeId: string;
  public userId: string;
  public startTime: number;
  public originalValue: string;
  public currentValue: string;
  public isActive: boolean;

  constructor(nodeId: string, userId: string = 'local') {
    this.nodeId = nodeId;
    this.userId = userId;
    this.startTime = Date.now();
    this.originalValue = '';
    this.currentValue = '';
    this.isActive = true;
  }

  updateValue(value: string): void {
    this.currentValue = value;
  }

  hasChanges(): boolean {
    return this.originalValue !== this.currentValue;
  }

  getDuration(): number {
    return Date.now() - this.startTime;
  }
}

export class QueuedUpdate {
  public nodeId: string;
  public data: any;
  public options: UpdateOptions;
  public timestamp: number;
  public attempts: number;
  public maxAttempts: number;

  constructor(nodeId: string, data: any, options: UpdateOptions = {}) {
    this.nodeId = nodeId;
    this.data = data;
    this.options = options;
    this.timestamp = Date.now();
    this.attempts = 0;
    this.maxAttempts = 3;
  }

  canRetry(): boolean {
    return this.attempts < this.maxAttempts;
  }

  incrementAttempts(): void {
    this.attempts++;
  }

  isExpired(maxAge: number = 30000): boolean { // 30秒でタイムアウト
    return Date.now() - this.timestamp > maxAge;
  }
}

export class EditProtectionManager {
  private mode: EditMode;
  private activeEdits: Map<string, EditSession>;
  private updateQueue: QueuedUpdate[];
  private eventListeners: Map<string, EventListener[]>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(mode: EditMode = 'local') {
    this.mode = mode; // 'local' or 'cloud'
    this.activeEdits = new Map(); // nodeId -> EditSession
    this.updateQueue = []; // QueuedUpdate[]
    this.eventListeners = new Map();
    this.cleanupInterval = null;
    
    this.startCleanupTimer();
  }

  /**
   * 編集セッション開始
   */
  startEdit(nodeId: string, originalValue: string = '', userId: string = 'local'): EditSession {
    // 既存の編集セッションを終了
    if (this.activeEdits.has(nodeId)) {
      console.log(`⚠️ ノード ${nodeId} の既存編集セッションを終了`);
      this.forceFinishEdit(nodeId);
    }

    const session = new EditSession(nodeId, userId);
    session.originalValue = originalValue;
    session.currentValue = originalValue;
    
    this.activeEdits.set(nodeId, session);
    
    // クラウドモードでは他のユーザーに編集開始を通知
    if (this.mode === 'cloud') {
      this.notifyEditStart(nodeId, userId);
    }
    
    this.emit('edit_started', { nodeId, userId, session });
    
    console.log(`✏️ 編集開始: ${nodeId}`, { 
      originalValue, 
      userId,
      activeEdits: this.activeEdits.size 
    });
    
    return session;
  }

  /**
   * 編集セッション更新
   */
  updateEdit(nodeId: string, currentValue: string): void {
    const session = this.activeEdits.get(nodeId);
    if (!session) {
      console.warn(`⚠️ 編集セッションが見つかりません: ${nodeId}`);
      return;
    }

    session.updateValue(currentValue);
    this.emit('edit_updated', { nodeId, userId: session.userId, data: { currentValue }, session });
  }

  /**
   * 編集セッション終了
   */
  finishEdit(nodeId: string, finalValue: string, options: UpdateOptions = {}): void {
    const session = this.activeEdits.get(nodeId);
    if (!session) {
      console.warn(`⚠️ 編集セッション終了: セッションが見つかりません ${nodeId}`);
      return;
    }

    // 1. データを確定
    this.commitEdit(nodeId, finalValue, options);
    
    // 2. キューされた更新を適用
    this.processQueuedUpdates(nodeId);
    
    // 3. セッションをクリア
    this.activeEdits.delete(nodeId);
    
    // 4. クラウドモードでは他のユーザーに編集終了を通知
    if (this.mode === 'cloud') {
      this.notifyEditEnd(nodeId, session.userId);
    }
    
    this.emit('edit_finished', { 
      nodeId,
      userId: session.userId,
      finalValue, 
      originalValue: session.originalValue,
      hasChanges: session.hasChanges(),
      duration: session.getDuration(),
      options 
    } as EditEventData);
    
    console.log(`✅ 編集終了: ${nodeId}`, { 
      finalValue, 
      hasChanges: session.hasChanges(),
      duration: session.getDuration() 
    });
  }

  /**
   * 強制編集終了（エラー処理用）
   */
  forceFinishEdit(nodeId: string): void {
    const session = this.activeEdits.get(nodeId);
    if (!session) return;

    console.warn(`🚨 強制編集終了: ${nodeId}`);
    this.finishEdit(nodeId, session.currentValue, { reason: 'forced' });
  }

  /**
   * 編集中かどうかをチェック
   */
  isEditing(nodeId?: string | null): boolean {
    if (nodeId) {
      return this.activeEdits.has(nodeId);
    }
    return this.activeEdits.size > 0;
  }

  /**
   * 現在の編集中ノードを取得
   */
  getEditingNodes(): string[] {
    return Array.from(this.activeEdits.keys());
  }

  /**
   * 編集セッション情報を取得
   */
  getEditSession(nodeId: string): EditSession | null {
    return this.activeEdits.get(nodeId) || null;
  }

  /**
   * データ更新を編集中チェック付きで処理
   */
  safeUpdate(nodeId: string, data: any, options: UpdateOptions & { forceUpdate?: boolean } = {}): boolean {
    // 編集中の場合はキューに追加
    if (this.isEditing(nodeId) && !options.forceUpdate) {
      console.log(`📝 更新をキューに追加: ${nodeId}`, { data, reason: '編集中' });
      this.queueUpdate(nodeId, data, options);
      return false;
    }

    // 編集中でない場合は即座に実行
    this.applyUpdate(nodeId, data, options);
    return true;
  }

  /**
   * 更新をキューに追加
   */
  queueUpdate(nodeId: string, data: any, options: UpdateOptions = {}): void {
    const update = new QueuedUpdate(nodeId, data, options);
    this.updateQueue.push(update);
    
    this.emit('update_queued', { nodeId, data, options, queueSize: this.updateQueue.length });
    
    console.log(`📋 更新キュー追加: ${nodeId}`, { 
      queueSize: this.updateQueue.length,
      data 
    });
  }

  /**
   * キューされた更新を処理
   */
  processQueuedUpdates(nodeId: string): void {
    const queuedUpdates = this.updateQueue.filter(update => 
      update.nodeId === nodeId && !update.isExpired()
    );
    
    if (queuedUpdates.length === 0) return;
    
    console.log(`🔄 キューされた更新を処理: ${nodeId}`, { 
      count: queuedUpdates.length 
    });
    
    // 最新の更新のみを適用（古い更新は破棄）
    const latestUpdate = queuedUpdates.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
    
    try {
      this.applyUpdate(latestUpdate.nodeId, latestUpdate.data, latestUpdate.options);
      
      // 成功した更新をキューから削除
      this.updateQueue = this.updateQueue.filter(update => 
        !(update.nodeId === nodeId && update.timestamp <= latestUpdate.timestamp)
      );
      
      this.emit('queued_updates_processed', { 
        nodeId, 
        processedCount: queuedUpdates.length,
        remainingQueue: this.updateQueue.length 
      });
      
    } catch (error) {
      console.error(`❌ キューされた更新の適用に失敗: ${nodeId}`, error);
      
      // リトライ可能な場合は試行回数を増やす
      if (latestUpdate.canRetry()) {
        latestUpdate.incrementAttempts();
        console.log(`🔄 更新をリトライします: ${nodeId} (${latestUpdate.attempts}/${latestUpdate.maxAttempts})`);
      } else {
        // 最大試行回数に達した場合は削除
        this.updateQueue = this.updateQueue.filter(update => update !== latestUpdate);
        console.error(`⚠️ 更新を放棄: ${nodeId} (最大試行回数超過)`);
      }
    }
  }

  /**
   * 実際の更新適用（継承先で実装）
   */
  protected applyUpdate(nodeId: string, data: any, options: UpdateOptions): void {
    // 継承先でオーバーライド
    this.emit('update_applied', { nodeId, data, options });
  }

  /**
   * 編集確定処理（継承先で実装）
   */
  protected commitEdit(nodeId: string, finalValue: string, options: UpdateOptions): void {
    // 継承先でオーバーライド
    this.emit('edit_committed', { nodeId, finalValue, options });
  }

  // ===== 協調編集通知 =====

  /**
   * 編集開始通知（クラウドモード用）
   */
  private notifyEditStart(nodeId: string, userId: string): void {
    if (this.mode !== 'cloud') return;
    // WebSocket等でリアルタイム通知
    this.emit('notify_edit_start', { nodeId, userId });
  }

  /**
   * 編集終了通知（クラウドモード用）
   */
  private notifyEditEnd(nodeId: string, userId: string): void {
    if (this.mode !== 'cloud') return;
    // WebSocket等でリアルタイム通知
    this.emit('notify_edit_end', { nodeId, userId });
  }

  // ===== イベント管理 =====

  /**
   * イベントリスナー追加
   */
  on(event: string, listener: EventListener): EventUnsubscriber {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(listener);
    
    // 削除関数を返す
    return () => this.off(event, listener);
  }

  /**
   * イベントリスナー削除
   */
  off(event: string, listener: EventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * イベント発火
   */
  private emit(event: string, data: EditEventData): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`イベントリスナーエラー [${event}]:`, error);
        }
      });
    }
  }

  // ===== クリーンアップ =====

  /**
   * 定期クリーンアップ開始
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30000); // 30秒間隔
  }

  /**
   * 期限切れデータのクリーンアップ
   */
  private cleanup(): void {
    const beforeSize = this.updateQueue.length;
    
    // 期限切れの更新を削除
    this.updateQueue = this.updateQueue.filter(update => !update.isExpired());
    
    // 長時間編集中のセッションを警告
    for (const [nodeId, session] of this.activeEdits) {
      const duration = session.getDuration();
      if (duration > 300000) { // 5分以上
        console.warn(`⚠️ 長時間編集中: ${nodeId} (${Math.floor(duration / 1000)}秒)`);
      }
    }
    
    const afterSize = this.updateQueue.length;
    if (beforeSize !== afterSize) {
      console.log(`🧹 クリーンアップ完了: ${beforeSize - afterSize}件の期限切れ更新を削除`);
    }
  }

  /**
   * すべてのリソースをクリーンアップ
   */
  destroy(): void {
    // タイマーを停止
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // アクティブな編集セッションを強制終了
    for (const nodeId of this.activeEdits.keys()) {
      this.forceFinishEdit(nodeId);
    }

    // キューをクリア
    this.updateQueue = [];

    // イベントリスナーをクリア
    this.eventListeners.clear();

    console.log('🧹 EditProtectionManager destroyed');
  }

  // ===== 統計情報 =====

  /**
   * 統計情報を取得
   */
  getStats(): EditStats {
    return {
      activeEdits: this.activeEdits.size,
      queuedUpdates: this.updateQueue.length,
      mode: this.mode,
      editingSessions: Array.from(this.activeEdits.entries()).map(([nodeId, session]) => ({
        nodeId,
        userId: session.userId,
        duration: session.getDuration(),
        hasChanges: session.hasChanges()
      }))
    };
  }
}

export default EditProtectionManager;