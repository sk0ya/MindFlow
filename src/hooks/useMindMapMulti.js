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

  // マップ一覧の更新（改善版）
  const refreshAllMindMaps = async () => {
    try {
      console.log('🔄 マップ一覧を同期中...');
      
      // ストレージモードを確認
      const { getAppSettings } = await import('../utils/storage.js');
      const settings = getAppSettings();
      console.log('📊 現在のストレージモード:', settings.storageMode);
      
      const maps = await getAllMindMapsHybrid();
      console.log('📥 取得したマップデータ:', {
        type: typeof maps,
        isArray: Array.isArray(maps),
        length: maps?.length,
        sample: maps?.[0] // 最初のマップのサンプル
      });
      
      if (!maps) {
        console.warn('⚠️ マップデータがnullです');
        setAllMindMaps([]);
      } else if (Array.isArray(maps)) {
        // データ整合性チェック
        const validMaps = maps.filter(map => {
          if (!map || !map.id) {
            console.warn('❌ 無効なマップを除外:', map);
            return false;
          }
          return true;
        });
        
        console.log('📋 有効なマップ:', validMaps.length, '件 / 総数:', maps.length, '件');
        setAllMindMaps(validMaps);
        console.log('✅ マップ一覧同期完了:', validMaps.length, '件');
      } else {
        console.warn('⚠️ マップデータが配列ではありません:', typeof maps, maps);
        setAllMindMaps([]);
      }
    } catch (error) {
      console.error('❌ マップ一覧同期失敗:', error);
      console.error('❌ エラー詳細:', error.message, error.stack);
      
      // エラー時はローカルデータにフォールバック
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

  // マップ切り替え（DB同期ロジック改善版）
  const switchToMap = async (mapId, selectRoot = false, setSelectedNodeId = null, setEditingNodeId = null, setEditText = null, setHistory = null, setHistoryIndex = null) => {
    console.log('🔄 マップ切り替え開始:', mapId);
    
    try {
      // 1. 現在のマップを保存（データ損失防止）
      if (data && !data.isPlaceholder) {
        try {
          const { saveMindMapHybrid } = await import('../utils/storage.js');
          console.log('💾 切り替え前のマップ保存開始:', data.id, data.title);
          await saveMindMapHybrid(data);
          console.log('✅ 切り替え前のマップ保存完了');
        } catch (saveError) {
          console.warn('⚠️ 切り替え前のマップ保存失敗:', saveError);
        }
      }
      
      // 2. ストレージモードの確認
      const { isCloudStorageEnabled, loadMindMapFromCloud, getAllMindMaps } = await import('../utils/storage.js');
      let targetMap = null;
      
      if (isCloudStorageEnabled()) {
        // クラウドモード: 必ずクラウドから最新データを取得
        console.log('☁️ クラウドモード: 最新データを取得中...', mapId);
        targetMap = await loadMindMapFromCloud(mapId);
        
        if (!targetMap) {
          throw new Error(`クラウドからマップ ${mapId} を取得できませんでした`);
        }
        
        console.log('✅ クラウドから詳細データ取得成功:', {
          id: targetMap.id,
          title: targetMap.title,
          hasRootNode: !!targetMap.rootNode,
          nodeCount: targetMap.rootNode?.children?.length || 0
        });
        
      } else {
        // ローカルモード: ローカルストレージから取得
        console.log('🏠 ローカルモード: ローカルデータ取得中...', mapId);
        const localMaps = getAllMindMaps();
        targetMap = localMaps.find(map => map && map.id === mapId);
        
        if (!targetMap) {
          throw new Error(`ローカルからマップ ${mapId} を取得できませんでした`);
        }
        
        console.log('✅ ローカルから詳細データ取得成功:', targetMap.title);
      }
      
      // 3. データ整合性チェック（詳細版）
      console.log('🔍 取得したマップデータの詳細検証:', {
        hasTargetMap: !!targetMap,
        targetMapKeys: targetMap ? Object.keys(targetMap) : null,
        hasRootNode: !!(targetMap && targetMap.rootNode),
        rootNodeType: targetMap && targetMap.rootNode ? typeof targetMap.rootNode : null,
        rootNodeId: targetMap && targetMap.rootNode ? targetMap.rootNode.id : null,
        hasChildren: !!(targetMap && targetMap.rootNode && targetMap.rootNode.children),
        childrenType: targetMap && targetMap.rootNode && targetMap.rootNode.children ? typeof targetMap.rootNode.children : null,
        childrenLength: targetMap && targetMap.rootNode && targetMap.rootNode.children ? targetMap.rootNode.children.length : 0,
        mapId: targetMap ? targetMap.id : null,
        mapTitle: targetMap ? targetMap.title : null
      });
      
      if (!targetMap) {
        throw new Error(`マップデータが取得できませんでした: ${mapId}`);
      }
      
      if (!targetMap.id) {
        console.error('❌ マップにIDがありません:', targetMap);
        throw new Error('マップデータが破損しています（IDが見つかりません）');
      }
      
      if (!targetMap.rootNode) {
        console.error('❌ マップにrootNodeがありません:', targetMap);
        throw new Error('マップデータが破損しています（rootNodeが見つかりません）');
      }
      
      if (!targetMap.rootNode.children || !Array.isArray(targetMap.rootNode.children)) {
        console.error('❌ rootNode.childrenが異常です:', {
          hasChildren: !!targetMap.rootNode.children,
          childrenType: typeof targetMap.rootNode.children,
          isArray: Array.isArray(targetMap.rootNode.children),
          value: targetMap.rootNode.children
        });
        
        // 修正を試みる
        if (!targetMap.rootNode.children) {
          console.log('🔧 childrenを空配列で初期化します');
          targetMap.rootNode.children = [];
        } else if (!Array.isArray(targetMap.rootNode.children)) {
          console.log('🔧 childrenを空配列にリセットします');
          targetMap.rootNode.children = [];
        }
      }
      
      // 4. マップ切り替え実行
      console.log('🔄 マップ切り替え実行:', {
        from: data?.id || 'none',
        to: targetMap.id,
        title: targetMap.title,
        rootNodeExists: !!targetMap.rootNode,
        childrenCount: targetMap.rootNode?.children?.length || 0
      });
      
      const coloredMap = assignColorsToExistingNodes(targetMap);
      setData(coloredMap);
      setCurrentMapId(mapId);
      
      // 5. UI状態をリセット
      if (selectRoot && setSelectedNodeId) {
        setSelectedNodeId('root');
      } else if (setSelectedNodeId) {
        setSelectedNodeId(null);
      }
      if (setEditingNodeId) setEditingNodeId(null);
      if (setEditText) setEditText('');
      
      // 6. 履歴をリセット
      if (setHistory && setHistoryIndex) {
        setHistory([deepClone(coloredMap)]);
        setHistoryIndex(0);
      }
      
      // 7. ローカルストレージ更新（クラウドモードでも現在のマップIDは保持）
      if (!isCloudStorageEnabled()) {
        localStorage.setItem('currentMindMap', JSON.stringify(coloredMap));
      }
      
      console.log('✅ マップ切り替え完了:', {
        title: coloredMap.title,
        id: coloredMap.id,
        hasRootNode: !!coloredMap.rootNode,
        childrenCount: coloredMap.rootNode ? coloredMap.rootNode.children.length : 0
      });
      
    } catch (error) {
      console.error('❌ マップ切り替え失敗:', error);
      console.error('❌ エラー詳細:', error.message, error.stack);
      
      // エラー時は現在のマップを維持（データ損失防止）
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