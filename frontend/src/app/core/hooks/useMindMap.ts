import { useCallback } from 'react';
import { useMindMapData } from './useMindMapData';
import { useMindMapUI } from './useMindMapUI';
import { useMindMapActions } from './useMindMapActions';
import { useMindMapPersistence } from './useMindMapPersistence';
import { useInitialDataLoad } from './useInitialDataLoad';
import { useDataReset } from './useDataReset';
import { useStorageConfigChange } from './useStorageConfigChange';
import { useAutoSave } from './useAutoSave';
import type { StorageConfig } from '../storage/types';
import type { MindMapData } from '@shared/types';

/**
 * 統合MindMapHook - 新しいアーキテクチャ
 * 
 * 専門化されたHookを組み合わせて完全なMindMap機能を提供
 * Single Responsibility Principleに従い、テスタブルで保守しやすい構造
 */
export const useMindMap = (
  isAppReady: boolean = true, 
  storageConfig?: StorageConfig,
  resetKey: number = 0
) => {
  // 専門化されたHookを使用
  const dataHook = useMindMapData();
  const uiHook = useMindMapUI();
  const actionsHook = useMindMapActions();
  const persistenceHook = useMindMapPersistence(storageConfig);

  // 各種データ処理を分離されたhookで管理
  useInitialDataLoad(isAppReady, {
    data: dataHook.data,
    setData: dataHook.setData,
    isInitialized: persistenceHook.isInitialized,
    loadInitialData: persistenceHook.loadInitialData
  });

  useDataReset(resetKey, {
    setData: dataHook.setData,
    isInitialized: persistenceHook.isInitialized,
    loadInitialData: persistenceHook.loadInitialData,
    refreshMapList: persistenceHook.refreshMapList
  });

  useStorageConfigChange(storageConfig, {
    setData: dataHook.setData,
    isInitialized: persistenceHook.isInitialized,
    loadInitialData: persistenceHook.loadInitialData,
    refreshMapList: persistenceHook.refreshMapList
  });

  // 自動保存機能
  const { saveManually } = useAutoSave(
    dataHook.data,
    {
      saveData: persistenceHook.saveData,
      updateMapInList: persistenceHook.updateMapInList
    },
    {
      enabled: persistenceHook.isInitialized
    },
    { autoSave: true, autoSaveInterval: 300 } // 自動保存設定
  );

  // マップ管理の高レベル操作（非同期対応）
  const mapOperations = {
    createAndSelectMap: useCallback(async (title: string, category?: string): Promise<string> => {
      const newMap = actionsHook.createMap(title, category);
      await persistenceHook.addMapToList(newMap);
      actionsHook.selectMap(newMap);
      return newMap.id;
    }, [actionsHook, persistenceHook]),

    selectMapById: useCallback((mapId: string) => {
      const targetMap = persistenceHook.allMindMaps.find(map => map.id === mapId);
      if (targetMap) {
        actionsHook.selectMap(targetMap);
        return true;
      }
      return false;
    }, [persistenceHook, actionsHook]),

    deleteMap: useCallback(async (mapId: string): Promise<void> => {
      await persistenceHook.removeMapFromList(mapId);
      // 現在のマップが削除された場合は新しいマップを作成
      if (dataHook.data?.id === mapId) {
        const newMap = actionsHook.createMap('新しいマインドマップ');
        actionsHook.selectMap(newMap);
      }
    }, [persistenceHook, dataHook, actionsHook]),

    updateMapMetadata: useCallback(async (mapId: string, updates: { title?: string; category?: string }): Promise<void> => {
      // 現在選択中のマップの場合のみストアを更新
      if (dataHook.data?.id === mapId) {
        actionsHook.updateMapMetadata(mapId, updates);
      }
      
      // マップリストを常に更新（全マップ中から該当するマップを探して更新）
      const mapToUpdate = persistenceHook.allMindMaps.find(map => map.id === mapId);
      if (mapToUpdate) {
        const updatedMap = {
          ...mapToUpdate,
          ...updates,
          updatedAt: new Date().toISOString()
        };
        await persistenceHook.updateMapInList(updatedMap);
      }
    }, [actionsHook, dataHook, persistenceHook]),

    addImportedMapToList: useCallback(async (mapData: MindMapData): Promise<void> => {
      await persistenceHook.addMapToList(mapData);
    }, [persistenceHook])
  };

  // ファイル操作の統合
  const fileOperations = {
    exportCurrentMap: useCallback(() => {
      return actionsHook.exportData();
    }, [actionsHook]),

    importMap: useCallback(async (jsonData: string): Promise<boolean> => {
      const success = actionsHook.importData(jsonData);
      if (success && dataHook.data) {
        await persistenceHook.addMapToList(dataHook.data);
      }
      return success;
    }, [actionsHook, dataHook, persistenceHook])
  };

  // マップ一覧の初期化状態も返す
  const isReady = persistenceHook.isInitialized;


  return {
    // === 状態 ===
    // データ状態
    data: dataHook.data,
    normalizedData: dataHook.normalizedData,
    selectedNodeId: dataHook.selectedNodeId,
    editingNodeId: dataHook.editingNodeId,
    editText: dataHook.editText,
    editingMode: dataHook.editingMode,
    
    // UI状態
    ui: uiHook.ui,
    
    // 履歴状態
    canUndo: actionsHook.canUndo(),
    canRedo: actionsHook.canRedo(),
    
    // マップ一覧
    allMindMaps: persistenceHook.allMindMaps,
    currentMapId: actionsHook.currentMapId,
    isReady,

    // === 操作 ===
    // データ操作（ノード・編集・選択）
    addNode: dataHook.addNode,
    updateNode: dataHook.updateNode,
    deleteNode: dataHook.deleteNode,
    moveNode: dataHook.moveNode,
    changeSiblingOrder: dataHook.changeSiblingOrder,
    toggleNodeCollapse: dataHook.toggleNodeCollapse,
    startEditing: dataHook.startEditing,
    startEditingWithCursorAtEnd: dataHook.startEditingWithCursorAtEnd,
    startEditingWithCursorAtStart: dataHook.startEditingWithCursorAtStart,
    finishEditing: dataHook.finishEditing,
    cancelEditing: dataHook.cancelEditing,
    setEditText: dataHook.setEditText,
    selectNode: dataHook.selectNode,
    setData: dataHook.setData,
    applyAutoLayout: dataHook.applyAutoLayout,
    
    // 手動保存
    saveCurrentMap: saveManually,

    // UI操作
    setZoom: uiHook.setZoom,
    setPan: uiHook.setPan,
    resetZoom: uiHook.resetZoom,
    setShowCustomizationPanel: uiHook.setShowCustomizationPanel,
    closeAllPanels: uiHook.closeAllPanels,
    toggleSidebar: uiHook.toggleSidebar,
    setSidebarCollapsed: uiHook.setSidebarCollapsed,
    showImageModal: uiHook.showImageModal,
    hideImageModal: uiHook.hideImageModal,
    showCustomization: uiHook.showCustomization,
    showFileActionMenu: uiHook.showFileActionMenu,
    hideFileActionMenu: uiHook.hideFileActionMenu,

    // アクション操作
    undo: actionsHook.undo,
    redo: actionsHook.redo,

    // 高レベルマップ操作
    ...mapOperations,
    
    // ファイル操作
    ...fileOperations
  };
};