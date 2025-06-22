import { useState, useEffect } from 'react';
import { getCurrentMindMap, getAllMindMaps, createNewMindMap, deleteMindMap, saveMindMap, isCloudStorageEnabled } from '../utils/storageRouter.js';
import { deepClone, assignColorsToExistingNodes } from '../utils/dataTypes.js';
import { getCurrentAdapter } from '../utils/storageAdapter.js';

// マルチマップ管理専用のカスタムフック
export const useMindMapMulti = (data, setData, updateData) => {
  // マルチマップ管理用の状態
  const [allMindMaps, setAllMindMaps] = useState([]);
  
  const [currentMapId, setCurrentMapId] = useState(() => {
    return data?.id || null;
  });

  // マップ一覧の更新（完全分離版）
  const refreshAllMindMaps = async () => {
    try {
      console.log('📋 マップ一覧取得開始');
      
      const adapter = getCurrentAdapter();
      const maps = await adapter.getAllMaps();
      
      // データ整合性チェック
      const validMaps = maps.filter(map => map && map.id);
      setAllMindMaps(validMaps);
      console.log('✅ マップ一覧取得完了:', validMaps.length, '件');
      
    } catch (error) {
      console.error('❌ マップ一覧取得失敗:', error);
      setAllMindMaps([]);
    }
  };

  // 新規マップ作成（完全分離版）
  const createMindMap = async (title = '新しいマインドマップ', category = '未分類') => {
    try {
      const { createInitialData } = await import('../utils/dataTypes.js');
      
      const newMap = createInitialData();
      newMap.title = title;
      newMap.category = category;
      
      // メイントピックをマップ名に基づいて設定
      if (newMap.rootNode) {
        newMap.rootNode.text = title;
      }
      
      console.log('🆕 マップ作成開始:', title);
      
      const adapter = getCurrentAdapter();
      const result = await adapter.createMap(newMap);
      
      console.log('✅ マップ作成完了:', result.title || title);
      
      // マップ一覧を更新
      await refreshAllMindMaps();
      
      // 新規作成したマップに切り替え
      await switchToMap(result.id || newMap.id, true);
      return result.id || newMap.id;
      
    } catch (error) {
      console.error('❌ マップ作成失敗:', error);
      throw error;
    }
  };

  // マップ名変更（リアルタイム同期対応）
  const renameMindMap = async (mapId, newTitle) => {
    try {
      const { getAppSettings } = await import('../utils/storage.js');
      const settings = getAppSettings();
      
      console.log('✏️ マップ名変更:', mapId, '->', newTitle);
      
      if (settings.storageMode === 'cloud') {
        // クラウドでマップタイトル更新
        // Note: 個別のタイトル更新APIを実装する必要があります
        console.log('☁️ クラウドマップタイトル更新');
        // 現在はマップ全体の更新で代替
        if (currentMapId === mapId && data) {
          const updatedData = { ...data, title: newTitle, updatedAt: new Date().toISOString() };
          await realtimeSync.updateMap?.(mapId, updatedData) || console.warn('updateMap method not implemented yet');
        }
      } else {
        // ローカル更新
        const { getAllMindMaps, saveMindMap } = await import('../utils/storageRouter.js');
        const allMaps = await getAllMindMaps();
        const mapIndex = allMaps.findIndex(map => map.id === mapId);
        
        if (mapIndex !== -1) {
          const updatedMap = { ...allMaps[mapIndex], title: newTitle, updatedAt: new Date().toISOString() };
          await saveMindMap(updatedMap);
          console.log('🏠 ローカルマップタイトル更新完了');
        }
      }
      
      // マップ一覧を更新
      await refreshAllMindMaps();
      
      // 現在編集中のマップの場合はタイトルを更新
      if (mapId === currentMapId) {
        setData(prev => ({ ...prev, title: newTitle }));
      }
      
    } catch (error) {
      console.error('❌ マップ名変更失敗:', error);
      throw error;
    }
  };

  // マップ削除（リアルタイム同期対応）
  const deleteMindMapById = async (mapId) => {
    if (allMindMaps.length <= 1) {
      console.warn('最後のマインドマップは削除できません');
      return false;
    }
    
    try {
      const { getAppSettings } = await import('../utils/storage.js');
      const settings = getAppSettings();
      
      console.log('🗑️ マップ削除開始:', mapId);
      
      if (settings.storageMode === 'cloud') {
        // クラウドから削除
        const result = await realtimeSync.deleteMap(mapId);
        if (!result.success) {
          throw new Error('クラウドマップ削除失敗: ' + result.error);
        }
        console.log('☁️ クラウドマップ削除成功');
      } else {
        // ローカルから削除
        const { deleteMindMap } = await import('../utils/storage.js');
        const newCurrentMap = deleteMindMap(mapId);
        console.log('🏠 ローカルマップ削除成功');
      }
      
      // マップ一覧を更新
      await refreshAllMindMaps();
      
      // 削除されたマップが現在のマップだった場合、別のマップに切り替え
      if (mapId === currentMapId && allMindMaps.length > 0) {
        const remainingMaps = allMindMaps.filter(map => map.id !== mapId);
        if (remainingMaps.length > 0) {
          await switchToMap(remainingMaps[0].id);
        }
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ マップ削除失敗:', error);
      throw error;
    }
  };

  // カテゴリー変更
  const changeMapCategory = async (mapId, newCategory) => {
    const allMaps = await getAllMindMaps();
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

  // マップ切り替え（完全分離版）
  const switchToMap = async (mapId, selectRoot = false, setSelectedNodeId = null, setEditingNodeId = null, setEditText = null, setHistory = null, setHistoryIndex = null) => {
    console.log('📖 マップ切り替え開始:', mapId);
    
    try {
      const adapter = getCurrentAdapter();
      const targetMap = await adapter.getMap(mapId);
      
      // データ整合性チェック
      if (!targetMap?.id || !targetMap?.rootNode) {
        throw new Error('マップデータが破損しています');
      }
      
      if (!Array.isArray(targetMap.rootNode.children)) {
        targetMap.rootNode.children = [];
      }
      
      // データ構造の詳細確認
      console.log('🔍 切り替え前マップデータ検証:', {
        id: targetMap.id,
        title: targetMap.title,
        hasRootNode: !!targetMap.rootNode,
        rootNodeId: targetMap.rootNode?.id,
        rootNodeChildren: targetMap.rootNode?.children?.length || 0,
        rootNodeChildrenData: targetMap.rootNode?.children?.map(c => ({
          id: c.id,
          text: c.text,
          hasX: typeof c.x === 'number',
          hasY: typeof c.y === 'number'
        })) || []
      });
      
      // マップ表示（読み取り専用）
      const coloredMap = assignColorsToExistingNodes(targetMap);
      
      console.log('🎨 色付け後データ検証:', {
        hasRootNode: !!coloredMap.rootNode,
        rootNodeChildren: coloredMap.rootNode?.children?.length || 0,
        rootNodeChildrenData: coloredMap.rootNode?.children?.map(c => ({
          id: c.id,
          text: c.text,
          hasX: typeof c.x === 'number',
          hasY: typeof c.y === 'number'
        })) || []
      });
      
      setData(coloredMap);
      setCurrentMapId(mapId);
      
      // UI状態リセット
      if (setSelectedNodeId) {
        setSelectedNodeId(selectRoot ? 'root' : null);
      }
      if (setEditingNodeId) setEditingNodeId(null);
      if (setEditText) setEditText('');
      
      console.log('✅ マップ切り替え完了:', targetMap.title);
      
    } catch (error) {
      console.error('❌ マップ切り替え失敗:', error);
      alert(`マップの切り替えに失敗しました: ${error.message}`);
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
          const maps = await getAllMindMaps();
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