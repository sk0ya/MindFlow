/**
 * EditProtectionManager - 編集中データ保護システム
 * 
 * 機能:
 * - 編集セッション管理
 * - 自動保存からの編集データ保護
 * - キューされた更新の管理
 * - 協調編集での競合回避
 */

export class EditSession {
  constructor(nodeId, userId = 'local') {
    this.nodeId = nodeId;
    this.userId = userId;
    this.startTime = Date.now();
    this.originalValue = '';
    this.currentValue = '';
    this.isActive = true;
  }

  updateValue(value) {
    this.currentValue = value;
  }

  hasChanges() {
    return this.originalValue !== this.currentValue;
  }

  getDuration() {
    return Date.now() - this.startTime;
  }
}

export class QueuedUpdate {
  constructor(nodeId, data, options = {}) {
    this.nodeId = nodeId;
    this.data = data;
    this.options = options;
    this.timestamp = Date.now();
    this.attempts = 0;
    this.maxAttempts = 3;
  }

  canRetry() {
    return this.attempts < this.maxAttempts;
  }

  incrementAttempts() {
    this.attempts++;
  }

  isExpired(maxAge = 30000) { // 30秒でタイムアウト
    return Date.now() - this.timestamp > maxAge;
  }
}

export class EditProtectionManager {
  constructor(mode = 'local') {
    this.mode = mode; // 'local' or 'cloud'
    this.activeEdits = new Map(); // nodeId -> EditSession
    this.updateQueue = []; // QueuedUpdate[]
    this.eventListeners = new Map();
    this.cleanupInterval = null;
    
    this.startCleanupTimer();
  }

  /**
   * 編集セッション開始
   * @param {string} nodeId - ノードID
   * @param {string} originalValue - 元のテキスト
   * @param {string} userId - ユーザーID（協調編集用）
   * @returns {EditSession} - 編集セッション
   */
  startEdit(nodeId, originalValue = '', userId = 'local') {
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
   * @param {string} nodeId - ノードID
   * @param {string} currentValue - 現在のテキスト
   */
  updateEdit(nodeId, currentValue) {
    const session = this.activeEdits.get(nodeId);
    if (!session) {
      console.warn(`⚠️ 編集セッションが見つかりません: ${nodeId}`);
      return;
    }

    session.updateValue(currentValue);
    this.emit('edit_updated', { nodeId, currentValue, session });
  }

  /**
   * 編集セッション終了
   * @param {string} nodeId - ノードID
   * @param {string} finalValue - 最終テキスト
   * @param {Object} options - オプション
   */
  finishEdit(nodeId, finalValue, options = {}) {
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
      finalValue, 
      originalValue: session.originalValue,
      hasChanges: session.hasChanges(),
      duration: session.getDuration(),
      options 
    });
    
    console.log(`✅ 編集終了: ${nodeId}`, { 
      finalValue, 
      hasChanges: session.hasChanges(),
      duration: session.getDuration() 
    });
  }

  /**
   * 強制編集終了（エラー処理用）
   * @param {string} nodeId - ノードID
   */
  forceFinishEdit(nodeId) {
    const session = this.activeEdits.get(nodeId);
    if (!session) return;

    console.warn(`🚨 強制編集終了: ${nodeId}`);
    this.finishEdit(nodeId, session.currentValue, { forced: true });
  }

  /**
   * 編集中かどうかをチェック
   * @param {string} nodeId - ノードID（省略時は全体チェック）
   * @returns {boolean} - 編集中フラグ
   */
  isEditing(nodeId = null) {
    if (nodeId) {
      return this.activeEdits.has(nodeId);
    }
    return this.activeEdits.size > 0;
  }

  /**
   * 現在の編集中ノードを取得
   * @returns {string[]} - 編集中ノードIDの配列
   */
  getEditingNodes() {
    return Array.from(this.activeEdits.keys());
  }

  /**
   * 編集セッション情報を取得
   * @param {string} nodeId - ノードID
   * @returns {EditSession|null} - セッション情報
   */
  getEditSession(nodeId) {
    return this.activeEdits.get(nodeId) || null;
  }

  /**
   * データ更新を編集中チェック付きで処理
   * @param {string} nodeId - ノードID
   * @param {Object} data - 更新データ
   * @param {Object} options - 更新オプション
   * @returns {boolean} - 更新実行可否
   */
  safeUpdate(nodeId, data, options = {}) {
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
   * @param {string} nodeId - ノードID
   * @param {Object} data - 更新データ
   * @param {Object} options - オプション
   */
  queueUpdate(nodeId, data, options = {}) {
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
   * @param {string} nodeId - 対象ノードID
   */
  processQueuedUpdates(nodeId) {
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
   * @param {string} nodeId - ノードID
   * @param {Object} data - 更新データ
   * @param {Object} options - オプション
   */
  applyUpdate(nodeId, data, options) {
    // 継承先でオーバーライド
    this.emit('update_applied', { nodeId, data, options });
  }

  /**
   * 編集確定処理（継承先で実装）
   * @param {string} nodeId - ノードID
   * @param {string} finalValue - 最終値
   * @param {Object} options - オプション
   */
  commitEdit(nodeId, finalValue, options) {
    // 継承先でオーバーライド
    this.emit('edit_committed', { nodeId, finalValue, options });
  }

  // ===== 協調編集通知 =====

  /**
   * 編集開始通知（クラウドモード用）
   * @param {string} nodeId - ノードID
   * @param {string} userId - ユーザーID
   */
  notifyEditStart(nodeId, userId) {
    if (this.mode !== 'cloud') return;
    // WebSocket等でリアルタイム通知
    this.emit('notify_edit_start', { nodeId, userId });
  }

  /**
   * 編集終了通知（クラウドモード用）
   * @param {string} nodeId - ノードID
   * @param {string} userId - ユーザーID
   */
  notifyEditEnd(nodeId, userId) {
    if (this.mode !== 'cloud') return;
    // WebSocket等でリアルタイム通知
    this.emit('notify_edit_end', { nodeId, userId });
  }

  // ===== イベント管理 =====

  /**
   * イベントリスナー追加
   * @param {string} event - イベント名
   * @param {Function} listener - リスナー関数
   * @returns {Function} - 削除関数
   */
  on(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(listener);
    
    // 削除関数を返す
    return () => this.off(event, listener);
  }

  /**
   * イベントリスナー削除
   * @param {string} event - イベント名
   * @param {Function} listener - リスナー関数
   */
  off(event, listener) {
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
   * @param {string} event - イベント名
   * @param {Object} data - イベントデータ
   */
  emit(event, data) {
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
  startCleanupTimer() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30000); // 30秒間隔
  }

  /**
   * 期限切れデータのクリーンアップ
   */
  cleanup() {
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
  destroy() {
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
   * @returns {Object} - 統計情報
   */
  getStats() {
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