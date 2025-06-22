// 新しいDataManagerベースの統合マインドマップフック
import { useMindMapDataV2 } from './useMindMapDataV2.js';
import { useMindMapNodesV2 } from './useMindMapNodesV2.js';
import { useMindMapFilesV2 } from './useMindMapFilesV2.js';

export const useMindMapV2 = (isAppReady = false, currentMapId = null) => {
  // データ管理フック
  const dataOperations = useMindMapDataV2(isAppReady);
  
  // ノード操作フック
  const nodeOperations = useMindMapNodesV2(dataOperations.data, dataOperations);
  
  // ファイル操作フック
  const fileOperations = useMindMapFilesV2(
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