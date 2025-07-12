import { useCallback, useEffect } from 'react';
import { useMindMapStore } from '../store/mindMapStore';
import type { MindMapNode } from '../../../shared/types';
import { createInitialData } from '../../shared/types/dataTypes';
import { isValidMindMapData } from '../../shared/types';

/**
 * Zustand統合版のMindMapフック
 * 直接localStorageと連携してデータ永続化を行う
 */
export const useMindMapZustand = (isAppReady: boolean = false) => {
  // Zustandストア
  const store = useMindMapStore();
  
  // 初期データの読み込み
  useEffect(() => {
    if (isAppReady && !store.data) {
      const savedData = localStorage.getItem('mindMapData');
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          // データの型安全性を検証
          if (isValidMindMapData(parsedData)) {
            store.setData(parsedData);
          } else {
            console.warn('Invalid saved data format, creating new data');
            const initialData = createInitialData();
            store.setData(initialData);
          }
        } catch (error) {
          console.error('Failed to load saved data:', error);
          // デフォルトデータを作成
          const initialData = createInitialData();
          store.setData(initialData);
        }
      } else {
        // 初回起動時
        const initialData = createInitialData();
        console.log('Created initial data:', initialData);
        store.setData(initialData);
      }
    }
  }, [isAppReady, store]);
  
  // データの自動保存
  useEffect(() => {
    if (store.data) {
      const saveTimeout = setTimeout(() => {
        localStorage.setItem('mindMapData', JSON.stringify(store.data));
      }, 500); // 500msのデバウンス
      
      return () => clearTimeout(saveTimeout);
    }
    // store.dataがnullの場合は何もしない
    return undefined;
  }, [store.data]);
  
  // 手動保存
  const saveManually = useCallback(async () => {
    if (store.data) {
      localStorage.setItem('mindMapData', JSON.stringify(store.data));
    }
  }, [store.data]);
  
  // ノード操作（自動保存はuseEffectで処理）
  const updateNode = useCallback(async (nodeId: string, updates: Partial<MindMapNode>) => {
    store.updateNode(nodeId, updates);
    store.syncToMindMapData(); // 履歴に追加
  }, [store]);
  
  const addChildNode = useCallback(async (parentId: string, text: string = 'New Node', startEditing: boolean = false): Promise<string | null> => {
    const newNodeId = store.addChildNode(parentId, text);
    store.syncToMindMapData(); // 履歴に追加
    if (startEditing && newNodeId) {
      store.startEditing(newNodeId);
    }
    return newNodeId || null;
  }, [store]);
  
  const addSiblingNode = useCallback(async (nodeId: string, text: string = 'New Node', startEditing: boolean = false): Promise<string | null> => {
    const newNodeId = store.addSiblingNode(nodeId, text);
    store.syncToMindMapData(); // 履歴に追加
    if (startEditing && newNodeId) {
      store.startEditing(newNodeId);
    }
    return newNodeId || null;
  }, [store]);
  
  const deleteNode = useCallback(async (nodeId: string) => {
    store.deleteNode(nodeId);
    store.syncToMindMapData(); // 履歴に追加
  }, [store]);
  
  const moveNode = useCallback(async (nodeId: string, newParentId: string) => {
    store.moveNode(nodeId, newParentId);
    store.syncToMindMapData(); // 履歴に追加
  }, [store]);
  
  // 編集機能
  const startEditingNode = useCallback((nodeId: string) => {
    store.startEditing(nodeId);
  }, [store]);
  
  const finishEditingNode = useCallback(async (nodeId: string, text: string) => {
    store.finishEditing(nodeId, text);
    store.syncToMindMapData(); // 履歴に追加
  }, [store]);
  
  const cancelEditingNode = useCallback(() => {
    store.cancelEditing();
  }, [store]);
  
  // 履歴操作
  const undo = useCallback(async () => {
    store.undo();
  }, [store]);
  
  const redo = useCallback(async () => {
    store.redo();
  }, [store]);
  
  return {
    // データ
    data: store.data,
    normalizedData: store.normalizedData,
    
    // ノード検索・取得（O(1)）
    findNode: store.findNode,
    getChildNodes: store.getChildNodes,
    flattenNodes: useCallback(() => {
      return store.normalizedData ? Object.values(store.normalizedData.nodes) : [];
    }, [store.normalizedData]),
    
    // ノード操作（O(1) + 自動保存）
    updateNode,
    addChildNode,
    addSiblingNode,
    deleteNode,
    moveNode,
    
    // レガシー互換
    addNode: addChildNode,
    updateNodeText: useCallback(async (nodeId: string, text: string) => {
      return await updateNode(nodeId, { text });
    }, [updateNode]),
    
    // 選択・編集状態
    selectedNodeId: store.selectedNodeId,
    setSelectedNodeId: store.selectNode,
    editingNodeId: store.editingNodeId,
    editText: store.editText,
    setEditText: store.setEditText,
    startEditingNode,
    finishEditingNode,
    cancelEditingNode,
    
    // 履歴
    undo,
    redo,
    canUndo: store.canUndo(),
    canRedo: store.canRedo(),
    
    // 保存
    saveManually,
    
    // デバッグ用
    store
  };
};