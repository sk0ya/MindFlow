import { useCallback, useEffect, useState, useRef } from 'react';
import type { MindMapData } from '@shared/types';
import { createInitialData } from '../../shared/types/dataTypes';
import type { StorageAdapter, StorageConfig } from '../storage/types';
import { createStorageAdapter } from '../storage/StorageAdapterFactory';
import { logger } from '../../shared/utils/logger';
import { useInitializationWaiter } from './useInitializationWaiter';
import { isMindMapData, validateMindMapData } from '../../shared/utils/validation';

// 型検証は shared/utils/validation から import


/**
 * データ永続化に特化したHook
 * 設定可能なストレージアダプターでの保存・読み込みを担当
 */
export const useMindMapPersistence = (config: StorageConfig = { mode: 'local' }) => {
  const [allMindMaps, setAllMindMaps] = useState<MindMapData[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [storageAdapter, setStorageAdapter] = useState<StorageAdapter | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 前回の設定を記録して無用な再初期化を防ぐ
  const prevConfigRef = useRef<StorageConfig | null>(null);
  
  // ストレージアダプター初期化
  useEffect(() => {
    const prevConfig = prevConfigRef.current;
    const modeChanged = prevConfig?.mode !== config.mode;
    const authAdapterChanged = prevConfig?.authAdapter !== config.authAdapter;
    

    // 設定が実際に変更された場合のみ再初期化
    if (!prevConfig || modeChanged || authAdapterChanged) {
      logger.info(`(Re)initializing ${config.mode} storage adapter`, {
        reason: !prevConfig ? 'first-init' : modeChanged ? 'mode-changed' : 'auth-changed'
      });
      
      // 初期化状態をリセット
      setIsInitialized(false);
      setAllMindMaps([]);
      
      const initStorage = async () => {
        try {
          setError(null);
          
          // 前のアダプターをクリーンアップ
          if (storageAdapter) {
            logger.info('Cleaning up previous adapter');
            storageAdapter.cleanup();
          }
          
          logger.info(`Creating ${config.mode} storage adapter`);
          const adapter = await createStorageAdapter(config);
          setStorageAdapter(adapter);
          setIsInitialized(true);
          logger.info(`${config.mode} storage initialized successfully`);
        } catch (initError) {
          const errorMessage = initError instanceof Error ? initError.message : 'Storage initialization failed';
          logger.error('Storage initialization failed:', initError);
          setError(errorMessage);
          setIsInitialized(true); // エラーでも初期化完了扱いにして処理を続行
        }
      };
      initStorage();
      
      prevConfigRef.current = config;
    }
  }, [config, storageAdapter, isInitialized]);

  // ストレージアダプターのクリーンアップを単独のuseEffectで管理
  useEffect(() => {
    return () => {
      if (storageAdapter) {
        logger.info('Cleaning up adapter on unmount/change');
        storageAdapter.cleanup();
      }
    };
  }, [storageAdapter]);

  const { waitForInitialization } = useInitializationWaiter();

  // 初期データ読み込み
  const loadInitialData = useCallback(async (): Promise<MindMapData> => {
    if (!isInitialized || !storageAdapter) {
      await waitForInitialization(() => isInitialized && !!storageAdapter);
    }

    if (!storageAdapter) {
      logger.warn('Storage adapter not available, creating default data');
      return createInitialData();
    }

    try {
      const savedData = await storageAdapter.loadInitialData();
      if (savedData && isMindMapData(savedData)) {
        const validation = validateMindMapData(savedData);
        if (validation.isValid) {
          logger.info(`Loaded saved data from ${config.mode} storage:`, savedData.title);
          return savedData;
        } else {
          logger.warn('Loaded data failed validation:', validation.errors);
        }
      }
    } catch (loadError) {
      logger.error(`Failed to load saved data from ${config.mode} storage:`, loadError);
    }
    
    // デフォルトデータを作成して返す
    const initialData = createInitialData();
    logger.info('Created initial data:', initialData.title);
    return initialData;
  }, [isInitialized, storageAdapter, config.mode, waitForInitialization]);

  // データ保存
  const saveData = useCallback(async (data: MindMapData): Promise<void> => {
    if (!isInitialized || !storageAdapter) return;
    
    try {
      await storageAdapter.saveData(data);
      logger.info(`Data saved successfully to ${config.mode} storage`);
    } catch (saveError) {
      logger.error(`Failed to save data to ${config.mode} storage:`, saveError);
    }
  }, [isInitialized, storageAdapter, config.mode]);

  // 全マップ読み込み
  const loadAllMaps = useCallback(async (): Promise<void> => {
    if (!isInitialized || !storageAdapter) return;
    
    try {
      const savedMaps = await storageAdapter.loadAllMaps();
      if (savedMaps && savedMaps.length > 0) {
        setAllMindMaps(savedMaps);
        logger.info(`Loaded ${savedMaps.length} maps from ${config.mode} storage`);
      } else {
        logger.info(`No saved maps found in ${config.mode} storage`);
        setAllMindMaps([]);
      }
    } catch (loadError) {
      logger.error(`Failed to load maps from ${config.mode} storage:`, loadError);
      setAllMindMaps([]);
    }
  }, [isInitialized, storageAdapter, config.mode]);

  // 全マップ保存
  const saveAllMaps = useCallback(async (maps: MindMapData[]): Promise<void> => {
    if (!isInitialized || !storageAdapter) return;
    
    try {
      await storageAdapter.saveAllMaps(maps);
      logger.info(`Saved ${maps.length} maps to ${config.mode} storage`);
    } catch (saveError) {
      logger.error(`Failed to save maps to ${config.mode} storage:`, saveError);
    }
  }, [isInitialized, storageAdapter, config.mode]);

  // マップをリストに追加
  const addMapToList = useCallback(async (newMap: MindMapData): Promise<void> => {
    if (!isInitialized || !storageAdapter) return;
    
    try {
      await storageAdapter.addMapToList(newMap);
      setAllMindMaps(prevMaps => [...prevMaps, newMap]);
      logger.info(`Added map to list (${config.mode}):`, newMap.title);
    } catch (addError) {
      logger.error(`Failed to add map to list (${config.mode}):`, addError);
    }
  }, [isInitialized, storageAdapter, config.mode]);

  // マップをリストから削除
  const removeMapFromList = useCallback(async (mapId: string): Promise<void> => {
    if (!isInitialized || !storageAdapter) return;
    
    try {
      await storageAdapter.removeMapFromList(mapId);
      setAllMindMaps(prevMaps => prevMaps.filter(map => map.id !== mapId));
      logger.info(`Removed map from list (${config.mode}):`, mapId);
    } catch (removeError) {
      logger.error(`Failed to remove map from list (${config.mode}):`, removeError);
    }
  }, [isInitialized, storageAdapter, config.mode]);

  // マップをリストで更新
  const updateMapInList = useCallback(async (updatedMap: MindMapData): Promise<void> => {
    if (!isInitialized || !storageAdapter) return;
    
    try {
      await storageAdapter.updateMapInList(updatedMap);
      setAllMindMaps(prevMaps => 
        prevMaps.map(map => map.id === updatedMap.id ? updatedMap : map)
      );
      logger.info(`Updated map in list (${config.mode}):`, updatedMap.title);
    } catch (updateError) {
      logger.error(`Failed to update map in list (${config.mode}):`, updateError);
    }
  }, [isInitialized, storageAdapter, config.mode]);

  // 初期化完了時に全マップを読み込み
  useEffect(() => {
    if (isInitialized && storageAdapter) {
      loadAllMaps();
    }
  }, [isInitialized, storageAdapter, loadAllMaps]);


  // マップ一覧を強制リフレッシュする関数
  const refreshMapList = useCallback(async () => {
    if (storageAdapter) {
      await loadAllMaps();
    }
  }, [storageAdapter, loadAllMaps]);

  return {
    // 状態
    allMindMaps,
    isInitialized,
    error,
    storageMode: config.mode,
    
    // 操作
    loadInitialData,
    saveData,
    loadAllMaps,
    refreshMapList,
    saveAllMaps,
    addMapToList,
    removeMapFromList,
    updateMapInList,
    
    // ストレージアダプター（高度な使用のため）
    storageAdapter
  };
};