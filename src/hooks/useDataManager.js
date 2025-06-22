// DataManagerを使用するReactフック
import { useState, useEffect, useCallback, useRef } from 'react';
import { dataManager } from '../utils/dataManager.js';
import { createInitialData } from '../utils/dataTypes.js';

export const useDataManager = (initialData = null) => {
  const [data, setData] = useState(initialData);
  const [syncStatus, setSyncStatus] = useState(dataManager.getSyncStatus());
  const [isLoading, setIsLoading] = useState(false);
  const syncStatusInterval = useRef(null);
  
  // DataManagerの初期化
  useEffect(() => {
    const initializeManager = async () => {
      if (initialData) {
        await dataManager.initializeData(initialData);
        setData(initialData);
      } else {
        const defaultData = createInitialData();
        await dataManager.initializeData(defaultData);
        setData(defaultData);
      }
    };
    
    initializeManager();
  }, [initialData]);
  
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
  
  // ローカル状態更新のコールバック
  const handleLocalUpdate = useCallback((updatedData) => {
    setData(updatedData);
  }, []);
  
  // 操作実行のヘルパー
  const executeOperation = useCallback(async (operationType, payload) => {
    setIsLoading(true);
    try {
      const result = await dataManager.executeOperation(operationType, payload, {
        onLocalUpdate: handleLocalUpdate
      });
      
      if (!result.success) {
        console.error('操作失敗:', result.error);
        // 必要に応じてエラーハンドリング
      }
      
      return result;
    } catch (error) {
      console.error('操作エラー:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [handleLocalUpdate]);
  
  // 具体的な操作メソッド
  const updateNodeText = useCallback(async (nodeId, text) => {
    return executeOperation(dataManager.OPERATION_TYPES.TEXT_EDIT, {
      nodeId,
      text
    });
  }, [executeOperation]);
  
  const addNode = useCallback(async (parentId, nodeData, position = null) => {
    return executeOperation(dataManager.OPERATION_TYPES.NODE_ADD, {
      parentId,
      nodeData,
      position
    });
  }, [executeOperation]);
  
  const deleteNode = useCallback(async (nodeId) => {
    return executeOperation(dataManager.OPERATION_TYPES.NODE_DELETE, {
      nodeId
    });
  }, [executeOperation]);
  
  const moveNode = useCallback(async (nodeId, newX, newY, newParentId = null) => {
    return executeOperation(dataManager.OPERATION_TYPES.NODE_MOVE, {
      nodeId,
      newX,
      newY,
      newParentId
    });
  }, [executeOperation]);
  
  const attachFile = useCallback(async (nodeId, fileData) => {
    return executeOperation(dataManager.OPERATION_TYPES.FILE_ATTACH, {
      nodeId,
      fileData
    });
  }, [executeOperation]);
  
  const removeFile = useCallback(async (nodeId, fileId) => {
    return executeOperation(dataManager.OPERATION_TYPES.FILE_REMOVE, {
      nodeId,
      fileId
    });
  }, [executeOperation]);
  
  const updateLayout = useCallback(async (layout) => {
    return executeOperation(dataManager.OPERATION_TYPES.LAYOUT_CHANGE, {
      layout
    });
  }, [executeOperation]);
  
  const updateMetadata = useCallback(async (updates) => {
    return executeOperation(dataManager.OPERATION_TYPES.METADATA_UPDATE, updates);
  }, [executeOperation]);
  
  // 強制同期
  const forcSync = useCallback(async () => {
    setIsLoading(true);
    try {
      await dataManager.processPendingOperations();
    } catch (error) {
      console.error('強制同期エラー:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // 現在のデータを強制取得
  const refreshData = useCallback(() => {
    const currentData = dataManager.getCurrentData();
    if (currentData) {
      setData(currentData);
    }
  }, []);
  
  return {
    // データとステート
    data,
    syncStatus,
    isLoading,
    
    // 操作メソッド
    updateNodeText,
    addNode,
    deleteNode,
    moveNode,
    attachFile,
    removeFile,
    updateLayout,
    updateMetadata,
    
    // 制御メソッド
    forcSync,
    refreshData,
    
    // 直接アクセス（高度な使用）
    executeOperation,
    dataManager
  };
};