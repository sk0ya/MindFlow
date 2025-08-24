
export type EditingActivity = 
  | 'typing' 
  | 'node-editing' 
  | 'dragging' 
  | 'menu-open'
  | 'modal-open';

/**
 * マップの編集状態を管理するサービス
 * 編集中は同期チェックを停止するために使用
 */
export class EditingStateService {
  private static instance: EditingStateService | null = null;
  private activeActivities: Set<EditingActivity> = new Set();
  private lastActivityTime: number = 0;
  private readonly ACTIVITY_TIMEOUT = 10000; // 10秒間アクティビティがなければ編集終了とみなす

  private constructor() {}

  static getInstance(): EditingStateService {
    if (!EditingStateService.instance) {
      EditingStateService.instance = new EditingStateService();
    }
    return EditingStateService.instance;
  }

  /**
   * 編集アクティビティの開始
   */
  startActivity(activity: EditingActivity): void {
    this.activeActivities.add(activity);
    this.lastActivityTime = Date.now();
  }

  /**
   * 編集アクティビティの終了
   */
  endActivity(activity: EditingActivity): void {
    this.activeActivities.delete(activity);
    this.lastActivityTime = Date.now();
  }

  /**
   * すべてのアクティビティを終了
   */
  endAllActivities(): void {
    this.activeActivities.clear();
    this.lastActivityTime = Date.now();
  }


  /**
   * 現在編集中かどうかを判定
   */
  isEditing(): boolean {
    // 期限切れのアクティビティをクリーンアップ
    this.cleanupExpiredActivities();
    
    return this.activeActivities.size > 0;
  }

  /**
   * アクティブなアクティビティの一覧を取得
   */
  getActiveActivities(): EditingActivity[] {
    this.cleanupExpiredActivities();
    return Array.from(this.activeActivities);
  }

  /**
   * 最後のアクティビティからの経過時間を取得
   */
  getTimeSinceLastActivity(): number {
    return Date.now() - this.lastActivityTime;
  }

  /**
   * 期限切れのアクティビティをクリーンアップ
   */
  private cleanupExpiredActivities(): void {
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivityTime;
    
    if (timeSinceLastActivity > this.ACTIVITY_TIMEOUT && this.activeActivities.size > 0) {
      this.activeActivities.clear();
    }
  }

  /**
   * デバッグ情報を取得
   */
  getDebugInfo() {
    return {
      isEditing: this.isEditing(),
      activeActivities: Array.from(this.activeActivities),
      timeSinceLastActivity: this.getTimeSinceLastActivity(),
      activityTimeout: this.ACTIVITY_TIMEOUT
    };
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.activeActivities.clear();
    this.lastActivityTime = 0;
  }
}