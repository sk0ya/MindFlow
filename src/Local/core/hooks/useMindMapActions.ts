import { useCallback } from 'react';
import { useMindMapStore } from '../store/mindMapStore';
import { createInitialData } from '@local/shared/types/dataTypes';
import type { MindMapData } from '@shared/types';

/**
 * 高レベルアクションに特化したHook
 * マップ管理、履歴操作等の複合的な操作を担当
 */
export const useMindMapActions = () => {
  const store = useMindMapStore();

  const mapActions = {
    // マップ作成
    createMap: useCallback((title: string, category?: string): MindMapData => {
      const newMap = createInitialData();
      newMap.id = `map_${Date.now()}`;
      newMap.title = title;
      newMap.category = category || '未分類';
      newMap.createdAt = new Date().toISOString();
      newMap.updatedAt = new Date().toISOString();
      
      console.log('Created new map:', newMap);
      return newMap;
    }, []),

    // マップ選択
    selectMap: useCallback((mapData: MindMapData) => {
      store.setData(mapData);
      console.log('Selected map:', mapData.title);
    }, [store]),

    // マップ削除（データから）
    deleteMapData: useCallback(() => {
      const currentData = store.data;
      if (currentData) {
        console.log('Deleting map:', currentData.title);
        // 新しい空のマップを作成
        const newMap = createInitialData();
        store.setData(newMap);
      }
    }, [store]),

    // マップ複製
    duplicateMap: useCallback((sourceMap: MindMapData, newTitle?: string): MindMapData => {
      const duplicatedMap = {
        ...sourceMap,
        id: `map_${Date.now()}`,
        title: newTitle || `${sourceMap.title} (複製)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      console.log('Duplicated map:', duplicatedMap.title);
      return duplicatedMap;
    }, []),

    // マップのメタデータ更新
    updateMapMetadata: useCallback((id: string, updates: Partial<Pick<MindMapData, 'title' | 'category'>>) => {
      const currentData = store.data;
      if (currentData && currentData.id === id) {
        const updatedData = {
          ...currentData,
          ...updates,
          updatedAt: new Date().toISOString()
        };
        store.setData(updatedData);
        console.log('Updated map metadata:', updates);
      }
    }, [store])
  };

  const historyActions = {
    // 履歴操作
    undo: useCallback(async () => {
      if (store.canUndo()) {
        store.undo();
        console.log('Undo performed');
      }
    }, [store]),

    redo: useCallback(async () => {
      if (store.canRedo()) {
        store.redo();
        console.log('Redo performed');
      }
    }, [store]),

    // 履歴状態
    canUndo: useCallback(() => store.canUndo(), [store]),
    canRedo: useCallback(() => store.canRedo(), [store])
  };

  const fileActions = {
    // ファイル操作（基本的なラッパー）
    exportData: useCallback((): string => {
      const currentData = store.data;
      if (currentData) {
        return JSON.stringify(currentData, null, 2);
      }
      return '';
    }, [store]),

    importData: useCallback((jsonData: string): boolean => {
      try {
        const parsedData = JSON.parse(jsonData);
        if (parsedData && typeof parsedData === 'object' && 'id' in parsedData) {
          store.setData(parsedData as MindMapData);
          console.log('Data imported successfully');
          return true;
        }
        return false;
      } catch (error) {
        console.error('Failed to import data:', error);
        return false;
      }
    }, [store])
  };

  return {
    // 状態
    currentMapId: store.data?.id || null,
    
    // マップ操作
    ...mapActions,
    
    // 履歴操作
    ...historyActions,
    
    // ファイル操作
    ...fileActions
  };
};