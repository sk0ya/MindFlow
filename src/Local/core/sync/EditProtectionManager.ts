/**
 * EditProtectionManager - 編集中データ保護システム（Local版 - 簡略化）
 * 
 * 機能:
 * - 編集セッション管理（ローカルのみ）
 * - 自動保存からの編集データ保護
 */

interface EditSessionOptions {
  forced?: boolean;
}

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

export class EditProtectionManager {
  private activeEdits: Map<string, EditSession>;

  constructor() {
    this.activeEdits = new Map(); // nodeId -> EditSession
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
  }

  /**
   * 編集セッション終了
   */
  finishEdit(nodeId: string, finalValue: string, options: EditSessionOptions = {}): void {
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
  forceFinishEdit(nodeId: string): void {
    const session = this.activeEdits.get(nodeId);
    if (!session) return;

    console.warn(`🚨 強制編集終了: ${nodeId}`);
    this.finishEdit(nodeId, session.currentValue, { forced: true });
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
   * すべてのリソースをクリーンアップ
   */
  destroy(): void {
    // アクティブな編集セッションを強制終了
    for (const nodeId of this.activeEdits.keys()) {
      this.forceFinishEdit(nodeId);
    }

    console.log('🧹 EditProtectionManager destroyed');
  }

  /**
   * 統計情報を取得
   */
  getStats(): {
    activeEdits: number;
    editingSessions: Array<{
      nodeId: string;
      userId: string;
      duration: number;
      hasChanges: boolean;
    }>;
  } {
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