import { useCallback, useEffect, useState } from 'react';
import type { MindMapData } from '@shared/types';
import { createInitialData } from '@local/shared/types/dataTypes';

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

const isMindMapDataArray = (data: unknown): data is MindMapData[] => {
  return Array.isArray(data) && data.every(item => isMindMapData(item));
};

/**
 * データ永続化に特化したHook
 * LocalStorageでの保存・読み込みを担当
 */
export const useMindMapPersistence = () => {
  const [allMindMaps, setAllMindMaps] = useState<MindMapData[]>([]);

  // 初期データ読み込み
  const loadInitialData = useCallback((): MindMapData => {
    try {
      const savedData = localStorage.getItem('mindMapData');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        if (isMindMapData(parsedData)) {
          return parsedData;
        } else {
          throw new Error('Invalid MindMapData format');
        }
      }
    } catch (error) {
      console.error('Failed to load saved data:', error);
    }
    
    // デフォルトデータを作成して返す
    const initialData = createInitialData();
    console.log('Created initial data:', initialData);
    return initialData;
  }, []);

  // データ保存
  const saveData = useCallback((data: MindMapData) => {
    try {
      localStorage.setItem('mindMapData', JSON.stringify(data));
      console.log('Data saved successfully');
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  }, []);

  // 全マップ読み込み
  const loadAllMaps = useCallback(() => {
    try {
      const savedMaps = localStorage.getItem('allMindMaps');
      if (savedMaps) {
        const parsedMaps = JSON.parse(savedMaps);
        if (isMindMapDataArray(parsedMaps)) {
          setAllMindMaps(parsedMaps);
          console.log(`Loaded ${parsedMaps.length} maps from storage`);
        } else {
          console.warn('Invalid maps data format');
          setAllMindMaps([]);
        }
      } else {
        console.log('No saved maps found');
        setAllMindMaps([]);
      }
    } catch (error) {
      console.error('Failed to load maps:', error);
      setAllMindMaps([]);
    }
  }, []);

  // 全マップ保存
  const saveAllMaps = useCallback((maps: MindMapData[]) => {
    try {
      localStorage.setItem('allMindMaps', JSON.stringify(maps));
      console.log(`Saved ${maps.length} maps to storage`);
    } catch (error) {
      console.error('Failed to save maps:', error);
    }
  }, []);

  // マップをリストに追加
  const addMapToList = useCallback((newMap: MindMapData) => {
    setAllMindMaps(prevMaps => {
      const updatedMaps = [...prevMaps, newMap];
      saveAllMaps(updatedMaps);
      return updatedMaps;
    });
  }, [saveAllMaps]);

  // マップをリストから削除
  const removeMapFromList = useCallback((mapId: string) => {
    setAllMindMaps(prevMaps => {
      const updatedMaps = prevMaps.filter(map => map.id !== mapId);
      saveAllMaps(updatedMaps);
      return updatedMaps;
    });
  }, [saveAllMaps]);

  // マップをリストで更新
  const updateMapInList = useCallback((updatedMap: MindMapData) => {
    setAllMindMaps(prevMaps => {
      const updatedMaps = prevMaps.map(map => 
        map.id === updatedMap.id ? updatedMap : map
      );
      saveAllMaps(updatedMaps);
      return updatedMaps;
    });
  }, [saveAllMaps]);

  // 初期化時に全マップを読み込み
  useEffect(() => {
    loadAllMaps();
  }, [loadAllMaps]);

  // 全マップの変更を監視して保存
  useEffect(() => {
    if (allMindMaps.length > 0) {
      saveAllMaps(allMindMaps);
    }
  }, [allMindMaps, saveAllMaps]);

  return {
    // 状態
    allMindMaps,
    
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