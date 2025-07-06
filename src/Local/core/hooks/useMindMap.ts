import { useState, useEffect } from 'react';
import { useMindMapData } from '../../features/mindmap/useMindMapData';
import { useMindMapNodes } from '../../features/mindmap/useMindMapNodes';
import { useMindMapFiles } from '../../features/files/useMindMapFiles';
import { useMindMapMulti } from '../../features/mindmap/useMindMapMulti';
import { useMindMapNavigation } from './useMindMapNavigation';

// メインのマインドマップ管理hook
export const useMindMap = (isAppReady = false) => {
  // 🚨 重要: isAppReadyに関係なく、常に同じ順序でフックを呼び出す
  const dataHook = useMindMapData(isAppReady);
  
  // マルチマップ管理
  const multiHook = useMindMapMulti(dataHook.data, dataHook.setData, dataHook.updateData);
  
  // ノード操作（dataがある場合のみ、refreshAllMindMapsを渡す）
  const nodeHook = useMindMapNodes(dataHook.data, dataHook.updateData, multiHook.refreshAllMindMaps);
  
  // ナビゲーション
  const navigation = useMindMapNavigation({
    selectedNodeId: nodeHook.selectedNodeId,
    data: dataHook.data,
    findNode: nodeHook.findNode,
    flattenNodes: nodeHook.flattenNodes,
    findParentNode: nodeHook.findParentNode,
    setSelectedNodeId: nodeHook.setSelectedNodeId
  });

  // ファイル添付
  const fileHook = useMindMapFiles(
    (nodeId: string) => nodeHook.findNode(nodeId), 
    nodeHook.updateNode, 
    multiHook.currentMapId
  );

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
    navigateToDirection: navigation.navigateToDirection,
    
    // 編集
    startEdit: nodeHook.startEdit,
    finishEdit: nodeHook.finishEdit,
    
    // 折りたたみ
    toggleCollapse: nodeHook.toggleCollapse,
    
    // ナビゲーション
    zoom: navigation.zoom,
    setZoom: navigation.setZoom,
    pan: navigation.pan,
    setPan: navigation.setPan,
    resetView: navigation.resetView,
    
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
    triggerLocalSync: dataHook.triggerLocalSync,
    
    // マルチマップ管理
    allMindMaps: multiHook.allMindMaps,
    currentMapId: multiHook.currentMapId,
    createMindMap: multiHook.createMindMap,
    renameMindMap: multiHook.renameMindMap,
    deleteMindMapById: multiHook.deleteMindMapById,
    switchToMap: (mapId: string, selectRoot = false) => {
      return multiHook.switchToMap(
        mapId, 
        selectRoot, 
        nodeHook.setSelectedNodeId, 
        nodeHook.setEditingNodeId, 
        nodeHook.setEditText, 
        dataHook.setHistory, 
        dataHook.setHistoryIndex,
        nodeHook.finishEdit  // finishEditを渡す
      );
    },
    refreshAllMindMaps: multiHook.refreshAllMindMaps,
    
    // カテゴリー管理
    changeMapCategory: multiHook.changeMapCategory,
    getAvailableCategories: multiHook.getAvailableCategories,
    
    // 初期化管理
    reinitializeAfterModeSelection: multiHook.reinitializeAfterModeSelection
  };
};