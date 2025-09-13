import { useCallback } from 'react';
import { useMindMapStore } from '../store/mindMapStore';
import { createInitialData } from '../../shared/types/dataTypes';
import type { MindMapData } from '@shared/types';
import { logger } from '../../shared/utils/logger';

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
      newMap.category = category || '';
      newMap.createdAt = new Date().toISOString();
      newMap.updatedAt = new Date().toISOString();
      
      // rootNodeのテキストもマップタイトルに合わせる
      newMap.rootNode.text = title;
      
      logger.debug('Created new map:', newMap);
      return newMap;
    }, []),

    // マップ選択
    selectMap: useCallback((mapData: MindMapData) => {
      store.setData(mapData);
      logger.debug('Selected map:', mapData.title);
    }, [store]),

    // マップ削除（データから）
    deleteMapData: useCallback(() => {
      const currentData = store.data;
      if (currentData) {
        logger.debug('Deleting map:', currentData.title);
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
      
      logger.debug('Duplicated map:', duplicatedMap.title);
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
        logger.debug('Updated map metadata:', updates);
      }
    }, [store])
  };

  const historyActions = {
    // 履歴操作
    undo: useCallback(async () => {
      if (store.canUndo()) {
        store.undo();
        logger.debug('Undo performed');
      }
    }, [store]),

    redo: useCallback(async () => {
      if (store.canRedo()) {
        store.redo();
        logger.debug('Redo performed');
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
        
        // データの妥当性検証
        if (!parsedData || typeof parsedData !== 'object') {
          return false;
        }
        
        // MindMapDataの必要な属性をチェック
        if (!('id' in parsedData) || !('title' in parsedData) || !('rootNode' in parsedData)) {
          return false;
        }
        
        // 型安全性を保つため、明示的にチェック
        const { id, title, rootNode } = parsedData;
        if (typeof id !== 'string' || typeof title !== 'string' || !rootNode) {
          return false;
        }
        
        store.setData(parsedData as MindMapData);
        return true;
      } catch (error) {
        logger.error('Failed to import data:', error);
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