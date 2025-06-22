// 新しいDataManagerベースの統合マインドマップフック
import { useMindMapData } from './useMindMapData.js';
import { useMindMapNodes } from './useMindMapNodes.js';
import { useMindMapFiles } from './useMindMapFiles.js';

export const useMindMap = (isAppReady = false, currentMapId = null) => {
  // データ管理フック
  const dataOperations = useMindMapData(isAppReady);
  
  // ノード操作フック
  const nodeOperations = useMindMapNodes(dataOperations.data, dataOperations);
  
  // ファイル操作フック
  const fileOperations = useMindMapFiles(
    nodeOperations.findNode, 
    dataOperations,
    currentMapId
  );
  
  // 統合されたAPI
  return {
    // データ関連
    data: dataOperations.data,
    syncStatus: dataOperations.syncStatus,
    isLoadingFromCloud: dataOperations.isLoadingFromCloud,
    
    // ノード操作
    ...nodeOperations,
    
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