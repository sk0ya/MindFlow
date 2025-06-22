import { useState, useCallback, useEffect } from 'react';
import { useMindMapData } from './useMindMapData.js';
import { useMindMapNodes } from './useMindMapNodes.js';
import { useMindMapFiles } from './useMindMapFiles.js';
import { useMindMapMulti } from './useMindMapMulti.js';

// 緊急復旧: 完全に簡略化されたuseMindMap（常に同じフック数）
export const useMindMap = (isAppReady = false) => {
  // デバッグログを制限（初回のみ）
  const [debugLogged, setDebugLogged] = useState(false);
  
  // 🚨 重要: isAppReadyに関係なく、常に同じ順序でフックを呼び出す
  const dataHook = useMindMapData(isAppReady);
  
  // デバッグログ（初回または状態変化時のみ）
  useEffect(() => {
    if (!debugLogged || (dataHook.data?.id && !debugLogged)) {
      console.log('🔧 useMindMap called with isAppReady:', isAppReady);
      console.log('📊 Data hook result:', { hasData: !!dataHook.data, title: dataHook.data?.title });
      setDebugLogged(true);
    }
  }, [isAppReady, dataHook.data?.id, debugLogged]);
  
  // ノード操作（dataがある場合のみ）
  const nodeHook = useMindMapNodes(dataHook.data, dataHook.updateData);
  
  // ナビゲーション（簡略化版）
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  const navigateToDirection = useCallback((direction) => {
    console.log('🧭 Navigate to direction:', direction);
    // 簡略化：基本的なナビゲーションのみ実装
  }, []);

  // マルチマップ管理
  const multiHook = useMindMapMulti(dataHook.data, dataHook.setData, dataHook.updateData);
  
  // ファイル添付
  const fileHook = useMindMapFiles(nodeHook.findNode, nodeHook.updateNode, multiHook.currentMapId);

  return {
    // データ
    data: dataHook.data,
    selectedNodeId: nodeHook.selectedNodeId,
    editingNodeId: nodeHook.editingNodeId,
    editText: nodeHook.editText,
    
    // 状態更新
    setSelectedNodeId: nodeHook.setSelectedNodeId,
    setEditingNodeId: nodeHook.setEditingNodeId,
    setEditText: nodeHook.setEditText,
    
    // ノード操作
    updateNode: nodeHook.updateNode,
    addChildNode: nodeHook.addChildNode,
    addSiblingNode: nodeHook.addSiblingNode,
    deleteNode: nodeHook.deleteNode,
    dragNode: nodeHook.dragNode,
    changeParent: nodeHook.changeParent,
    findNode: nodeHook.findNode,
    findParentNode: nodeHook.findParentNode,
    flattenNodes: nodeHook.flattenNodes,
    applyAutoLayout: nodeHook.applyAutoLayout,
    navigateToDirection,
    
    // 編集
    startEdit: nodeHook.startEdit,
    finishEdit: nodeHook.finishEdit,
    
    // 折りたたみ
    toggleCollapse: nodeHook.toggleCollapse,
    
    // ナビゲーション (簡略化)
    zoom,
    setZoom,
    pan,
    setPan,
    resetView: () => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    },
    
    // ファイル添付
    attachFileToNode: fileHook.attachFileToNode,
    removeFileFromNode: fileHook.removeFileFromNode,
    renameFileInNode: fileHook.renameFileInNode,
    downloadFile: fileHook.downloadFile,
    isAppInitializing: fileHook.isAppInitializing,
    
    // 履歴
    undo: dataHook.undo,
    redo: dataHook.redo,
    canUndo: dataHook.canUndo,
    canRedo: dataHook.canRedo,
    
    // その他
    updateTitle: dataHook.updateTitle,
    changeTheme: dataHook.changeTheme,
    updateSettings: dataHook.updateSettings,
    saveMindMap: dataHook.saveMindMap,
    triggerCloudSync: dataHook.triggerCloudSync,
    
    // マルチマップ管理
    allMindMaps: multiHook.allMindMaps,
    currentMapId: multiHook.currentMapId,
    createMindMap: multiHook.createMindMap,
    renameMindMap: multiHook.renameMindMap,
    deleteMindMapById: multiHook.deleteMindMapById,
    switchToMap: multiHook.switchToMap,
    refreshAllMindMaps: multiHook.refreshAllMindMaps,
    
    // カテゴリー管理
    changeMapCategory: multiHook.changeMapCategory,
    getAvailableCategories: multiHook.getAvailableCategories
  };
};