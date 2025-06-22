// 新しいDataManagerベースの統合マインドマップフック
import { useMindMapData } from './useMindMapData.js';
import { useMindMapNodes } from './useMindMapNodes.js';
import { useMindMapFiles } from './useMindMapFiles.js';
import { useMindMapNavigation } from './useMindMapNavigation.js';

export const useMindMap = (isAppReady = false, currentMapId = null) => {
  // データ管理フック
  const dataOperations = useMindMapData(isAppReady);
  
  // ノード操作フック
  const nodeOperations = useMindMapNodes(dataOperations.data, dataOperations);
  
  // ナビゲーション操作フック（Zoom/Pan）
  const navigationOperations = useMindMapNavigation();
  
  // ファイル操作フック
  const fileOperations = useMindMapFiles(
    nodeOperations.findNode, 
    dataOperations,
    currentMapId
  );
  
  // 方向ナビゲーション関数を作成
  const navigateToDirection = navigationOperations.createNavigateToDirection(
    nodeOperations.findNode,
    nodeOperations.findParentNode,
    nodeOperations.flattenNodes,
    nodeOperations.selectedNodeId,
    nodeOperations.setSelectedNodeId,
    dataOperations.data
  );
  
  // 統合されたAPI
  return {
    // データ関連
    data: dataOperations.data,
    syncStatus: dataOperations.syncStatus,
    isLoadingFromCloud: dataOperations.isLoadingFromCloud,
    
    // ノード操作
    ...nodeOperations,
    
    // ナビゲーション操作
    zoom: navigationOperations.zoom,
    setZoom: navigationOperations.setZoom,
    pan: navigationOperations.pan,
    setPan: navigationOperations.setPan,
    resetView: navigationOperations.resetView,
    navigateToDirection,
    
    // ファイル操作
    ...fileOperations,
    
    // データ操作
    updateSettings: dataOperations.updateSettings,
    updateTitle: dataOperations.updateTitle,
    changeTheme: dataOperations.changeTheme,
    
    // 履歴操作
    undo: dataOperations.undo,
    redo: dataOperations.redo,
    canUndo: dataOperations.canUndo,
    canRedo: dataOperations.canRedo,
    
    // 同期操作
    forceSync: dataOperations.forceSync,
    triggerCloudSync: dataOperations.triggerCloudSync,
    
    // 旧式互換（非推奨）
    updateData: dataOperations.updateData,
    setData: dataOperations.setData,
    saveMindMap: dataOperations.saveMindMap,
    
    // デバッグ用
    dataManager: dataOperations.dataManager
  };
};