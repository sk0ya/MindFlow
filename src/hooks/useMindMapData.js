// 新しいDataManagerベースのデータ管理フック
import { useState, useEffect, useRef, useCallback } from 'react';
import { dataManager } from '../utils/dataManager.js';
import { getCurrentMindMap, saveMindMap } from '../utils/storageRouter.js';
import { getAppSettings } from '../utils/storage.js';
import { deepClone, assignColorsToExistingNodes, createInitialData } from '../utils/dataTypes.js';

export const useMindMapData = (isAppReady = false) => {
  const [data, setData] = useState(null);
  const [isLoadingFromCloud, setIsLoadingFromCloud] = useState(false);
  const [syncStatus, setSyncStatus] = useState(dataManager.getSyncStatus());
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const syncStatusInterval = useRef(null);
  
  // DataManagerの状態更新コールバック
  const handleDataManagerUpdate = useCallback((updatedData) => {
    console.log('📊 DataManagerからデータ更新通知', updatedData.id);
    setData(updatedData);
    
    // 履歴に追加（操作によっては除外する場合もある）
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(deepClone(updatedData));
      return newHistory.slice(-50); // 最大50件保持
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);
  
  // 同期状態の監視
  useEffect(() => {
    syncStatusInterval.current = setInterval(() => {
      setSyncStatus(dataManager.getSyncStatus());
    }, 1000);
    
    return () => {
      if (syncStatusInterval.current) {
        clearInterval(syncStatusInterval.current);
      }
    };
  }, []);
  
  // アプリ準備完了時のデータ初期化
  useEffect(() => {
    if (!isAppReady || data !== null) return;

    const initializeData = async () => {
      console.log('🚀 DataV2: データ初期化開始 (isAppReady: true)');
      const settings = getAppSettings();
      
      if (settings.storageMode === 'local') {
        // ローカルモード: データを初期化
        const mindMap = getCurrentMindMap();
        if (mindMap) {
          console.log('📁 ローカルモード: 既存データ読み込み');
          const processedData = assignColorsToExistingNodes(mindMap);
          await dataManager.initializeData(processedData);
          setData(processedData);
        } else {
          console.log('📁 ローカルモード: 新規マップ作成');
          const newData = createInitialData();
          await dataManager.initializeData(newData);
          setData(newData);
        }
        console.log('📁 ローカルモード: 初期化完了');
        
      } else if (settings.storageMode === 'cloud') {
        // クラウドモード: 認証状態をチェックして同期
        await initializeFromCloud();
      } else {
        // フォールバック
        console.log('❓ 設定不明: デフォルトデータ');
        const newData = createInitialData();
        await dataManager.initializeData(newData);
        setData(newData);
      }
    };

    initializeData();
  }, [isAppReady, data]);
  
  // クラウド同期処理（統一）
  const initializeFromCloud = async () => {
    try {
      setIsLoadingFromCloud(true);
      
      // 認証状態を確認
      const { authManager } = await import('../utils/authManager.js');
      if (!authManager.isAuthenticated()) {
        console.log('⏳ 未認証: クラウド同期を待機');
        return;
      }
      
      console.log('🔄 認証済み: クラウド同期開始');
      
      // クラウドからマインドマップ一覧を取得
      const { getAllMindMaps } = await import('../utils/storageRouter.js');
      const cloudMaps = await getAllMindMaps();
      
      if (cloudMaps && cloudMaps.length > 0) {
        // 既存データを読み込み
        const latestMap = cloudMaps.sort((a, b) => 
          new Date(b.updatedAt) - new Date(a.updatedAt)
        )[0];
        
        console.log('📥 最新のクラウドマップを読み込み:', latestMap.title);
        const { getMindMap } = await import('../utils/storageRouter.js');
        const fullMapData = await getMindMap(latestMap.id);
        
        if (fullMapData) {
          const processedData = assignColorsToExistingNodes(fullMapData);
          await dataManager.initializeData(processedData);
          setData(processedData);
          console.log('✅ クラウド同期完了');
        }
      } else {
        // 新規マップを作成
        console.log('📭 クラウドにマップなし: 新規作成');
        const newMap = createInitialData();
        newMap.title = '新しいマインドマップ';
        await dataManager.initializeData(newMap);
        setData(newMap);
        
        // クラウドに保存
        try {
          await dataManager.executeOperation(
            dataManager.OPERATION_TYPES.METADATA_UPDATE,
            { title: newMap.title },
            { onLocalUpdate: handleDataManagerUpdate }
          );
          console.log('✅ 新規マップのクラウド保存完了');
        } catch (saveError) {
          console.warn('❌ 新規マップ保存失敗:', saveError);
        }
      }
    } catch (error) {
      console.warn('❌ クラウド同期失敗:', error);
      // エラー時は新規マップで開始
      const newMap = createInitialData();
      await dataManager.initializeData(newMap);
      setData(newMap);
    } finally {
      setIsLoadingFromCloud(false);
    }
  };
  
  // 認証成功時のクラウド同期トリガー
  const triggerCloudSync = async () => {
    const { isCloudStorageEnabled } = await import('../utils/storageRouter.js');
    if (isCloudStorageEnabled() && data?.isPlaceholder) {
      console.log('🔑 認証成功: クラウド同期をトリガー');
      await initializeFromCloud();
    }
  };
  
  // 新しい操作メソッド（DataManagerベース）
  const updateNodeText = useCallback(async (nodeId, text) => {
    return dataManager.executeOperation(
      dataManager.OPERATION_TYPES.TEXT_EDIT,
      { nodeId, text },
      { onLocalUpdate: handleDataManagerUpdate }
    );
  }, [handleDataManagerUpdate]);
  
  const addNode = useCallback(async (parentId, nodeData, position = null) => {
    return dataManager.executeOperation(
      dataManager.OPERATION_TYPES.NODE_ADD,
      { parentId, nodeData, position },
      { onLocalUpdate: handleDataManagerUpdate }
    );
  }, [handleDataManagerUpdate]);
  
  const deleteNode = useCallback(async (nodeId) => {
    return dataManager.executeOperation(
      dataManager.OPERATION_TYPES.NODE_DELETE,
      { nodeId },
      { onLocalUpdate: handleDataManagerUpdate }
    );
  }, [handleDataManagerUpdate]);
  
  const moveNode = useCallback(async (nodeId, newX, newY, newParentId = null) => {
    return dataManager.executeOperation(
      dataManager.OPERATION_TYPES.NODE_MOVE,
      { nodeId, newX, newY, newParentId },
      { onLocalUpdate: handleDataManagerUpdate }
    );
  }, [handleDataManagerUpdate]);
  
  const attachFile = useCallback(async (nodeId, fileData) => {
    return dataManager.executeOperation(
      dataManager.OPERATION_TYPES.FILE_ATTACH,
      { nodeId, fileData },
      { onLocalUpdate: handleDataManagerUpdate }
    );
  }, [handleDataManagerUpdate]);
  
  const removeFile = useCallback(async (nodeId, fileId) => {
    return dataManager.executeOperation(
      dataManager.OPERATION_TYPES.FILE_REMOVE,
      { nodeId, fileId },
      { onLocalUpdate: handleDataManagerUpdate }
    );
  }, [handleDataManagerUpdate]);
  
  const updateLayout = useCallback(async (layout) => {
    return dataManager.executeOperation(
      dataManager.OPERATION_TYPES.LAYOUT_CHANGE,
      { layout },
      { onLocalUpdate: handleDataManagerUpdate }
    );
  }, [handleDataManagerUpdate]);
  
  // 既存互換メソッド
  const updateData = useCallback(async (newData, options = {}) => {
    // 旧式のupdateDataとの互換性維持
    console.log('⚠️ 旧式updateData使用 - DataManagerに移行推奨');
    
    if (data?.isPlaceholder) {
      console.log('⏳ プレースホルダー中: データ更新をスキップ');
      return;
    }
    
    // DataManagerを通さず直接更新（非推奨）
    setData(newData);
    
    if (!options.skipHistory) {
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(deepClone(newData));
        return newHistory.slice(-50);
      });
      setHistoryIndex(prev => Math.min(prev + 1, 49));
    }
    
    // 保存処理
    if (options.saveImmediately) {
      try {
        await saveMindMap(newData);
        console.log('💾 緊急保存完了:', newData.title);
      } catch (error) {
        console.warn('⚠️ 緊急保存失敗:', error.message);
      }
    }
  }, [data, historyIndex]);
  
  // Undo/Redo
  const undo = async () => {
    if (historyIndex > 0) {
      const previousData = history[historyIndex - 1];
      await dataManager.initializeData(previousData);
      setData(previousData);
      setHistoryIndex(prev => prev - 1);
    }
  };

  const redo = async () => {
    if (historyIndex < history.length - 1) {
      const nextData = history[historyIndex + 1];
      await dataManager.initializeData(nextData);
      setData(nextData);
      setHistoryIndex(prev => prev + 1);
    }
  };
  
  // 設定・メタデータ更新
  const updateSettings = useCallback(async (newSettings) => {
    return dataManager.executeOperation(
      dataManager.OPERATION_TYPES.METADATA_UPDATE,
      { settings: { ...data.settings, ...newSettings } },
      { onLocalUpdate: handleDataManagerUpdate }
    );
  }, [data, handleDataManagerUpdate]);

  const updateTitle = useCallback(async (newTitle) => {
    return dataManager.executeOperation(
      dataManager.OPERATION_TYPES.METADATA_UPDATE,
      { title: newTitle },
      { onLocalUpdate: handleDataManagerUpdate }
    );
  }, [handleDataManagerUpdate]);

  const changeTheme = useCallback(async (themeName) => {
    return dataManager.executeOperation(
      dataManager.OPERATION_TYPES.METADATA_UPDATE,
      { theme: themeName },
      { onLocalUpdate: handleDataManagerUpdate }
    );
  }, [handleDataManagerUpdate]);
  
  // 強制同期
  const forceSync = useCallback(async () => {
    try {
      await dataManager.processPendingOperations();
      console.log('✅ 強制同期完了');
    } catch (error) {
      console.error('❌ 強制同期失敗:', error);
    }
  }, []);
  
  // 初期化時に履歴を設定
  useEffect(() => {
    if (data && history.length === 0) {
      setHistory([deepClone(data)]);
      setHistoryIndex(0);
    }
  }, [data, history.length]);

  return {
    // データとステート
    data,
    setData,
    isLoadingFromCloud,
    syncStatus,
    
    // 新しい操作メソッド（DataManagerベース）
    updateNodeText,
    addNode,
    deleteNode,
    moveNode,
    attachFile,
    removeFile,
    updateLayout,
    
    // メタデータ操作
    updateSettings,
    updateTitle,
    changeTheme,
    
    // 履歴操作
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    
    // 同期操作
    forceSync,
    triggerCloudSync,
    
    // 旧式互換（非推奨）
    updateData,
    saveMindMap: async () => {
      console.warn('⚠️ 旧式saveMindMap使用 - forceSync推奨');
      await forceSync();
    },
    
    // デバッグ用
    dataManager
  };
};