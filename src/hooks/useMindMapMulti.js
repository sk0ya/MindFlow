import { useState, useEffect } from 'react';
import { getCurrentMindMap, getAllMindMaps, createNewMindMap, deleteMindMap, saveMindMap, getAllMindMapsHybrid, isCloudStorageEnabled } from '../utils/storage.js';
import { deepClone, assignColorsToExistingNodes } from '../utils/dataTypes.js';
import { realtimeSync } from '../utils/realtimeSync.js';

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

  // マップ一覧の更新（シンプル化 - 読み取り専用）
  const refreshAllMindMaps = async () => {
    try {
      console.log('📋 マップ一覧を読み取り中...');
      
      const { getAppSettings } = await import('../utils/storage.js');
      const settings = getAppSettings();
      
      let maps = [];
      
      if (settings.storageMode === 'cloud') {
        // クラウドから直接読み取り
        maps = await realtimeSync.loadMapList();
        console.log('☁️ クラウドから', maps.length, '件のマップを取得');
      } else {
        // ローカルから読み取り
        const { getAllMindMaps } = await import('../utils/storage.js');
        maps = getAllMindMaps();
        console.log('🏠 ローカルから', maps.length, '件のマップを取得');
      }
      
      // データ整合性チェック
      const validMaps = maps.filter(map => map && map.id);
      setAllMindMaps(validMaps);
      console.log('✅ マップ一覧読み取り完了:', validMaps.length, '件');
      
    } catch (error) {
      console.error('❌ マップ一覧読み取り失敗:', error);
      setAllMindMaps([]);
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
        setData(prev => ({ ...prev, title: newTitle }));
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

  // マップ切り替え（完全読み取り専用）
  const switchToMap = async (mapId, selectRoot = false, setSelectedNodeId = null, setEditingNodeId = null, setEditText = null, setHistory = null, setHistoryIndex = null) => {
    console.log('📖 マップ読み取り開始:', mapId);
    
    try {
      const { getAppSettings } = await import('../utils/storage.js');
      const settings = getAppSettings();
      let targetMap = null;
      
      if (settings.storageMode === 'cloud') {
        // クラウドから純粋な読み取り
        console.log('☁️ クラウドから読み取り:', mapId);
        targetMap = await realtimeSync.loadMap(mapId);
      } else {
        // ローカルから純粋な読み取り
        console.log('🏠 ローカルから読み取り:', mapId);
        const { getAllMindMaps } = await import('../utils/storage.js');
        const localMaps = getAllMindMaps();
        targetMap = localMaps.find(map => map && map.id === mapId);
        
        if (!targetMap) {
          throw new Error(`マップが見つかりません: ${mapId}`);
        }
      }
      
      // データ整合性チェック
      if (!targetMap?.id || !targetMap?.rootNode) {
        throw new Error('マップデータが破損しています');
      }
      
      if (!Array.isArray(targetMap.rootNode.children)) {
        targetMap.rootNode.children = [];
      }
      
      // マップ表示（読み取り専用）
      const coloredMap = assignColorsToExistingNodes(targetMap);
      setData(coloredMap);
      setCurrentMapId(mapId);
      
      // UI状態リセット
      if (setSelectedNodeId) {
        setSelectedNodeId(selectRoot ? 'root' : null);
      }
      if (setEditingNodeId) setEditingNodeId(null);
      if (setEditText) setEditText('');
      
      console.log('✅ マップ読み取り完了:', targetMap.title);
      
    } catch (error) {
      console.error('❌ マップ読み取り失敗:', error);
      alert(`マップの読み取りに失敗しました: ${error.message}`);
    }
  };

  // 初期化時にallMindMapsを更新
  useEffect(() => {
    const initializeMaps = async () => {
      try {
        console.log('🔄 初期化時のマップ一覧読み込み開始');
        const { getAppSettings } = await import('../utils/storage.js');
        const settings = getAppSettings();
        
        if (settings.storageMode === 'cloud') {
          // クラウドモードの場合はrefreshAllMindMapsを呼ぶ
          console.log('☁️ クラウドモードで初期化');
          await refreshAllMindMaps();
        } else {
          // ローカルモードの場合は従来通り
          console.log('🏠 ローカルモードで初期化');
          const { getAllMindMaps } = await import('../utils/storage.js');
          const maps = getAllMindMaps();
          if (maps.length !== allMindMaps.length) {
            setAllMindMaps(maps);
          }
        }
      } catch (error) {
        console.error('❌ 初期化時のマップ一覧読み込み失敗:', error);
      }
    };
    
    initializeMaps();
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