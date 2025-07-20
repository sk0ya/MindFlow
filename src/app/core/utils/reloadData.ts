import { createInitialData } from '../../shared/types/dataTypes';
import { logger } from '../../shared/utils/logger';
import type { MindMapData } from '@shared/types';

export interface DataReloadDependencies {
  setData: (data: MindMapData) => void;
  isInitialized: boolean;
  loadInitialData: () => Promise<MindMapData>;
  refreshMapList?: () => Promise<void>;
}

export async function executeDataReload(
  dependencies: DataReloadDependencies,
  context: string = 'useMindMap'
): Promise<void> {
  try {
    logger.info(`🔄 ${context}: Clearing data before reload...`);
    
    // 現在のデータを明示的にクリア（一時的な空のマップで置き換え）
    const tempClearData = createInitialData();
    tempClearData.title = '読み込み中...';
    dependencies.setData(tempClearData);
    
    // persistenceの初期化を待機
    if (!dependencies.isInitialized) {
      logger.info(`⏳ ${context}: Waiting for storage initialization...`);
      await waitForInitialization(() => dependencies.isInitialized);
    }
    
    logger.info(`📥 ${context}: Loading initial data from storage...`);
    const initialData = await dependencies.loadInitialData();
    logger.info(`📋 ${context}: Data loaded:`, {
      id: initialData.id,
      title: initialData.title,
    });
    
    dependencies.setData(initialData);
    
    // マップ一覧も再読み込み（オプショナル）
    if (dependencies.refreshMapList) {
      await dependencies.refreshMapList();
    }
    
    logger.info(`✅ ${context}: Data reloaded successfully:`, initialData.title);
  } catch (error) {
    logger.error(`❌ ${context}: Failed to reload data:`, error);
    throw error;
  }
}

async function waitForInitialization(
  checkFn: () => boolean,
  timeout: number = 10000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  return new Promise<void>((resolve, reject) => {
    const check = () => {
      if (checkFn()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Initialization timeout'));
      } else {
        setTimeout(check, interval);
      }
    };
    check();
  });
}