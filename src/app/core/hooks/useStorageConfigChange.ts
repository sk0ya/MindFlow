import { useEffect, useRef } from 'react';
import { logger } from '../../shared/utils/logger';
import { executeDataReload } from '../utils/reloadData';
import type { StorageConfig } from '../storage/types';
import type { MindMapData } from '@shared/types';

interface StorageConfigChangeDependencies {
  setData: (_data: MindMapData) => void;
  isInitialized: boolean;
  loadInitialData: () => Promise<MindMapData>;
  refreshMapList: () => Promise<void>;
}

/**
 * ストレージ設定変更時のデータ再読み込みを管理するhook
 */
export const useStorageConfigChange = (
  storageConfig: StorageConfig | undefined,
  dependencies: StorageConfigChangeDependencies
) => {
  const prevStorageConfigRef = useRef<StorageConfig | null>(storageConfig || null);

  useEffect(() => {
    const currentConfig = storageConfig;
    const prevConfig = prevStorageConfigRef.current;

    const modeChanged = currentConfig?.mode !== prevConfig?.mode;
    const authChanged = currentConfig?.authAdapter !== prevConfig?.authAdapter;


    if (modeChanged || authChanged) {
      logger.info('Storage config changed, reloading data', {
        prevMode: prevConfig?.mode,
        newMode: currentConfig?.mode
      });

      const reloadFromNewStorage = async () => {
        try {
          await executeDataReload(dependencies, 'storageConfigChange');
          logger.info('New storage data loaded with mode:', currentConfig?.mode);
        } catch (error) {
          logger.error('Failed to reload data from new storage:', error);
        }
      };

      reloadFromNewStorage();
    }

    prevStorageConfigRef.current = currentConfig || null;
  }, [storageConfig, dependencies]);
};