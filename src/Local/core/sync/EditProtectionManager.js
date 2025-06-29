/**
 * EditProtectionManager - 編集中データ保護システム（Local版 - 簡略化）
 * 
 * 機能:
 * - 編集セッション管理（ローカルのみ）
 * - 自動保存からの編集データ保護
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

export class EditProtectionManager {
  constructor() {
    this.activeEdits = new Map(); // nodeId -> EditSession
  }

  /**
   * 編集セッション開始
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
  updateEdit(nodeId, currentValue) {
    const session = this.activeEdits.get(nodeId);
    if (!session) {
      console.warn(`⚠️ 編集セッションが見つかりません: ${nodeId}`);
      return;
    }

    session.updateValue(currentValue);
  }

  /**
   * 編集セッション終了
   */
  finishEdit(nodeId, finalValue, options = {}) {
    const session = this.activeEdits.get(nodeId);
    if (!session) {
      console.warn(`⚠️ 編集セッション終了: セッションが見つかりません ${nodeId}`);
      return;
    }

    // セッションをクリア
    this.activeEdits.delete(nodeId);
    
    console.log(`✅ 編集終了: ${nodeId}`, { 
      finalValue, 
      hasChanges: session.hasChanges(),
      duration: session.getDuration() 
    });
  }

  /**
   * 強制編集終了（エラー処理用）
   */
  forceFinishEdit(nodeId) {
    const session = this.activeEdits.get(nodeId);
    if (!session) return;

    console.warn(`🚨 強制編集終了: ${nodeId}`);
    this.finishEdit(nodeId, session.currentValue, { forced: true });
  }

  /**
   * 編集中かどうかをチェック
   */
  isEditing(nodeId = null) {
    if (nodeId) {
      return this.activeEdits.has(nodeId);
    }
    return this.activeEdits.size > 0;
  }

  /**
   * 現在の編集中ノードを取得
   */
  getEditingNodes() {
    return Array.from(this.activeEdits.keys());
  }

  /**
   * 編集セッション情報を取得
   */
  getEditSession(nodeId) {
    return this.activeEdits.get(nodeId) || null;
  }

  /**
   * すべてのリソースをクリーンアップ
   */
  destroy() {
    // アクティブな編集セッションを強制終了
    for (const nodeId of this.activeEdits.keys()) {
      this.forceFinishEdit(nodeId);
    }

    console.log('🧹 EditProtectionManager destroyed');
  }

  /**
   * 統計情報を取得
   */
  getStats() {
    return {
      activeEdits: this.activeEdits.size,
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