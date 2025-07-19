import { useEffect, useCallback, useRef } from 'react';
import { useMindMapData } from './useMindMapData';
import { useMindMapUI } from './useMindMapUI';
import { useMindMapActions } from './useMindMapActions';
import { useMindMapPersistence } from './useMindMapPersistence';
import type { StorageConfig } from '../storage/types';
import { createInitialData } from '../../shared/types/dataTypes';

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
  
  // リセットキー変更時の強制リセット
  const prevResetKeyRef = useRef(0);
  const pendingResetKeyRef = useRef<number | null>(null);
  useEffect(() => {
    const currentResetKey = resetKey;
    const prevResetKey = prevResetKeyRef.current;
    
    console.log('🔍 useMindMap: Reset key effect triggered', {
      currentResetKey,
      prevResetKey,
      shouldReset: currentResetKey !== prevResetKey,
      persistenceInitialized: persistenceHook.isInitialized
    });
    
    if (currentResetKey !== prevResetKey) {
      console.log('🔄 useMindMap: Reset key changed, forcing data reload:', currentResetKey);
      
      // データ読み込み関数を定義
      const executeDataReload = async () => {
        const reloadData = async () => {
          try {
            console.log('🔄 useMindMap: Clearing data before reset reload...');
            
            // 現在のデータを明示的にクリア（一時的な空のマップで置き換え）
            const tempClearData = createInitialData();
            tempClearData.title = '読み込み中...';
            dataHook.setData(tempClearData);
            
            console.log('💾 useMindMap: Loading data after reset...');
            const initialData = await persistenceHook.loadInitialData();
            console.log('📋 useMindMap: Reset data loaded:', {
              id: initialData.id,
              title: initialData.title,
              resetKey: currentResetKey
            });
            
            dataHook.setData(initialData);
            
            // マップ一覧も再読み込み
            await persistenceHook.refreshMapList();
            
            console.log('✅ useMindMap: Data reloaded after reset:', initialData.title);
          } catch (error) {
            console.error('❌ useMindMap: Failed to reload data after reset:', error);
          }
        };
        reloadData();
      };
      
      // 初期化完了後にデータを読み込み（初期化完了を待機）
      if (persistenceHook.isInitialized) {
        console.log('✅ useMindMap: Persistence already initialized, executing reload immediately');
        executeDataReload();
        pendingResetKeyRef.current = null; // クリア
      } else {
        console.log('⏳ useMindMap: Waiting for persistence initialization before reload...');
        pendingResetKeyRef.current = currentResetKey; // 待機中のリセットキーを記録
      }
    }
    
    // 初期化完了時に待機中のリセットがあれば実行
    if (persistenceHook.isInitialized && pendingResetKeyRef.current !== null && currentResetKey === pendingResetKeyRef.current) {
      console.log('✅ useMindMap: Persistence initialized, executing delayed reload for resetKey:', pendingResetKeyRef.current);
      
      // データ読み込み関数を再定義（既存のexecuteDataReloadと同じ内容）
      const executeDelayedReload = async () => {
        const reloadData = async () => {
          try {
            console.log('🔄 useMindMap: Clearing data before delayed reset reload...');
            
            // 現在のデータを明示的にクリア（一時的な空のマップで置き換え）
            const tempClearData = createInitialData();
            tempClearData.title = '読み込み中...';
            dataHook.setData(tempClearData);
            
            // persistenceHookの初期化を待機
            if (!persistenceHook.isInitialized) {
              console.log('⏳ useMindMap: Waiting for storage initialization...');
              await new Promise<void>((resolve) => {
                const checkInit = () => {
                  if (persistenceHook.isInitialized) {
                    resolve();
                  } else {
                    setTimeout(checkInit, 100);
                  }
                };
                checkInit();
              });
            }
            
            console.log('📥 useMindMap: Loading initial data from new storage (delayed)...');
            const initialData = await persistenceHook.loadInitialData();
            console.log('📋 useMindMap: Delayed reset data loaded:', {
              id: initialData.id,
              title: initialData.title,
              resetKey: pendingResetKeyRef.current
            });
            
            dataHook.setData(initialData);
            
            // マップ一覧も再読み込み
            await persistenceHook.refreshMapList();
            
            console.log('✅ useMindMap: Delayed data reloaded after reset:', initialData.title);
          } catch (error) {
            console.error('❌ useMindMap: Failed to reload delayed data after reset:', error);
          }
        };
        reloadData();
      };
      
      executeDelayedReload();
      pendingResetKeyRef.current = null; // クリア
    }
    
    prevResetKeyRef.current = currentResetKey;
  }, [resetKey, persistenceHook.isInitialized]);
  
  // ストレージ設定変更時の強制再読み込み
  const prevStorageConfigRef = useRef<StorageConfig | null>(storageConfig || null);
  useEffect(() => {
    const currentConfig = storageConfig;
    const prevConfig = prevStorageConfigRef.current;
    
    // ストレージモードが変更されたかチェック
    const modeChanged = currentConfig?.mode !== prevConfig?.mode;
    const authChanged = currentConfig?.authAdapter !== prevConfig?.authAdapter;
    
    console.log('🔍 useMindMap: Storage config change check', {
      prevConfig: prevConfig ? {
        mode: prevConfig.mode,
        hasAuthAdapter: !!prevConfig.authAdapter
      } : 'null',
      currentConfig: currentConfig ? {
        mode: currentConfig.mode,
        hasAuthAdapter: !!currentConfig.authAdapter
      } : 'null',
      modeChanged,
      authChanged,
      persistenceInitialized: persistenceHook.isInitialized
    });
    
    if (modeChanged || authChanged) {
      console.log('🔄 useMindMap: Storage config changed, reloading data:', {
        prevMode: prevConfig?.mode,
        newMode: currentConfig?.mode,
        modeChanged,
        authChanged
      });
      
      // 現在のデータをクリアして新しいストレージから読み込み
      const reloadData = async () => {
        try {
          console.log('🔄 useMindMap: Clearing current data before loading from new storage...');
          
          // 現在のデータを明示的にクリア（一時的な空のマップで置き換え）
          const tempClearData = createInitialData();
          tempClearData.title = '読み込み中...';
          dataHook.setData(tempClearData);
          
          // persistenceHookの初期化を待機
          if (!persistenceHook.isInitialized) {
            console.log('⏳ useMindMap: Waiting for storage initialization...');
            await new Promise<void>((resolve) => {
              const checkInit = () => {
                if (persistenceHook.isInitialized) {
                  resolve();
                } else {
                  setTimeout(checkInit, 100);
                }
              };
              checkInit();
            });
          }
          
          console.log('📥 useMindMap: Loading initial data from new storage...');
          const initialData = await persistenceHook.loadInitialData();
          console.log('📋 useMindMap: New storage data loaded:', {
            id: initialData.id,
            title: initialData.title,
            mode: currentConfig?.mode
          });
          
          dataHook.setData(initialData);
          
          // マップ一覧も再読み込み
          try {
            console.log('🗂️ useMindMap: Refreshing map list...');
            await persistenceHook.refreshMapList();
            console.log('✅ useMindMap: All maps refreshed from new storage');
          } catch (mapError) {
            console.warn('⚠️ useMindMap: Failed to refresh map list:', mapError);
          }
          
          console.log('✅ useMindMap: Data completely reloaded from new storage:', initialData.title);
        } catch (error) {
          console.error('❌ useMindMap: Failed to reload data from new storage:', error);
        }
      };
      reloadData();
    }
    
    prevStorageConfigRef.current = currentConfig || null;
  }, [storageConfig?.mode, storageConfig?.authAdapter]);

  // 手動保存関数 - ノード操作後に明示的に呼び出す
  const saveCurrentMap = useCallback(async () => {
    if (dataHook.data && persistenceHook.isInitialized) {
      try {
        await persistenceHook.saveData(dataHook.data);
        await persistenceHook.updateMapInList(dataHook.data);
        console.log('💾 Manual save completed:', dataHook.data.title);
      } catch (error) {
        console.error('❌ Manual save failed:', error);
      }
    }
  }, [dataHook.data, persistenceHook]);

  // 自動保存のロジック - useRefを使って無限ループを防ぐ
  const lastSaveTimeRef = useRef<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMapIdRef = useRef<string>('');
  
  useEffect(() => {
    const currentData = dataHook.data;
    const currentUpdatedAt = currentData?.updatedAt || '';
    const currentMapId = currentData?.id || '';
    
    // マップが切り替わった場合は保存しない
    if (currentMapId !== lastMapIdRef.current) {
      lastMapIdRef.current = currentMapId;
      lastSaveTimeRef.current = currentUpdatedAt;
      return;
    }
    
    // updatedAtが変更されていない場合は保存しない
    if (currentUpdatedAt === lastSaveTimeRef.current || !currentUpdatedAt) {
      return;
    }
    
    // 既存のタイマーをクリア
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // デバウンス保存
    if (currentData && persistenceHook.isInitialized) {
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await persistenceHook.saveData(currentData);
          await persistenceHook.updateMapInList(currentData);
          console.log('💾 Auto save completed:', currentData.title);
          lastSaveTimeRef.current = currentUpdatedAt;
        } catch (error) {
          console.error('❌ Auto save failed:', error);
        }
      }, 300);
    }
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [dataHook.data?.updatedAt, dataHook.data?.id, persistenceHook.isInitialized]);

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
    
    // 手動保存
    saveCurrentMap,

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