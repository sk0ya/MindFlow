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
    
    // 初期化済みでない場合はエラーとして扱う
    if (!dependencies.isInitialized) {
      throw new Error(`${context}: Storage not initialized`);
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

// 初期化待機は useInitializationWaiter フックを使用するように変更