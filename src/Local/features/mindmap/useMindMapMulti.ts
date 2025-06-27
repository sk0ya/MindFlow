import { useState, useEffect } from 'react';
import { getCurrentMindMap, getAllMindMaps, getMindMap, createMindMap, deleteMindMap, updateMindMap as saveMindMap, storageManager } from '../../core/storage/LocalEngine';
import { deepClone, assignColorsToExistingNodes, createInitialData } from '../../shared/types/dataTypes';
// ローカルモード専用：リアルタイム同期不要

// マルチマップ管理専用のカスタムフック（ローカルモード専用）
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
      
      const maps = await getAllMindMaps();
      
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
      
      const newMap = createInitialData();
      newMap.title = title;
      newMap.category = category;
      
      // メイントピックをマップ名に基づいて設定
      if (newMap.rootNode) {
        newMap.rootNode.text = title;
      }
      
      console.log('🆕 マップ作成開始:', title);
      
      const result = await storageManager.createMap(newMap);
      
      if (!result.success) {
        throw new Error(result.error || 'マップ作成に失敗しました');
      }
      
      console.log('✅ マップ作成完了:', result.data.title || title);
      
      // マップ一覧を更新
      await refreshAllMindMaps();
      
      // ローカルモードでは即座作成完了
      console.log('✅ ローカルマップ作成完了:', result.data.title || title);
      
      // 新規作成したマップに切り替え
      await switchToMap(result.data.id || newMap.id, true);
      return result.data.id || newMap.id;
      
    } catch (error) {
      console.error('❌ マップ作成失敗:', error);
      throw error;
    }
  };

  // マップ名変更（ローカルストレージ）
  const renameMindMap = async (mapId, newTitle) => {
    try {
      console.log('✏️ マップ名変更:', mapId, '->', newTitle);
      
      // 統一インターフェース：StorageManagerを通して更新
      const allMaps = await getAllMindMaps();
      const mapIndex = allMaps.findIndex(map => map.id === mapId);
      
      if (mapIndex !== -1) {
        const updatedMap = { 
          ...allMaps[mapIndex], 
          title: newTitle, 
          updatedAt: new Date().toISOString() 
        };
        
        // ローカルストレージに保存
        await storageManager.updateMindMap(mapId, updatedMap);
        console.log('✅ マップタイトル更新完了:', newTitle);
      } else {
        throw new Error('マップが見つかりません');
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

  // マップ削除（ローカルストレージ）
  const deleteMindMapById = async (mapId) => {
    if (allMindMaps.length <= 1) {
      console.warn('最後のマインドマップは削除できません');
      return false;
    }
    
    try {
      console.log('🗑️ マップ削除開始:', mapId);
      
      // ローカルストレージから削除
      const success = await deleteMindMap(mapId);
      if (!success) {
        throw new Error('マップ削除に失敗しました');
      }
      console.log('✅ マップ削除成功:', mapId);
      
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
      saveMindMap(updatedMap.id, updatedMap);
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
  const switchToMap = async (mapId, selectRoot = false, setSelectedNodeId = null, setEditingNodeId = null, setEditText = null, setHistory = null, setHistoryIndex = null, finishEdit = null) => {
    console.log('📖 マップ切り替え開始:', mapId);
    
    try {
      // 🔧 マップ切り替え前に編集中のノードを適切に保存
      const editingInput = document.querySelector('.node-input');
      const currentEditingNodeId = editingInput ? editingInput.dataset.nodeId : null;
      const currentEditText = editingInput ? editingInput.value : '';
      
      console.log('🔍 マップ切り替え前の状態確認:', {
        hasEditingInput: !!editingInput,
        currentEditingNodeId,
        currentEditText,
        hasFinishEdit: typeof finishEdit === 'function',
        hasSetEditingNodeId: typeof setEditingNodeId === 'function',
        hasSetEditText: typeof setEditText === 'function'
      });
      
      // 編集状態があり、必要な関数が揃っている場合のみ保存処理実行
      if (currentEditingNodeId && currentEditText !== undefined && typeof finishEdit === 'function') {
        console.log('💾 マップ切り替え前の編集保存開始:', { 
          nodeId: currentEditingNodeId, 
          text: currentEditText,
          isEmpty: !currentEditText || currentEditText.trim() === '',
          textLength: currentEditText?.length || 0
        });
        
        // 編集中のテキストを保存（削除判定を無効化）
        try {
          await finishEdit(currentEditingNodeId, currentEditText, { 
            skipMapSwitchDelete: true,  // マップ切り替え時の削除を無効化
            allowDuringEdit: true,
            source: 'mapSwitch'
          });
          console.log('✅ マップ切り替え前の編集保存完了');
          
          // 編集状態をクリア（DOM要素の重複を防ぐ）
          const currentEditingInput = document.querySelector('.node-input');
          if (currentEditingInput) {
            currentEditingInput.blur();
            currentEditingInput.remove();
          }
        } catch (editError) {
          console.warn('⚠️ マップ切り替え前の編集保存失敗:', editError);
        }
      } else if (currentEditingNodeId && !finishEdit) {
        console.warn('⚠️ 編集中のノードが検出されましたが、finishEdit関数が提供されていません:', {
          nodeId: currentEditingNodeId,
          text: currentEditText,
          finishEditType: typeof finishEdit
        });
      }
      
      // 🔧 現在のマップデータを保存してから切り替え（一時ノードを除外）
      if (data && data.id && data.id !== mapId) {
        console.log('💾 マップ切り替え前に現在のマップを保存:', {
          mapId: data.id,
          title: data.title,
          rootNodeChildren: data.rootNode?.children?.length || 0,
          childrenIds: data.rootNode?.children?.map(c => c.id) || [],
          childrenDetails: data.rootNode?.children?.map(c => ({
            id: c.id,
            text: c.text,
            isTemporary: c.isTemporary,
            hasChildren: c.children?.length > 0
          })) || []
        });
        
        try {
          // 一時ノードを除外したデータを作成
          const dataForSaving = removeTemporaryNodes(data);
          
          console.log('📝 一時ノード除外後の保存データ:', {
            originalChildren: data.rootNode?.children?.length || 0,
            filteredChildren: dataForSaving.rootNode?.children?.length || 0,
            removedTempNodes: (data.rootNode?.children?.length || 0) - (dataForSaving.rootNode?.children?.length || 0)
          });
          
          await saveMindMap(dataForSaving.id, dataForSaving);
          console.log('✅ 現在のマップ保存完了:', data.title);
        } catch (saveError) {
          console.warn('⚠️ 現在のマップ保存失敗:', saveError);
        }
      }
      
      const originalTargetMap = await getMindMap(mapId);
      
      // 🔧 重要: マップデータを完全にディープクローンして参照共有を防止
      console.log('🛡️ マップデータを安全にクローン中...');
      const targetMap = deepClone(originalTargetMap);
      
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
          hasY: typeof c.y === 'number',
          hasChildren: c.children?.length > 0,
          childrenCount: c.children?.length || 0
        })) || [],
        isClonedData: originalTargetMap !== targetMap, // 参照が異なることを確認
        originalMapChildren: originalTargetMap.rootNode?.children?.length || 0
      });
      
      // マップ表示（完全に独立したデータ）
      const coloredMap = assignColorsToExistingNodes(targetMap);
      
      console.log('🎨 色付け後データ検証:', {
        hasRootNode: !!coloredMap.rootNode,
        rootNodeChildren: coloredMap.rootNode?.children?.length || 0,
        rootNodeChildrenData: coloredMap.rootNode?.children?.map(c => ({
          id: c.id,
          text: c.text,
          hasX: typeof c.x === 'number',
          hasY: typeof c.y === 'number',
          hasChildren: c.children?.length > 0,
          childrenCount: c.children?.length || 0,
          color: c.color
        })) || [],
        dataIndependence: {
          fromOriginal: originalTargetMap.rootNode !== coloredMap.rootNode,
          fromTarget: targetMap.rootNode !== coloredMap.rootNode,
          childrenFromOriginal: originalTargetMap.rootNode?.children !== coloredMap.rootNode?.children,
          childrenFromTarget: targetMap.rootNode?.children !== coloredMap.rootNode?.children
        },
        dataIntegrity: {
          originalChildren: originalTargetMap.rootNode?.children?.length || 0,
          targetChildren: targetMap.rootNode?.children?.length || 0,
          coloredChildren: coloredMap.rootNode?.children?.length || 0,
          isConsistent: (originalTargetMap.rootNode?.children?.length || 0) === (coloredMap.rootNode?.children?.length || 0)
        }
      });
      
      // 🔧 データ独立性の最終確認
      if (data && coloredMap.rootNode.children === data.rootNode?.children) {
        console.error('❌ 重大な問題: 新しいマップが既存マップと子ノード配列を共有しています！');
        throw new Error('データ参照共有エラー: マップ間でデータが共有されています');
      }
      
      // 🔧 データ消失チェック（問題特定用）
      const originalChildren = originalTargetMap.rootNode?.children?.length || 0;
      const finalChildren = coloredMap.rootNode?.children?.length || 0;
      if (originalChildren !== finalChildren) {
        console.error('❌ データ消失検出!', {
          originalChildren,
          finalChildren,
          lost: originalChildren - finalChildren,
          mapId: mapId,
          mapTitle: coloredMap.title
        });
        // デバッグ用に詳細な差分を出力
        console.error('詳細差分:', {
          originalChildrenIds: originalTargetMap.rootNode?.children?.map(c => c.id) || [],
          finalChildrenIds: coloredMap.rootNode?.children?.map(c => c.id) || []
        });
      }
      
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
  }, []);

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

  // data.idの変更を監視してcurrentMapIdを更新（ローカルモード）
  useEffect(() => {
    if (data?.id && data.id !== currentMapId) {
      console.log('🔄 currentMapIdを更新:', data.id, '(previous:', currentMapId, ')');
      setCurrentMapId(data.id);
    }
  }, [data?.id, currentMapId]);

  // 一時ノードを除外したデータを作成
  const removeTemporaryNodes = (mapData) => {
    if (!mapData || !mapData.rootNode) return mapData;
    
    const clonedData = deepClone(mapData);
    
    function filterTemporaryNodes(node) {
      if (!node) return node;
      
      // 一時ノードでない子ノードのみをフィルタリング
      if (node.children && Array.isArray(node.children)) {
        node.children = node.children
          .filter(child => !child.isTemporary) // 一時ノードを除外
          .map(child => filterTemporaryNodes(child)); // 再帰的に処理
      }
      
      return node;
    }
    
    clonedData.rootNode = filterTemporaryNodes(clonedData.rootNode);
    return clonedData;
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