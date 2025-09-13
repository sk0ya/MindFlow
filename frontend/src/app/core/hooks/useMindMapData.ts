import { useCallback } from 'react';
import { useMindMapStore } from '../store/mindMapStore';
import type { MindMapNode, MindMapData } from '@shared/types';

/**
 * データ操作に特化したHook
 * ノードとマップの基本的なCRUD操作を担当
 */
export const useMindMapData = () => {
  const store = useMindMapStore();

  const dataOperations = {
    // ノード操作
    addNode: useCallback((parentId: string, text: string = '') => {
      store.addChildNode(parentId, text);
    }, [store]),

    updateNode: useCallback((nodeId: string, updates: Partial<MindMapNode>) => {
      store.updateNode(nodeId, updates);
    }, [store]),

    deleteNode: useCallback((nodeId: string) => {
      store.deleteNode(nodeId);
    }, [store]),

    moveNode: useCallback((nodeId: string, newParentId: string) => {
      store.moveNode(nodeId, newParentId);
    }, [store]),

    changeSiblingOrder: useCallback((draggedNodeId: string, targetNodeId: string, insertBefore: boolean = true) => {
      store.changeSiblingOrder(draggedNodeId, targetNodeId, insertBefore);
    }, [store]),

    toggleNodeCollapse: useCallback((nodeId: string) => {
      store.toggleNodeCollapse(nodeId);
    }, [store]),

    // 編集状態
    startEditing: useCallback((nodeId: string) => {
      store.startEditing(nodeId);
    }, [store]),

    startEditingWithCursorAtEnd: useCallback((nodeId: string) => {
      store.startEditingWithCursorAtEnd(nodeId);
    }, [store]),

    startEditingWithCursorAtStart: useCallback((nodeId: string) => {
      store.startEditingWithCursorAtStart(nodeId);
    }, [store]),

    finishEditing: useCallback((nodeId: string, text: string) => {
      store.finishEditing(nodeId, text);
    }, [store]),

    cancelEditing: useCallback(() => {
      store.cancelEditing();
    }, [store]),

    setEditText: useCallback((text: string) => {
      store.setEditText(text);
    }, [store]),

    // 選択状態
    selectNode: useCallback((nodeId: string | null) => {
      store.selectNode(nodeId);
    }, [store]),

    // データ設定
    setData: useCallback((data: MindMapData) => {
      store.setData(data);
    }, [store]),

    // レイアウト
    applyAutoLayout: useCallback(() => {
      store.applyAutoLayout();
    }, [store])
  };

  return {
    // 状態
    data: store.data,
    normalizedData: store.normalizedData,
    selectedNodeId: store.selectedNodeId,
    editingNodeId: store.editingNodeId,
    editText: store.editText,
    editingMode: store.editingMode,
    
    // 操作
    ...dataOperations
  };
};