import { useState, useEffect } from 'react';
import { getCurrentMindMap, getAllMindMaps, createNewMindMap, deleteMindMap, saveMindMap, getAllMindMapsHybrid, isCloudStorageEnabled } from '../utils/storage.js';
import { deepClone, assignColorsToExistingNodes } from '../utils/dataTypes.js';

// マルチマップ管理専用のカスタムフック
export const useMindMapMulti = (data, setData, updateData) => {
  // マルチマップ管理用の状態
  const [allMindMaps, setAllMindMaps] = useState(() => {
    const maps = getAllMindMaps();
    // 無効なデータを除外してログ出力
    const validMaps = maps.filter(map => {
      if (!map || !map.id) {
        console.warn('Invalid mindmap found and filtered out:', map);
        return false;
      }
      return true;
    });
    return validMaps;
  });
  
  const [currentMapId, setCurrentMapId] = useState(() => {
    // クラウドモードの場合は、データから取得
    if (isCloudStorageEnabled()) {
      return data?.id || null;
    }
    
    const currentMap = getCurrentMindMap();
    return currentMap?.id || null;
  });

  // マップ一覧の更新
  const refreshAllMindMaps = async () => {
    try {
      console.log('🔄 マップ一覧を同期中...');
      
      // ストレージモードを確認
      const { getAppSettings } = await import('../utils/storage.js');
      const settings = getAppSettings();
      console.log('📊 現在のストレージモード:', settings.storageMode);
      
      const maps = await getAllMindMapsHybrid();
      console.log('📥 取得したマップデータ:', maps);
      
      if (!maps) {
        console.warn('⚠️ マップデータがnullです');
        setAllMindMaps([]);
      } else if (Array.isArray(maps)) {
        setAllMindMaps(maps);
        console.log('✅ マップ一覧同期完了:', maps.length, '件');
      } else {
        console.warn('⚠️ マップデータが配列ではありません:', typeof maps, maps);
        setAllMindMaps([]);
      }
    } catch (error) {
      console.error('❌ マップ一覧同期失敗:', error);
      console.error('❌ エラー詳細:', error.message, error.stack);
      // エラー時はローカルデータを使用
      try {
        const { getAllMindMaps } = await import('../utils/storage.js');
        const localMaps = getAllMindMaps();
        console.log('🏠 ローカルデータにフォールバック:', localMaps.length, '件');
        setAllMindMaps(localMaps);
      } catch (fallbackError) {
        console.error('❌ ローカルデータ取得も失敗:', fallbackError);
        setAllMindMaps([]);
      }
    }
  };

  // 新規マップ作成
  const createMindMap = async (title = '新しいマインドマップ', category = '未分類') => {
    try {
      // クラウドモード対応の新規マップ作成
      const { createInitialData } = await import('../utils/dataTypes.js');
      const { isCloudStorageEnabled, saveMindMapHybrid } = await import('../utils/storage.js');
      
      const newMap = createInitialData();
      newMap.title = title;
      newMap.category = category;
      
      // メイントピックをマップ名に基づいて設定
      if (newMap.rootNode) {
        newMap.rootNode.text = title;
      }
      
      console.log('🆕 新規マップ作成:', title, 'クラウドモード:', isCloudStorageEnabled());
      
      // クラウドモードかローカルモードかに応じて保存
      await saveMindMapHybrid(newMap);
      
      // マップ一覧を更新
      await refreshAllMindMaps();
      
      // 新規作成時はルートノードを選択
      switchToMap(newMap.id, true);
      return newMap.id;
    } catch (error) {
      console.error('❌ 新規マップ作成失敗:', error);
      throw error;
    }
  };

  // マップ名変更
  const renameMindMap = (mapId, newTitle) => {
    const allMaps = getAllMindMaps();
    const mapIndex = allMaps.findIndex(map => map.id === mapId);
    
    if (mapIndex !== -1) {
      const updatedMap = { ...allMaps[mapIndex], title: newTitle, updatedAt: new Date().toISOString() };
      allMaps[mapIndex] = updatedMap;
      
      // ストレージに保存
      saveMindMap(updatedMap);
      refreshAllMindMaps();
      
      // 現在編集中のマップの場合はタイトルを更新
      if (mapId === currentMapId) {
        updateData({ ...data, title: newTitle });
      }
    }
  };

  // マップ削除
  const deleteMindMapById = (mapId) => {
    if (allMindMaps.length <= 1) {
      console.warn('最後のマインドマップは削除できません');
      return false;
    }
    
    const newCurrentMap = deleteMindMap(mapId);
    refreshAllMindMaps();
    
    // 削除されたマップが現在のマップだった場合、新しいマップに切り替え
    if (mapId === currentMapId) {
      switchToMap(newCurrentMap.id);
    }
    
    return true;
  };

  // カテゴリー変更
  const changeMapCategory = (mapId, newCategory) => {
    const allMaps = getAllMindMaps();
    const mapIndex = allMaps.findIndex(map => map.id === mapId);
    
    if (mapIndex !== -1) {
      const updatedMap = { ...allMaps[mapIndex], category: newCategory, updatedAt: new Date().toISOString() };
      allMaps[mapIndex] = updatedMap;
      
      // ストレージに保存
      saveMindMap(updatedMap);
      refreshAllMindMaps();
      
      // 現在編集中のマップの場合はデータを更新
      if (mapId === currentMapId) {
        setData(prev => ({ ...prev, category: newCategory }));
      }
    }
  };

  // 利用可能なカテゴリー取得
  const getAvailableCategories = () => {
    const categories = new Set(['未分類']);
    allMindMaps.forEach(map => {
      if (map.category && map.category.trim()) {
        categories.add(map.category);
      }
    });
    return Array.from(categories).sort();
  };

  // マップ切り替え
  const switchToMap = (mapId, selectRoot = false, setSelectedNodeId = null, setEditingNodeId = null, setEditText = null, setHistory = null, setHistoryIndex = null) => {
    const allMaps = getAllMindMaps();
    const targetMap = allMaps.find(map => map && map.id === mapId);
    
    if (targetMap) {
      // 現在のマップを保存
      saveMindMap(data);
      
      // 新しいマップに切り替え
      const coloredMap = assignColorsToExistingNodes(targetMap);
      setData(coloredMap);
      setCurrentMapId(mapId);
      
      // 編集状態をリセット
      if (selectRoot && setSelectedNodeId) {
        setSelectedNodeId('root');
      } else if (setSelectedNodeId) {
        setSelectedNodeId(null);
      }
      if (setEditingNodeId) setEditingNodeId(null);
      if (setEditText) setEditText('');
      
      // 履歴をリセット
      if (setHistory && setHistoryIndex) {
        setHistory([deepClone(coloredMap)]);
        setHistoryIndex(0);
      }
      
      // ストレージの現在のマップを更新
      localStorage.setItem('currentMindMap', JSON.stringify(coloredMap));
    }
  };

  // 初期化時にallMindMapsを更新
  useEffect(() => {
    const maps = getAllMindMaps();
    if (maps.length !== allMindMaps.length) {
      setAllMindMaps(maps);
    }
  }, []);

  // data.idの変更を監視してcurrentMapIdを更新（ローカル・クラウド共通）
  useEffect(() => {
    if (data?.id && data.id !== currentMapId) {
      console.log('🔄 currentMapIdを更新:', data.id, '(previous:', currentMapId, ')');
      setCurrentMapId(data.id);
    }
  }, [data?.id, currentMapId]);

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
    switchToMap
  };
};