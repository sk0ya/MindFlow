// Storage configuration examples for different use cases
import type { StorageConfig } from '../core/storage/types';
import type { AuthAdapter } from '../core/auth/types';

/**
 * ローカルモード設定例
 * IndexedDBのみを使用、認証不要
 */
export const localModeConfig: StorageConfig = {
  mode: 'local',
  autoSave: true
};

/**
 * クラウドモード設定例
 * IndexedDB + APIを使用、認証必須
 */
export const createCloudModeConfig = (authAdapter: AuthAdapter): StorageConfig => ({
  mode: 'cloud',
  authAdapter,
  autoSave: true,
  syncInterval: 30000, // 30秒間隔で同期
  retryAttempts: 3,
  enableOfflineMode: true
});



/**
 * 使用例:
 * 
 * // ローカルモード
 * const persistence = useMindMapPersistence(localModeConfig);
 * 
 * // クラウドモード
 * const authAdapter = new MyAuthAdapter();
 * const persistence = useMindMapPersistence(createCloudModeConfig(authAdapter));
 * 
 */