import { useCallback, useEffect, useState } from 'react';
import type { MindMapData } from '@shared/types';
import { createInitialData } from '@local/shared/types/dataTypes';
import {
  initLocalIndexedDB,
  saveCurrentMapToIndexedDB,
  getCurrentMapFromIndexedDB,
  saveMindMapToIndexedDB,
  getAllMindMapsFromIndexedDB,
  removeMindMapFromIndexedDB
} from '../utils/indexedDB';

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
 * IndexedDBでの保存・読み込みを担当
 */
export const useMindMapPersistence = () => {
  const [allMindMaps, setAllMindMaps] = useState<MindMapData[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // IndexedDB初期化
  useEffect(() => {
    const initDB = async () => {
      try {
        await initLocalIndexedDB();
        setIsInitialized(true);
        console.log('✅ useMindMapPersistence: IndexedDB initialized');
      } catch (error) {
        console.error('❌ useMindMapPersistence: IndexedDB initialization failed:', error);
        setIsInitialized(true); // エラーでも初期化完了扱いにして処理を続行
      }
    };
    initDB();
  }, []);

  // 初期データ読み込み
  const loadInitialData = useCallback(async (): Promise<MindMapData> => {
    if (!isInitialized) {
      // 初期化完了まで待機
      await new Promise(resolve => {
        const checkInit = () => {
          if (isInitialized) {
            resolve(undefined);
          } else {
            setTimeout(checkInit, 10);
          }
        };
        checkInit();
      });
    }

    try {
      const savedData = await getCurrentMapFromIndexedDB();
      if (savedData && isMindMapData(savedData)) {
        console.log('📋 Loaded saved data from IndexedDB:', savedData.title);
        return savedData;
      }
    } catch (error) {
      console.error('Failed to load saved data from IndexedDB:', error);
    }
    
    // デフォルトデータを作成して返す
    const initialData = createInitialData();
    console.log('Created initial data:', initialData);
    return initialData;
  }, [isInitialized]);

  // データ保存
  const saveData = useCallback(async (data: MindMapData): Promise<void> => {
    if (!isInitialized) return;
    
    try {
      await saveCurrentMapToIndexedDB(data);
      console.log('💾 Data saved successfully to IndexedDB');
    } catch (error) {
      console.error('❌ Failed to save data to IndexedDB:', error);
    }
  }, [isInitialized]);

  // 全マップ読み込み
  const loadAllMaps = useCallback(async (): Promise<void> => {
    if (!isInitialized) return;
    
    try {
      const savedMaps = await getAllMindMapsFromIndexedDB();
      if (savedMaps && savedMaps.length > 0) {
        // _metadataを除去してMindMapData[]に変換
        const cleanMaps: MindMapData[] = savedMaps.map(({ _metadata, ...map }) => map);
        setAllMindMaps(cleanMaps);
        console.log(`📋 Loaded ${cleanMaps.length} maps from IndexedDB`);
      } else {
        console.log('No saved maps found in IndexedDB');
        setAllMindMaps([]);
      }
    } catch (error) {
      console.error('❌ Failed to load maps from IndexedDB:', error);
      setAllMindMaps([]);
    }
  }, [isInitialized]);

  // 全マップ保存（IndexedDBでは個別保存なので、内部的には各マップを個別保存）
  const saveAllMaps = useCallback(async (maps: MindMapData[]): Promise<void> => {
    if (!isInitialized) return;
    
    try {
      // 各マップを個別にIndexedDBに保存
      await Promise.all(maps.map(map => saveMindMapToIndexedDB(map)));
      console.log(`💾 Saved ${maps.length} maps to IndexedDB`);
    } catch (error) {
      console.error('❌ Failed to save maps to IndexedDB:', error);
    }
  }, [isInitialized]);

  // マップをリストに追加
  const addMapToList = useCallback(async (newMap: MindMapData): Promise<void> => {
    if (!isInitialized) return;
    
    try {
      await saveMindMapToIndexedDB(newMap);
      setAllMindMaps(prevMaps => [...prevMaps, newMap]);
      console.log('📋 Added map to list:', newMap.title);
    } catch (error) {
      console.error('❌ Failed to add map to list:', error);
    }
  }, [isInitialized]);

  // マップをリストから削除
  const removeMapFromList = useCallback(async (mapId: string): Promise<void> => {
    if (!isInitialized) return;
    
    try {
      await removeMindMapFromIndexedDB(mapId);
      setAllMindMaps(prevMaps => prevMaps.filter(map => map.id !== mapId));
      console.log('🗑️ Removed map from list:', mapId);
    } catch (error) {
      console.error('❌ Failed to remove map from list:', error);
    }
  }, [isInitialized]);

  // マップをリストで更新
  const updateMapInList = useCallback(async (updatedMap: MindMapData): Promise<void> => {
    if (!isInitialized) return;
    
    try {
      await saveMindMapToIndexedDB(updatedMap);
      setAllMindMaps(prevMaps => 
        prevMaps.map(map => map.id === updatedMap.id ? updatedMap : map)
      );
      console.log('📋 Updated map in list:', updatedMap.title);
    } catch (error) {
      console.error('❌ Failed to update map in list:', error);
    }
  }, [isInitialized]);

  // 初期化完了時に全マップを読み込み
  useEffect(() => {
    if (isInitialized) {
      loadAllMaps();
    }
  }, [isInitialized, loadAllMaps]);

  return {
    // 状態
    allMindMaps,
    isInitialized,
    
    // 操作
    loadInitialData,
    saveData,
    loadAllMaps,
    saveAllMaps,
    addMapToList,
    removeMapFromList,
    updateMapInList
  };
};