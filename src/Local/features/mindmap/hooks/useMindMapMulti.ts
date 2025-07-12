import { useEffect } from 'react';
import { MindMapData } from '../../../shared/types/dataTypes';
import { useMapCRUD } from './useMapCRUD';
import { useMapSwitching } from './useMapSwitching';

// マルチマップ管理専用のカスタムフック（ローカルモード専用）
export const useMindMapMulti = (data: MindMapData | null, setData: (data: MindMapData) => void, _updateData: (data: MindMapData, options?: { [key: string]: unknown }) => void) => {
  
  // マップCRUD操作
  const {
    allMindMaps,
    refreshAllMindMaps,
    createMindMap: createMapBase,
    renameMindMap,
    deleteMindMapById: deleteMapBase,
    changeMapCategory,
    getAvailableCategories
  } = useMapCRUD();

  // マップ切り替え操作
  const {
    currentMapId,
    setCurrentMapId,
    switchToMap: switchToMapBase,
    removeTemporaryNodes
  } = useMapSwitching({ data, setData });

  // 新規マップ作成（切り替え付き）
  const createMindMap = async (title = '新しいマインドマップ', category = '未分類') => {
    const newMapId = await createMapBase(title, category);
    // 新規作成したマップに切り替え
    await switchToMapBase(newMapId, true);
    return newMapId;
  };

  // マップ削除（切り替え付き）
  const deleteMindMapById = async (mapId: string) => {
    if (allMindMaps.length <= 1) {
      console.warn('最後のマインドマップは削除できません');
      return false;
    }
    
    const success = await deleteMapBase(mapId);
    
    // 削除されたマップが現在のマップだった場合、別のマップに切り替え
    if (success && mapId === currentMapId && allMindMaps.length > 0) {
      const remainingMaps = allMindMaps.filter(map => map.id !== mapId);
      if (remainingMaps.length > 0) {
        await switchToMapBase(remainingMaps[0].id);
      }
    }
    
    return success;
  };

  // マップ切り替え（元の署名を維持）
  const switchToMap = async (
    mapId: string, 
    selectRoot = false, 
    setSelectedNodeId: ((id: string | null) => void) | null = null, 
    setEditingNodeId: ((id: string | null) => void) | null = null, 
    setEditText: ((text: string) => void) | null = null, 
    _setHistory: unknown = null, 
    _setHistoryIndex: unknown = null, 
    finishEdit: ((nodeId: string, text: string) => void) | null = null
  ) => {
    await switchToMapBase(mapId, selectRoot, setSelectedNodeId, setEditingNodeId, setEditText, _setHistory, _setHistoryIndex, finishEdit);
  };

  // 初期化時にallMindMapsを更新（ローカルモード）
  useEffect(() => {
    const initializeMaps = async () => {
      try {
        console.log('🔄 ローカルモードでマップ一覧読み込み開始');
        await refreshAllMindMaps();
      } catch (error) {
        console.error('❌ 初期化時のマップ一覧読み込み失敗:', error);
      }
    };
    
    initializeMaps();
  }, [refreshAllMindMaps]);

  // ローカルモード初期化（即座完了）
  const reinitializeAfterModeSelection = async () => {
    try {
      console.log('🔄 ローカルモード初期化開始');
      await refreshAllMindMaps();
      console.log('✅ ローカルモード初期化完了');
    } catch (error) {
      console.error('❌ ローカルモード初期化失敗:', error);
    }
  };

  return {
    allMindMaps,
    currentMapId,
    setCurrentMapId,
    refreshAllMindMaps,
    createMindMap,
    renameMindMap,
    deleteMindMapById,
    changeMapCategory,
    getAvailableCategories,
    switchToMap,
    removeTemporaryNodes,
    reinitializeAfterModeSelection
  };
};