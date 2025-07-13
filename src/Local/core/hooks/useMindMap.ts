import { useCallback } from 'react';
import { useMindMapZustand } from './useMindMapZustand';
import { useMindMapNavigation } from './useMindMapNavigation';
import type { FileAttachment } from '../../../shared/types';

/**
 * 簡素化されたメインMindMapフック
 * - 最小限のAPIのみ公開
 * - 具体的なユースケース向けに特化
 * - 複雑な操作は別のフックで管理
 */
export const useMindMap = (isAppReady = false) => {
  // メインのZustandベースフック
  const mindMapHook = useMindMapZustand(isAppReady);
  
  // ナビゲーション
  const navigation = useMindMapNavigation({
    selectedNodeId: mindMapHook.selectedNodeId,
    data: mindMapHook.data,
    findNode: mindMapHook.findNode,
    flattenNodes: mindMapHook.flattenNodes,
    findParentNode: (nodeId: string) => {
      const parentId = mindMapHook.normalizedData?.parentMap[nodeId];
      return parentId ? mindMapHook.findNode(parentId) : null;
    },
    setSelectedNodeId: mindMapHook.setSelectedNodeId
  });

  // ファイル操作（簡易実装）
  const attachFileToNode = useCallback(async (nodeId: string, file: File): Promise<FileAttachment> => {
    console.warn('attachFileToNode called:', { nodeId, file });
    // TODO: 実際のファイル添付機能を実装
    const fileAttachment: FileAttachment = {
      id: `file_${Date.now()}`,
      name: file.name,
      type: file.type,
      size: file.size,
      isImage: file.type.startsWith('image/'),
      createdAt: new Date().toISOString(),
      data: '' // Base64エンコードされたデータ（仮）
    };
    return fileAttachment;
  }, []);
  
  const removeFileFromNode = useCallback(async (nodeId: string, fileId: string) => {
    console.warn('removeFileFromNode called:', { nodeId, fileId });
  }, []);
  
  const renameFileInNode = useCallback(async (nodeId: string, fileId: string, newName: string) => {
    console.warn('renameFileInNode called:', { nodeId, fileId, newName });
  }, []);
  
  const downloadFile = useCallback(async (file: FileAttachment) => {
    console.warn('downloadFile called:', file);
  }, []);

  // 後方互換性のための必要最小限の関数のみ
  const changeParent = useCallback(async (nodeId: string, newParentId: string) => {
    return await mindMapHook.moveNode(nodeId, newParentId);
  }, [mindMapHook]);

  const changeSiblingOrder = useCallback(async (draggedNodeId: string, targetNodeId: string, insertBefore: boolean = true) => {
    console.log('🎯 useMindMap changeSiblingOrder:', { draggedNodeId, targetNodeId, insertBefore });
    try {
      const result = await mindMapHook.changeSiblingOrder(draggedNodeId, targetNodeId, insertBefore);
      console.log('✅ useMindMap changeSiblingOrder完了');
      return result;
    } catch (error) {
      console.error('❌ useMindMap changeSiblingOrder エラー:', error);
      throw error;
    }
  }, [mindMapHook]);

  const startEdit = useCallback((nodeId: string, clearText: boolean = false) => {
    mindMapHook.startEditingNode(nodeId);
    if (clearText) {
      mindMapHook.setEditText('');
    }
  }, [mindMapHook]);

  const finishEdit = useCallback(async (nodeId: string, newText?: string) => {
    const textToSave = newText !== undefined ? newText : mindMapHook.editText;
    return await mindMapHook.finishEditingNode(nodeId, textToSave);
  }, [mindMapHook]);

  const toggleCollapse = useCallback(async (nodeId: string) => {
    const node = mindMapHook.findNode(nodeId);
    if (node) {
      await mindMapHook.updateNode(nodeId, { collapsed: !node.collapsed });
    }
  }, [mindMapHook]);

  const updateTitle = useCallback(async (newTitle: string) => {
    if (mindMapHook.data) {
      mindMapHook.store.setData({
        ...mindMapHook.data,
        title: newTitle,
        updatedAt: new Date().toISOString()
      });
    }
  }, [mindMapHook]);

  // 簡素化されたAPIのみ返す
  return {
    // 基本データ
    data: mindMapHook.data,
    selectedNodeId: mindMapHook.selectedNodeId,
    editingNodeId: mindMapHook.editingNodeId,
    editText: mindMapHook.editText,
    
    // 状態更新
    setSelectedNodeId: mindMapHook.setSelectedNodeId,
    setEditText: mindMapHook.setEditText,
    
    // コアノード操作
    updateNode: mindMapHook.updateNode,
    addChildNode: mindMapHook.addChildNode,
    addSiblingNode: mindMapHook.addSiblingNode,
    deleteNode: mindMapHook.deleteNode,
    findNode: mindMapHook.findNode,
    flattenNodes: mindMapHook.flattenNodes,
    
    // 編集機能
    startEdit,
    finishEdit,
    toggleCollapse,
    updateTitle,
    
    // 履歴
    undo: mindMapHook.undo,
    redo: mindMapHook.redo,
    canUndo: mindMapHook.canUndo,
    canRedo: mindMapHook.canRedo,
    
    // 後方互換性
    changeParent,
    changeSiblingOrder,
    
    // エイリアス
    moveNode: changeParent,
    
    // ナビゲーション
    navigateToDirection: navigation.navigateToDirection,
    
    // ファイル操作
    attachFileToNode,
    removeFileFromNode,
    renameFileInNode,
    downloadFile,
    
    // 簡易マップ管理
    currentMapId: mindMapHook.data?.id || null,
    allMindMaps: mindMapHook.data ? [mindMapHook.data] : [],
    createMindMap: useCallback(async (title: string) => {
      console.warn('createMindMap called:', title);
      return 'new-map-id';
    }, []),
    renameMindMap: useCallback(async (mapId: string, newTitle: string) => {
      console.warn('renameMindMap called:', { mapId, newTitle });
    }, []),
    deleteMindMapById: useCallback(async (mapId: string) => {
      console.warn('deleteMindMapById called:', mapId);
      return true;
    }, []),
    switchToMap: useCallback(async (mapId: string) => {
      console.warn('switchToMap called:', mapId);
    }, []),
    changeMapCategory: useCallback(async (mapId: string, category: string) => {
      console.warn('changeMapCategory called:', { mapId, category });
    }, []),
    getAvailableCategories: useCallback(() => ['未分類', '仕事', '個人', '学習'], []),
    
    // デバッグ用
    store: mindMapHook.store
  };
};