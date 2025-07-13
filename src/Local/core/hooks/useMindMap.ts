import { useEffect, useCallback } from 'react';
import { useMindMapData } from './useMindMapData';
import { useMindMapUI } from './useMindMapUI';
import { useMindMapActions } from './useMindMapActions';
import { useMindMapPersistence } from './useMindMapPersistence';
import type { StorageConfig } from '../storage/types';

/**
 * 統合MindMapHook - 新しいアーキテクチャ
 * 
 * 専門化されたHookを組み合わせて完全なMindMap機能を提供
 * Single Responsibility Principleに従い、テスタブルで保守しやすい構造
 */
export const useMindMap = (
  isAppReady: boolean = true, 
  storageConfig?: StorageConfig
) => {
  // 専門化されたHookを使用
  const dataHook = useMindMapData();
  const uiHook = useMindMapUI();
  const actionsHook = useMindMapActions();
  const persistenceHook = useMindMapPersistence(storageConfig);

  // 初期データ読み込み（非同期対応）
  useEffect(() => {
    if (isAppReady && !dataHook.data && persistenceHook.isInitialized) {
      const loadData = async () => {
        const initialData = await persistenceHook.loadInitialData();
        dataHook.setData(initialData);
      };
      loadData();
    }
  }, [isAppReady, dataHook.data, dataHook.setData, persistenceHook.isInitialized, persistenceHook.loadInitialData]);

  // データ変更時の自動保存（非同期対応）
  useEffect(() => {
    if (dataHook.data && persistenceHook.isInitialized) {
      // デバウンス付きで保存（500ms）
      const timeoutId = setTimeout(() => {
        if (dataHook.data) {
          persistenceHook.saveData(dataHook.data);
        }
      }, 500);

      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [dataHook.data, persistenceHook.saveData, persistenceHook.isInitialized]);

  // マップ管理の高レベル操作（非同期対応）
  const mapOperations = {
    createAndSelectMap: useCallback(async (title: string, category?: string): Promise<string> => {
      const newMap = actionsHook.createMap(title, category);
      await persistenceHook.addMapToList(newMap);
      actionsHook.selectMap(newMap);
      return newMap.id;
    }, [actionsHook.createMap, actionsHook.selectMap, persistenceHook.addMapToList]),

    selectMapById: useCallback((mapId: string) => {
      const targetMap = persistenceHook.allMindMaps.find(map => map.id === mapId);
      if (targetMap) {
        actionsHook.selectMap(targetMap);
        return true;
      }
      return false;
    }, [persistenceHook.allMindMaps, actionsHook.selectMap]),

    deleteMap: useCallback(async (mapId: string): Promise<void> => {
      await persistenceHook.removeMapFromList(mapId);
      // 現在のマップが削除された場合は新しいマップを作成
      if (dataHook.data?.id === mapId) {
        const newMap = actionsHook.createMap('新しいマインドマップ');
        actionsHook.selectMap(newMap);
      }
    }, [persistenceHook.removeMapFromList, dataHook.data?.id, actionsHook.createMap, actionsHook.selectMap]),

    updateMapMetadata: useCallback(async (mapId: string, updates: { title?: string; category?: string }): Promise<void> => {
      actionsHook.updateMapMetadata(mapId, updates);
      // リストも更新
      if (dataHook.data?.id === mapId) {
        await persistenceHook.updateMapInList(dataHook.data);
      }
    }, [actionsHook.updateMapMetadata, dataHook.data, persistenceHook.updateMapInList])
  };

  // ファイル操作の統合
  const fileOperations = {
    exportCurrentMap: useCallback(() => {
      return actionsHook.exportData();
    }, [actionsHook.exportData]),

    importMap: useCallback(async (jsonData: string): Promise<boolean> => {
      const success = actionsHook.importData(jsonData);
      if (success && dataHook.data) {
        await persistenceHook.addMapToList(dataHook.data);
      }
      return success;
    }, [actionsHook.importData, dataHook.data, persistenceHook.addMapToList])
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
    startEditing: dataHook.startEditing,
    finishEditing: dataHook.finishEditing,
    cancelEditing: dataHook.cancelEditing,
    setEditText: dataHook.setEditText,
    selectNode: dataHook.selectNode,
    setData: dataHook.setData,
    applyAutoLayout: dataHook.applyAutoLayout,

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
    showNodeMapLinks: uiHook.showNodeMapLinks,
    closeNodeMapLinksPanel: uiHook.closeNodeMapLinksPanel,
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