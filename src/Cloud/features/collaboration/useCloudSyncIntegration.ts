import { useEffect, useCallback } from 'react';
import { useCloudSync } from '../../hooks/useCloudSync.js';
import { authManager } from '../auth/authManager.js';

/**
 * useCloudSyncIntegration - 既存フックとクラウド同期の統合
 * 既存のuseMindMapData, useMindMapNodesとクラウド同期を連携
 */
export const useCloudSyncIntegration = (
  data: any,
  updateData: Function,
  _selectedNodeId: string | null,
  currentMapId: string | null
) => {
  const isCloudMode = authManager.isAuthenticated();
  
  // クラウド同期設定
  const cloudSyncConfig = {
    apiBaseUrl: '/api', // Default API base URL
    websocketUrl: 'wss://api.mindflow.com/ws', // Default WebSocket URL
    authToken: authManager.getAuthToken()
  };

  // クラウド同期フック（クラウドモードの場合のみ有効化）
  const cloudSync = useCloudSync(
    isCloudMode ? (currentMapId || '') : '',
    isCloudMode ? cloudSyncConfig as any : undefined
  );

  // ===== 既存操作とクラウド同期の統合 =====

  /**
   * ノード作成の統合
   */
  const integratedCreateNode = useCallback(async (nodeData: any) => {
    try {
      // ローカル状態を即座に更新（楽観的更新）
      const localUpdate = (currentData: any) => {
        if (!currentData?.rootNode) return currentData;
        
        // ローカルでノードを追加
        return addNodeToLocalState(currentData, nodeData);
      };
      
      updateData(localUpdate);

      // クラウドモードの場合は同期
      if (isCloudMode && cloudSync.isInitialized) {
        await cloudSync.createNode(nodeData);
      }

    } catch (error) {
      console.error('Node creation failed:', error);
      // エラー時はローカル状態をロールバック
      rollbackLocalState(nodeData.id);
    }
  }, [isCloudMode, cloudSync, updateData]);

  /**
   * ノード更新の統合
   */
  const integratedUpdateNode = useCallback(async (nodeId: string, updates: any) => {
    try {
      // ローカル状態を即座に更新
      const localUpdate = (currentData: any) => {
        if (!currentData?.rootNode) return currentData;
        return updateNodeInLocalState(currentData, nodeId, updates);
      };
      
      updateData(localUpdate);

      // クラウドモードの場合は同期
      if (isCloudMode && cloudSync.isInitialized) {
        await cloudSync.updateNode(nodeId, updates);
      }

    } catch (error) {
      console.error('Node update failed:', error);
      // エラー時はローカル状態をロールバック
      rollbackNodeUpdate(nodeId, updates);
    }
  }, [isCloudMode, cloudSync, updateData]);

  /**
   * ノード削除の統合
   */
  const integratedDeleteNode = useCallback(async (nodeId: string) => {
    try {
      // 削除前の状態を保存（ロールバック用）
      // const _nodeToDelete = findNodeById(data?.rootNode, nodeId);
      
      // ローカル状態を即座に更新
      const localUpdate = (currentData: any) => {
        if (!currentData?.rootNode) return currentData;
        return deleteNodeFromLocalState(currentData, nodeId);
      };
      
      updateData(localUpdate);

      // クラウドモードの場合は同期
      if (isCloudMode && cloudSync.isInitialized) {
        await cloudSync.deleteNode(nodeId);
      }

    } catch (error) {
      console.error('Node deletion failed:', error);
      // エラー時はローカル状態をロールバック
      rollbackNodeDeletion(nodeId);
    }
  }, [isCloudMode, cloudSync, updateData, data]);

  /**
   * ノード移動の統合
   */
  const integratedMoveNode = useCallback(async (nodeId: string, newPosition: any) => {
    try {
      // ローカル状態を即座に更新
      const localUpdate = (currentData: any) => {
        if (!currentData?.rootNode) return currentData;
        return moveNodeInLocalState(currentData, nodeId, newPosition);
      };
      
      updateData(localUpdate);

      // クラウドモードの場合は同期
      if (isCloudMode && cloudSync.isInitialized) {
        await cloudSync.moveNode(nodeId, newPosition);
      }

    } catch (error) {
      console.error('Node move failed:', error);
      // エラー時はローカル状態をロールバック
      rollbackNodeMove(nodeId, newPosition);
    }
  }, [isCloudMode, cloudSync, updateData]);

  // ===== リアルタイム協調編集の統合 =====

  /**
   * 編集状態の通知
   */
  const notifyEditingState = useCallback((nodeId: string, isEditing: boolean) => {
    if (isCloudMode && cloudSync.isInitialized) {
      if (isEditing) {
        cloudSync.startEditing(nodeId);
      } else {
        cloudSync.endEditing(nodeId);
      }
    }
  }, [isCloudMode, cloudSync]);

  /**
   * カーソル位置の共有
   */
  const shareCursorPosition = useCallback((position: { x: number, y: number, nodeId?: string }) => {
    if (isCloudMode && cloudSync.isInitialized) {
      cloudSync.updateCursor(position);
    }
  }, [isCloudMode, cloudSync]);

  // ===== リモート操作の受信処理 =====

  useEffect(() => {
    if (!isCloudMode || !cloudSync.isInitialized) return;

    // リモート操作の適用
    const handleRemoteOperation = (operation: any) => {
      console.log('🌐 Applying remote operation:', operation);

      switch (operation.operation_type) {
        case 'create':
          applyRemoteNodeCreation(operation);
          break;
        case 'update':
          applyRemoteNodeUpdate(operation);
          break;
        case 'delete':
          applyRemoteNodeDeletion(operation);
          break;
        case 'move':
          applyRemoteNodeMove(operation);
          break;
        default:
          console.warn('Unknown remote operation type:', operation.operation_type);
      }
    };

    // 競合解決の処理
    const handleConflictResolution = (conflictInfo: any) => {
      console.log('⚔️ Conflict resolved:', conflictInfo);
      
      // 必要に応じてUI通知
      if (conflictInfo.hasSignificantConflict) {
        showConflictNotification(conflictInfo);
      }
    };

    // イベントリスナー登録
    const unsubscribeOperation = cloudSync.onRealtimeEvent('operation_applied', handleRemoteOperation);
    const unsubscribeConflict = cloudSync.onRealtimeEvent('conflict_resolved', handleConflictResolution);

    return () => {
      unsubscribeOperation();
      unsubscribeConflict();
    };
  }, [isCloudMode, cloudSync.isInitialized]);

  // ===== ローカル状態操作ヘルパー =====

  const addNodeToLocalState = (currentData: any, nodeData: any) => {
    // 実装: ローカルデータ構造にノードを追加
    const newData = { ...currentData };
    
    if (nodeData.parent_id) {
      // 親ノードに子として追加
      const parentNode = findNodeById(newData.rootNode, nodeData.parent_id);
      if (parentNode) {
        if (!parentNode.children) parentNode.children = [];
        parentNode.children.push({
          id: nodeData.id,
          text: nodeData.text || '',
          x: nodeData.x || 0,
          y: nodeData.y || 0,
          children: []
        });
      }
    } else {
      // ルートノードとして設定
      newData.rootNode = {
        id: nodeData.id,
        text: nodeData.text || '',
        x: nodeData.x || 0,
        y: nodeData.y || 0,
        children: []
      };
    }
    
    return newData;
  };

  const updateNodeInLocalState = (currentData: any, nodeId: string, updates: any) => {
    const newData = { ...currentData };
    const node = findNodeById(newData.rootNode, nodeId);
    
    if (node) {
      Object.assign(node, updates);
    }
    
    return newData;
  };

  const deleteNodeFromLocalState = (currentData: any, nodeId: string) => {
    const newData = { ...currentData };
    removeNodeFromTree(newData.rootNode, nodeId);
    return newData;
  };

  const moveNodeInLocalState = (currentData: any, nodeId: string, newPosition: any) => {
    const newData = { ...currentData };
    const node = findNodeById(newData.rootNode, nodeId);
    
    if (node) {
      node.x = newPosition.x;
      node.y = newPosition.y;
      
      // 親ノードの変更がある場合
      if (newPosition.parent_id !== undefined) {
        // 現在の親から削除
        removeNodeFromTree(newData.rootNode, nodeId);
        
        // 新しい親に追加
        if (newPosition.parent_id) {
          const newParent = findNodeById(newData.rootNode, newPosition.parent_id);
          if (newParent) {
            if (!newParent.children) newParent.children = [];
            newParent.children.push(node);
          }
        }
      }
    }
    
    return newData;
  };

  // ===== リモート操作適用ヘルパー =====

  const applyRemoteNodeCreation = (operation: any) => {
    const localUpdate = (currentData: any) => {
      return addNodeToLocalState(currentData, operation.data);
    };
    updateData(localUpdate);
  };

  const applyRemoteNodeUpdate = (operation: any) => {
    const localUpdate = (currentData: any) => {
      return updateNodeInLocalState(currentData, operation.target_id, operation.data);
    };
    updateData(localUpdate);
  };

  const applyRemoteNodeDeletion = (operation: any) => {
    const localUpdate = (currentData: any) => {
      return deleteNodeFromLocalState(currentData, operation.target_id);
    };
    updateData(localUpdate);
  };

  const applyRemoteNodeMove = (operation: any) => {
    const localUpdate = (currentData: any) => {
      return moveNodeInLocalState(currentData, operation.target_id, operation.data);
    };
    updateData(localUpdate);
  };

  // ===== ユーティリティ関数 =====

  const findNodeById = (rootNode: any, nodeId: string): any => {
    if (!rootNode) return null;
    if (rootNode.id === nodeId) return rootNode;
    
    if (rootNode.children) {
      for (const child of rootNode.children) {
        const found = findNodeById(child, nodeId);
        if (found) return found;
      }
    }
    
    return null;
  };

  const removeNodeFromTree = (rootNode: any, nodeId: string): boolean => {
    if (!rootNode || !rootNode.children) return false;
    
    // 直接の子から削除を試行
    const childIndex = rootNode.children.findIndex((child: any) => child.id === nodeId);
    if (childIndex !== -1) {
      rootNode.children.splice(childIndex, 1);
      return true;
    }
    
    // 再帰的に子ノードで削除を試行
    for (const child of rootNode.children) {
      if (removeNodeFromTree(child, nodeId)) {
        return true;
      }
    }
    
    return false;
  };

  // ===== ロールバック関数（エラー処理用） =====

  const rollbackLocalState = (nodeId: string) => {
    // 実装: 失敗した操作のロールバック
    console.warn('Rolling back local state for node:', nodeId);
  };

  const rollbackNodeUpdate = (nodeId: string, updates: any) => {
    // 実装: 更新のロールバック
    console.warn('Rolling back node update:', nodeId, updates);
  };

  const rollbackNodeDeletion = (nodeId: string) => {
    // 実装: 削除のロールバック
    console.warn('Rolling back node deletion:', nodeId);
  };

  const rollbackNodeMove = (nodeId: string, newPosition: any) => {
    // 実装: 移動のロールバック
    console.warn('Rolling back node move:', nodeId, newPosition);
  };

  // ===== UI通知 =====

  const showConflictNotification = (conflictInfo: any) => {
    // 実装: 競合解決の通知UI
    console.log('Showing conflict notification:', conflictInfo);
  };

  // ===== 戻り値 =====

  return {
    // 統合操作関数
    createNode: integratedCreateNode,
    updateNode: integratedUpdateNode,
    deleteNode: integratedDeleteNode,
    moveNode: integratedMoveNode,
    
    // リアルタイム協調編集
    notifyEditingState,
    shareCursorPosition,
    
    // 同期状態
    syncState: cloudSync.syncState,
    isCloudSyncEnabled: isCloudMode && cloudSync.isInitialized,
    cloudSyncError: cloudSync.error,
    
    // 統計・デバッグ
    getSyncStats: cloudSync.getStats,
    
    // 手動同期制御
    forceSync: cloudSync.forceSync,
    fullSync: cloudSync.fullSync
  };
};