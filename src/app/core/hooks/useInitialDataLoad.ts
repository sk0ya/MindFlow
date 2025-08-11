import { useEffect } from 'react';
import { logger } from '../../shared/utils/logger';
import type { MindMapData } from '@shared/types';

interface InitialDataLoadDependencies {
  data: MindMapData | null;
  setData: (_data: MindMapData) => void;
  isInitialized: boolean;
  loadInitialData: () => Promise<MindMapData>;
}

/**
 * 初期データ読み込みを管理するhook
 */
export const useInitialDataLoad = (
  isAppReady: boolean,
  dependencies: InitialDataLoadDependencies
) => {
  useEffect(() => {
    if (!isAppReady || dependencies.data || !dependencies.isInitialized) {
      return;
    }

    const loadData = async () => {
      try {
        logger.info('Loading initial data...');
        const initialData = await dependencies.loadInitialData();
        dependencies.setData(initialData);
        logger.info('Initial data loaded:', initialData.title);
      } catch (error) {
        logger.error('Failed to load initial data:', error);
      }
    };

    loadData();
  }, [
    isAppReady,
    dependencies
  ]);
};