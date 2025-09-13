import { logger } from '../../shared/utils/logger';

export interface SyncStatus {
  isOnline: boolean;
  lastSync: Date | null;
  hasUpdates: boolean;
  conflictCount: number;
  pendingUploads: number;
}

export interface SyncNotification {
  type: 'update-available' | 'sync-failed' | 'conflict-detected' | 'sync-success';
  message: string;
  mapId?: string;
  timestamp: Date;
}

type SyncStatusCallback = (status: SyncStatus) => void;
type NotificationCallback = (notification: SyncNotification) => void;

/**
 * 同期状態の監視と通知を管理するサービス
 */
export class SyncStatusService {
  private static instance: SyncStatusService | null = null;
  private statusCallbacks: Set<SyncStatusCallback> = new Set();
  private notificationCallbacks: Set<NotificationCallback> = new Set();
  private lastUpdatePromptTime: number = 0;
  private readonly UPDATE_PROMPT_COOLDOWN = 30000; // 30秒のクールダウン
  
  private currentStatus: SyncStatus = {
    isOnline: navigator.onLine,
    lastSync: null,
    hasUpdates: false,
    conflictCount: 0,
    pendingUploads: 0
  };

  private constructor() {
    // オンライン状態の監視
    window.addEventListener('online', () => {
      this.updateStatus({ isOnline: true });
      this.notify({
        type: 'sync-success',
        message: 'ネットワークに再接続しました',
        timestamp: new Date()
      });
    });

    window.addEventListener('offline', () => {
      this.updateStatus({ isOnline: false });
      this.notify({
        type: 'sync-failed',
        message: 'ネットワークから切断されました',
        timestamp: new Date()
      });
    });
  }

  static getInstance(): SyncStatusService {
    if (!SyncStatusService.instance) {
      SyncStatusService.instance = new SyncStatusService();
    }
    return SyncStatusService.instance;
  }

  /**
   * 同期状態の変更を監視
   */
  onStatusChange(callback: SyncStatusCallback): () => void {
    this.statusCallbacks.add(callback);
    // 現在の状態を即座に通知
    callback(this.currentStatus);
    
    return () => {
      this.statusCallbacks.delete(callback);
    };
  }

  /**
   * 通知を監視
   */
  onNotification(callback: NotificationCallback): () => void {
    this.notificationCallbacks.add(callback);
    
    return () => {
      this.notificationCallbacks.delete(callback);
    };
  }

  /**
   * 同期状態を更新
   */
  updateStatus(updates: Partial<SyncStatus>): void {
    const previousStatus = { ...this.currentStatus };
    this.currentStatus = { ...this.currentStatus, ...updates };
    
    logger.debug('SyncStatusService: Status updated', {
      previous: previousStatus,
      current: this.currentStatus
    });

    // 状態変更を通知
    this.statusCallbacks.forEach(callback => {
      try {
        callback(this.currentStatus);
      } catch (error) {
        logger.error('SyncStatusService: Status callback error:', error);
      }
    });
  }

  /**
   * 同期成功時の処理
   */
  onSyncSuccess(mapId?: string): void {
    this.updateStatus({ 
      lastSync: new Date(),
      hasUpdates: false
    });

    this.notify({
      type: 'sync-success',
      message: mapId ? `マップが同期されました: ${mapId}` : '同期が完了しました',
      mapId,
      timestamp: new Date()
    });
  }

  /**
   * 同期失敗時の処理
   */
  onSyncFailure(error: string, mapId?: string): void {
    logger.warn('SyncStatusService: Sync failed', { error, mapId });

    this.notify({
      type: 'sync-failed',
      message: `同期に失敗しました: ${error}`,
      mapId,
      timestamp: new Date()
    });
  }

  /**
   * サーバー側の更新検知時の処理
   */
  onUpdatesAvailable(mapCount: number): void {
    this.updateStatus({ hasUpdates: true });

    // クールダウンチェック - 頻繁なプロンプトを防ぐ
    const now = Date.now();
    if (now - this.lastUpdatePromptTime < this.UPDATE_PROMPT_COOLDOWN) {
      logger.debug('SyncStatusService: Update prompt skipped due to cooldown');
      return;
    }

    this.lastUpdatePromptTime = now;

    // メッセージボックスで同期を促す
    setTimeout(() => {
      // eslint-disable-next-line no-alert
      const shouldSync = window.confirm(
        `${mapCount}件の更新がサーバーで見つかりました。\n\n最新のデータを取得しますか？\n\n※「キャンセル」を選択した場合、30秒後に再度確認します。`
      );

      if (shouldSync) {
        logger.info('SyncStatusService: User confirmed sync, reloading page');
        // ページをリロードして最新データを取得
        window.location.reload();
      } else {
        logger.info('SyncStatusService: User declined sync');
        // キャンセルした場合、次回のチェック時に再度確認
        this.updateStatus({ hasUpdates: true });
      }
    }, 100); // 少し遅延させてバックグラウンド処理の完了を待つ

    this.notify({
      type: 'update-available',
      message: `${mapCount}件の更新があります`,
      timestamp: new Date()
    });
  }

  /**
   * 競合検知時の処理
   */
  onConflictDetected(mapId: string, conflictCount: number): void {
    this.updateStatus({ conflictCount });

    this.notify({
      type: 'conflict-detected',
      message: `データの競合が検出されました: ${mapId}`,
      mapId,
      timestamp: new Date()
    });
  }

  /**
   * アップロード待ちの数を更新
   */
  updatePendingUploads(count: number): void {
    this.updateStatus({ pendingUploads: count });
  }

  /**
   * 現在の同期状態を取得
   */
  getStatus(): SyncStatus {
    return { ...this.currentStatus };
  }

  /**
   * 通知を送信
   */
  private notify(notification: SyncNotification): void {
    logger.info('SyncStatusService: Notification', notification);

    this.notificationCallbacks.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        logger.error('SyncStatusService: Notification callback error:', error);
      }
    });
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.statusCallbacks.clear();
    this.notificationCallbacks.clear();
  }
}