import { useCallback, useEffect, useState } from 'react';
import type { MindMapData } from '@shared/types';
import { createInitialData } from '../../shared/types/dataTypes';
import type { StorageAdapter, StorageConfig } from '../storage/types';
import { createStorageAdapter } from '../storage/StorageAdapterFactory';

// 型検証関数
const isMindMapData = (data: unknown): data is MindMapData => {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'title' in data &&
    'rootNode' in data &&
    typeof (data as { id: unknown; title: unknown }).id === 'string' &&
    typeof (data as { id: unknown; title: unknown }).title === 'string'
  );
};


/**
 * データ永続化に特化したHook
 * 設定可能なストレージアダプターでの保存・読み込みを担当
 */
export const useMindMapPersistence = (config: StorageConfig = { mode: 'local' }) => {
  const [allMindMaps, setAllMindMaps] = useState<MindMapData[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [storageAdapter, setStorageAdapter] = useState<StorageAdapter | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ストレージアダプター初期化
  useEffect(() => {
    const initStorage = async () => {
      try {
        setError(null);
        const adapter = await createStorageAdapter(config);
        setStorageAdapter(adapter);
        setIsInitialized(true);
        console.log(`✅ useMindMapPersistence: ${config.mode} storage initialized`);
      } catch (initError) {
        const errorMessage = initError instanceof Error ? initError.message : 'Storage initialization failed';
        console.error('❌ useMindMapPersistence: Storage initialization failed:', initError);
        setError(errorMessage);
        setIsInitialized(true); // エラーでも初期化完了扱いにして処理を続行
      }
    };
    initStorage();
  }, [config.mode, config.authAdapter]);

  // 初期データ読み込み
  const loadInitialData = useCallback(async (): Promise<MindMapData> => {
    if (!isInitialized || !storageAdapter) {
      // 初期化完了まで待機
      await new Promise(resolve => {
        const checkInit = () => {
          if (isInitialized && storageAdapter) {
            resolve(undefined);
          } else {
            setTimeout(checkInit, 10);
          }
        };
        checkInit();
      });
    }

    if (!storageAdapter) {
      console.warn('Storage adapter not available, creating default data');
      return createInitialData();
    }

    try {
      const savedData = await storageAdapter.loadInitialData();
      if (savedData && isMindMapData(savedData)) {
        console.log(`📋 Loaded saved data from ${config.mode} storage:`, savedData.title);
        return savedData;
      }
    } catch (loadError) {
      console.error(`Failed to load saved data from ${config.mode} storage:`, loadError);
    }
    
    // デフォルトデータを作成して返す
    const initialData = createInitialData();
    console.log('Created initial data:', initialData);
    return initialData;
  }, [isInitialized, storageAdapter, config.mode]);

  // データ保存
  const saveData = useCallback(async (data: MindMapData): Promise<void> => {
    if (!isInitialized || !storageAdapter) return;
    
    try {
      await storageAdapter.saveData(data);
      console.log(`💾 Data saved successfully to ${config.mode} storage`);
    } catch (saveError) {
      console.error(`❌ Failed to save data to ${config.mode} storage:`, saveError);
    }
  }, [isInitialized, storageAdapter, config.mode]);

  // 全マップ読み込み
  const loadAllMaps = useCallback(async (): Promise<void> => {
    if (!isInitialized || !storageAdapter) return;
    
    try {
      const savedMaps = await storageAdapter.loadAllMaps();
      if (savedMaps && savedMaps.length > 0) {
        setAllMindMaps(savedMaps);
        console.log(`📋 Loaded ${savedMaps.length} maps from ${config.mode} storage`);
      } else {
        console.log(`No saved maps found in ${config.mode} storage`);
        setAllMindMaps([]);
      }
    } catch (loadError) {
      console.error(`❌ Failed to load maps from ${config.mode} storage:`, loadError);
      setAllMindMaps([]);
    }
  }, [isInitialized, storageAdapter, config.mode]);

  // 全マップ保存
  const saveAllMaps = useCallback(async (maps: MindMapData[]): Promise<void> => {
    if (!isInitialized || !storageAdapter) return;
    
    try {
      await storageAdapter.saveAllMaps(maps);
      console.log(`💾 Saved ${maps.length} maps to ${config.mode} storage`);
    } catch (saveError) {
      console.error(`❌ Failed to save maps to ${config.mode} storage:`, saveError);
    }
  }, [isInitialized, storageAdapter, config.mode]);

  // マップをリストに追加
  const addMapToList = useCallback(async (newMap: MindMapData): Promise<void> => {
    if (!isInitialized || !storageAdapter) return;
    
    try {
      await storageAdapter.addMapToList(newMap);
      setAllMindMaps(prevMaps => [...prevMaps, newMap]);
      console.log(`📋 Added map to list (${config.mode}):`, newMap.title);
    } catch (addError) {
      console.error(`❌ Failed to add map to list (${config.mode}):`, addError);
    }
  }, [isInitialized, storageAdapter, config.mode]);

  // マップをリストから削除
  const removeMapFromList = useCallback(async (mapId: string): Promise<void> => {
    if (!isInitialized || !storageAdapter) return;
    
    try {
      await storageAdapter.removeMapFromList(mapId);
      setAllMindMaps(prevMaps => prevMaps.filter(map => map.id !== mapId));
      console.log(`🗑️ Removed map from list (${config.mode}):`, mapId);
    } catch (removeError) {
      console.error(`❌ Failed to remove map from list (${config.mode}):`, removeError);
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
      console.log(`📋 Updated map in list (${config.mode}):`, updatedMap.title);
    } catch (updateError) {
      console.error(`❌ Failed to update map in list (${config.mode}):`, updateError);
    }
  }, [isInitialized, storageAdapter, config.mode]);

  // 初期化完了時に全マップを読み込み
  useEffect(() => {
    if (isInitialized && storageAdapter) {
      loadAllMaps();
    }
  }, [isInitialized, storageAdapter, loadAllMaps]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (storageAdapter) {
        storageAdapter.cleanup();
      }
    };
  }, [storageAdapter]);

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