/**
 * リアルタイム同期機能
 * ポーリングベースの簡易同期実装
 */

import { storageManager } from '../storage/StorageManager.js';
import { getAppSettings } from '../storage/storageUtils.js';

export interface SyncEvent {
  type: 'maps_updated' | 'map_created' | 'map_deleted' | 'map_updated' | 'sync_error';
  data: any;
  timestamp: string;
}

class RealtimeSync {
  private isEnabled: boolean = false;
  private pollingInterval: number | null = null;
  private lastSyncTime: string | null = null;
  private syncFrequency: number = 5000; // 5秒ごと
  private eventListeners: Map<string, Set<(event: SyncEvent) => void>> = new Map();
  private lastMapsSnapshot: Map<string, string> = new Map(); // mapId -> updatedAt

  constructor() {
    // 設定に基づいて自動的に開始
    this.checkAndStartSync();
  }

  /**
   * 設定を確認して同期を開始
   */
  private checkAndStartSync() {
    try {
      const settings = getAppSettings();
      if (settings.storageMode === 'cloud' && settings.enableRealtimeSync !== false) {
        // 少し遅延してから開始（初期化完了を待つ）
        setTimeout(() => {
          this.start();
        }, 1000);
      } else {
        console.log('⏸️ リアルタイム同期無効: ストレージモードまたは設定により');
      }
    } catch (error) {
      console.error('❌ リアルタイム同期設定確認エラー:', error);
    }
  }

  /**
   * リアルタイム同期を開始
   */
  start() {
    if (this.isEnabled) {
      console.log('⚠️ リアルタイム同期は既に開始されています');
      return;
    }

    console.log('🔄 リアルタイム同期を開始します');
    this.isEnabled = true;
    
    // 初回同期
    this.performSync();
    
    // 定期的な同期
    this.pollingInterval = window.setInterval(() => {
      this.performSync();
    }, this.syncFrequency);
  }

  /**
   * リアルタイム同期を停止
   */
  stop() {
    if (!this.isEnabled) {
      return;
    }

    console.log('⏹️ リアルタイム同期を停止します');
    this.isEnabled = false;
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * 同期頻度を変更
   */
  setSyncFrequency(milliseconds: number) {
    this.syncFrequency = Math.max(1000, milliseconds); // 最小1秒
    
    if (this.isEnabled) {
      this.stop();
      this.start();
    }
  }

  /**
   * 同期を実行
   */
  private async performSync() {
    if (!this.isEnabled) {
      return;
    }

    try {
      const adapter = storageManager;
      
      // 新しいStorageManagerのエンジン情報を取得
      const engineInfo = adapter.getEngineInfo();
      const isCloudAdapter = engineInfo.mode === 'cloud';
      
      if (!isCloudAdapter) {
        console.log('⏸️ 同期スキップ: ローカルモードのため', {
          mode: engineInfo.mode,
          engineName: engineInfo.name,
          isCloudAdapter: false
        });
        return;
      }
      
      console.log('✅ クラウドモード検出: リアルタイム同期を実行', {
        mode: engineInfo.mode,
        engineName: engineInfo.name,
        isCloudAdapter: true
      });

      // 全マップを取得
      const maps = await adapter.getAllMaps();
      
      // 変更を検出
      const changes = this.detectChanges(maps);
      
      // 変更があればイベントを発火
      if (changes.length > 0) {
        changes.forEach(change => {
          this.emitEvent(change);
        });
      }

      // スナップショットを更新
      this.updateSnapshot(maps);
      
      // 最終同期時刻を更新
      this.lastSyncTime = new Date().toISOString();
      
    } catch (error) {
      console.error('❌ 同期エラー:', error);
      
      // ストレージアダプターエラーの場合は詳細ログ
      if (error.message.includes('require is not defined')) {
        console.error('🚨 ESモジュールエラー: requireの使用が検出されました');
      }
      
      this.emitEvent({
        type: 'sync_error',
        data: { 
          error: error.message,
          type: error.name || 'Unknown',
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 変更を検出
   */
  private detectChanges(maps: any[]): SyncEvent[] {
    const changes: SyncEvent[] = [];
    const currentMapIds = new Set<string>();

    maps.forEach(map => {
      currentMapIds.add(map.id);
      
      const lastUpdated = this.lastMapsSnapshot.get(map.id);
      
      if (!lastUpdated) {
        // 新しいマップ
        changes.push({
          type: 'map_created',
          data: map,
          timestamp: new Date().toISOString()
        });
      } else if (lastUpdated !== map.updatedAt) {
        // 更新されたマップ
        changes.push({
          type: 'map_updated',
          data: map,
          timestamp: new Date().toISOString()
        });
      }
    });

    // 削除されたマップを検出
    this.lastMapsSnapshot.forEach((_, mapId) => {
      if (!currentMapIds.has(mapId)) {
        changes.push({
          type: 'map_deleted',
          data: { mapId },
          timestamp: new Date().toISOString()
        });
      }
    });

    if (changes.length > 0) {
      console.log(`🔄 ${changes.length}件の変更を検出しました`);
    }

    return changes;
  }

  /**
   * スナップショットを更新
   */
  private updateSnapshot(maps: any[]) {
    this.lastMapsSnapshot.clear();
    maps.forEach(map => {
      this.lastMapsSnapshot.set(map.id, map.updatedAt);
    });
  }

  /**
   * イベントリスナーを追加
   */
  addEventListener(eventType: string, listener: (event: SyncEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    
    this.eventListeners.get(eventType)!.add(listener);
    
    // リスナー削除関数を返す
    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }

  /**
   * イベントを発火
   */
  private emitEvent(event: SyncEvent) {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`イベントリスナーエラー (${event.type}):`, error);
        }
      });
    }

    // 全イベントリスナー
    const allListeners = this.eventListeners.get('*');
    if (allListeners) {
      allListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('全イベントリスナーエラー:', error);
        }
      });
    }
  }

  /**
   * 手動同期
   */
  async syncNow(): Promise<void> {
    console.log('🔄 手動同期を実行します');
    await this.performSync();
  }

  /**
   * 同期状態を取得
   */
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      lastSyncTime: this.lastSyncTime,
      syncFrequency: this.syncFrequency,
      mapsInSnapshot: this.lastMapsSnapshot.size
    };
  }
}

// シングルトンインスタンス
export const realtimeSync = new RealtimeSync();

// グローバルに公開（デバッグ用）
if (typeof window !== 'undefined') {
  (window as any).realtimeSync = realtimeSync;
}