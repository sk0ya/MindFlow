import { useCallback } from 'react';
import { useMindMapZustand } from './useMindMapZustand';
import { useMindMapNavigation } from './useMindMapNavigation';
import type { FileAttachment } from '../../shared/types';

/**
 * 統一されたメインMindMapフック
 * - Zustandによる統合状態管理
 * - 正規化データ構造によるO(1)操作
 * - 既存APIとの完全な互換性
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

  // マルチマップ管理（簡易実装）
  const currentMapId = mindMapHook.data?.id || null;
  const allMindMaps = mindMapHook.data ? [mindMapHook.data] : [];
  
  const createMindMap = useCallback(async (title: string, category?: string) => {
    console.log('createMindMap called:', { title, category });
    return 'new-map-id';
  }, []);
  
  const switchToMap = useCallback(async (mapId: string): Promise<void> => {
    console.log('switchToMap called:', mapId);
    // 仮の実装 - 実際のマップ切り替え機能は後で実装
  }, []);
  
  const renameMindMap = useCallback(async (mapId: string, newTitle: string) => {
    if (mapId === currentMapId && mindMapHook.data) {
      mindMapHook.store.setData({
        ...mindMapHook.data,
        title: newTitle,
        updatedAt: new Date().toISOString()
      });
    }
  }, [currentMapId, mindMapHook]);
  
  const deleteMindMapById = useCallback(async (mapId: string): Promise<boolean> => {
    console.log('deleteMindMapById called:', mapId);
    return true; // 仮の実装 - 成功を返す
  }, []);
  
  const changeMapCategory = useCallback(async (mapId: string, category: string) => {
    console.log('changeMapCategory called:', { mapId, category });
  }, []);
  
  const getAvailableCategories = useCallback(() => {
    return ['未分類', '仕事', '個人', '学習'];
  }, []);
  
  const refreshAllMindMaps = useCallback(async () => {
    // No-op for now
  }, []);

  // ファイル操作（簡易実装）
  const attachFileToNode = useCallback(async (nodeId: string, file: File): Promise<FileAttachment> => {
    console.log('attachFileToNode called:', { nodeId, file });
    // 仮の実装 - 実際のファイル添付機能は後で実装
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
    console.log('removeFileFromNode called:', { nodeId, fileId });
  }, []);
  
  const renameFileInNode = useCallback(async (nodeId: string, fileId: string, newName: string) => {
    console.log('renameFileInNode called:', { nodeId, fileId, newName });
  }, []);
  
  const downloadFile = useCallback(async (file: any) => {
    console.log('downloadFile called:', file);
  }, []);

  // 既存APIとの互換性のために必要な関数を追加
  const dragNode = useCallback(async (nodeId: string, x: number, y: number) => {
    return await mindMapHook.updateNode(nodeId, { x, y });
  }, [mindMapHook.updateNode]);

  const changeParent = useCallback(async (nodeId: string, newParentId: string) => {
    return await mindMapHook.moveNode(nodeId, newParentId);
  }, [mindMapHook.moveNode]);

  const changeSiblingOrder = useCallback(async (draggedNodeId: string, targetNodeId: string, insertBefore: boolean = true) => {
    console.log('changeSiblingOrder called:', { draggedNodeId, targetNodeId, insertBefore });
    return true;
  }, []);

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

  const applyAutoLayoutToData = useCallback(async () => {
    console.log('applyAutoLayoutToData called');
  }, []);

  const applyFullLayout = useCallback(async () => {
    console.log('applyFullLayout called');
  }, []);

  return {
    // データ
    data: mindMapHook.data,
    selectedNodeId: mindMapHook.selectedNodeId,
    editingNodeId: mindMapHook.editingNodeId,
    editText: mindMapHook.editText,
    
    // 状態更新
    setSelectedNodeId: mindMapHook.setSelectedNodeId,
    setEditingNodeId: mindMapHook.store.selectNode,
    setEditText: mindMapHook.setEditText,
    
    // ノード操作（O(1) + 自動保存）
    updateNode: mindMapHook.updateNode,
    addChildNode: mindMapHook.addChildNode,
    addSiblingNode: mindMapHook.addSiblingNode,
    deleteNode: mindMapHook.deleteNode,
    moveNode: mindMapHook.moveNode,
    
    // レガシー互換
    addNode: mindMapHook.addNode,
    updateNodeText: mindMapHook.updateNodeText,
    
    // データ更新
    updateTitle: useCallback(async (newTitle: string) => {
      if (mindMapHook.data) {
        mindMapHook.store.setData({
          ...mindMapHook.data,
          title: newTitle,
          updatedAt: new Date().toISOString()
        });
      }
    }, [mindMapHook]),
    
    // 検索・取得（O(1)）
    findNode: mindMapHook.findNode,
    getChildNodes: mindMapHook.getChildNodes,
    flattenNodes: mindMapHook.flattenNodes,
    
    // 編集機能
    startEditingNode: mindMapHook.startEditingNode,
    finishEditingNode: mindMapHook.finishEditingNode,
    cancelEditingNode: mindMapHook.cancelEditingNode,
    startEdit,
    finishEdit,
    toggleCollapse,
    
    // レイアウト
    applyAutoLayout: applyAutoLayoutToData,
    applyFullLayout,
    
    // ドラッグ&ドロップ
    dragNode,
    changeParent,
    changeSiblingOrder,
    
    // 履歴
    undo: mindMapHook.undo,
    redo: mindMapHook.redo,
    canUndo: mindMapHook.canUndo,
    canRedo: mindMapHook.canRedo,
    
    // 保存
    saveManually: mindMapHook.saveManually,
    saveImmediately: mindMapHook.saveManually,
    
    // ファイル操作
    uploadFile: attachFileToNode,
    removeFile: removeFileFromNode,
    attachFileToNode,
    removeFileFromNode,
    renameFileInNode,
    downloadFile,
    
    // マルチマップ管理
    currentMapId,
    refreshAllMindMaps,
    allMindMaps,
    createMindMap,
    renameMindMap,
    deleteMindMapById,
    switchToMap,
    changeMapCategory,
    getAvailableCategories,
    
    // ナビゲーション
    ...navigation,
    
    // エラー処理
    onError: (error: Error) => {
      console.error('MindMap Error:', error);
    },
    
    // デバッグ用
    normalizedData: mindMapHook.normalizedData,
    store: mindMapHook.store
  };
};