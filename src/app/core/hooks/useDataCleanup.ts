import { useCallback, useState } from 'react';
import { clearLocalIndexedDB } from '../utils/indexedDB';
import { logger } from '../../shared/utils/logger';
import { localStorageManager } from '../../shared/utils/localStorage';

export interface DataCleanupStats {
  localStorageItems: number;
  indexedDBSize: number;
}

export const useDataCleanup = () => {
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ローカルストレージのクリーンアップ
  const clearLocalStorage = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      
      // MindFlow関連のキーのみクリア
      const keysToRemove = localStorageManager.getAllMindFlowKeys();
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      logger.info(`🧹 LocalStorage cleaned: ${keysToRemove.length} items removed`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '不明なエラー';
      setError(`ローカルストレージのクリアに失敗しました: ${errorMessage}`);
      logger.error('Failed to clear localStorage:', err);
      throw err;
    }
  }, []);

  // IndexedDBのクリーンアップ
  const clearIndexedDB = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await clearLocalIndexedDB();
      logger.info('🧹 IndexedDB cleaned successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '不明なエラー';
      setError(`IndexedDBのクリアに失敗しました: ${errorMessage}`);
      logger.error('Failed to clear IndexedDB:', err);
      throw err;
    }
  }, []);

  // すべてのローカルデータをクリア
  const clearAllData = useCallback(async (): Promise<void> => {
    setIsClearing(true);
    setError(null);
    
    try {
      await Promise.all([
        clearLocalStorage(),
        clearIndexedDB()
      ]);
      
      logger.info('🧹 All local data cleared successfully');
    } catch (err) {
      // エラーは個別の関数で既に設定されている
      logger.error('Failed to clear all data:', err);
      throw err;
    } finally {
      setIsClearing(false);
    }
  }, [clearLocalStorage, clearIndexedDB]);

  // データ使用量の取得
  const getDataStats = useCallback(async (): Promise<DataCleanupStats> => {
    try {
      // ローカルストレージアイテム数
      const localStorageItems = localStorageManager.getAllMindFlowKeys().length;

      // IndexedDBのサイズは正確に取得するのが難しいため、概算値を返す
      // 実際の実装では、navigator.storage.estimate()を使用することができる
      let indexedDBSize = 0;
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          indexedDBSize = estimate.usage || 0;
        } catch {
          // エラーの場合は0を返す
          indexedDBSize = 0;
        }
      }

      return {
        localStorageItems,
        indexedDBSize
      };
    } catch (err) {
      logger.error('Failed to get data stats:', err);
      return {
        localStorageItems: 0,
        indexedDBSize: 0
      };
    }
  }, []);

  return {
    clearLocalStorage,
    clearIndexedDB,
    clearAllData,
    getDataStats,
    isClearing,
    error
  };
};