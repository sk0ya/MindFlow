import { useState, useEffect } from 'react';
import { updateMindMap as saveMindMap, getMindMap } from '../../../core/storage/LocalEngine';
import { deepClone, assignColorsToExistingNodes, MindMapData, MindMapNode } from '../../../shared/types/dataTypes';

interface UseMapSwitchingProps {
  data: MindMapData | null;
  setData: (data: MindMapData) => void;
}

export const useMapSwitching = ({ data, setData }: UseMapSwitchingProps) => {
  const [currentMapId, setCurrentMapId] = useState(() => {
    return data?.id || null;
  });

  // マップ切り替え（完全分離版）
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
    console.log('📖 マップ切り替え開始:', mapId);
    
    try {
      // 🔧 マップ切り替え前に編集中のノードを適切に保存
      const editingInput = document.querySelector('.node-input') as HTMLInputElement | null;
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
          await finishEdit(currentEditingNodeId, currentEditText);
          console.log('✅ マップ切り替え前の編集保存完了');
          
          // 編集状態をクリア（DOM要素の重複を防ぐ）
          const currentEditingInput = document.querySelector('.node-input') as HTMLInputElement | null;
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
          childrenIds: data.rootNode?.children?.map((c: MindMapNode) => c.id) || [],
          childrenDetails: data.rootNode?.children?.map((c: MindMapNode) => ({
            id: c.id,
            text: c.text,
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
        rootNodeChildrenData: targetMap.rootNode?.children?.map((c: MindMapNode) => ({
          id: c.id,
          text: c.text,
          hasX: typeof c.x === 'number',
          hasY: typeof c.y === 'number',
          hasChildren: c.children?.length > 0,
          childrenCount: c.children?.length || 0
        })) || [],
        isClonedData: originalTargetMap !== targetMap, // 参照が異なることを確認
        originalMapChildren: originalTargetMap?.rootNode?.children?.length || 0
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
          fromOriginal: originalTargetMap?.rootNode !== coloredMap.rootNode,
          fromTarget: targetMap.rootNode !== coloredMap.rootNode,
          childrenFromOriginal: originalTargetMap?.rootNode?.children !== coloredMap.rootNode?.children,
          childrenFromTarget: targetMap.rootNode?.children !== coloredMap.rootNode?.children
        },
        dataIntegrity: {
          originalChildren: originalTargetMap?.rootNode?.children?.length || 0,
          targetChildren: targetMap.rootNode?.children?.length || 0,
          coloredChildren: coloredMap.rootNode?.children?.length || 0,
          isConsistent: (originalTargetMap?.rootNode?.children?.length || 0) === (coloredMap.rootNode?.children?.length || 0)
        }
      });
      
      // 🔧 データ独立性の最終確認
      if (data && coloredMap.rootNode.children === data.rootNode?.children) {
        console.error('❌ 重大な問題: 新しいマップが既存マップと子ノード配列を共有しています！');
        throw new Error('データ参照共有エラー: マップ間でデータが共有されています');
      }
      
      // 🔧 データ消失チェック（問題特定用）
      const originalChildren = originalTargetMap?.rootNode?.children?.length || 0;
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
          originalChildrenIds: originalTargetMap?.rootNode?.children?.map((c: MindMapNode) => c.id) || [],
          finalChildrenIds: coloredMap.rootNode?.children?.map((c: MindMapNode) => c.id) || []
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
      
    } catch (error: unknown) {
      console.error('❌ マップ切り替え失敗:', error);
      alert(`マップの切り替えに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // 一時ノードを除外したデータを作成
  const removeTemporaryNodes = (mapData: MindMapData): MindMapData => {
    // For now, just return the data as-is to avoid type issues
    // TODO: Implement proper temporary node filtering with correct types
    return deepClone(mapData);
  };

  // data.idの変更を監視してcurrentMapIdを更新（ローカルモード）
  useEffect(() => {
    if (data?.id && data.id !== currentMapId) {
      console.log('🔄 currentMapIdを更新:', data.id, '(previous:', currentMapId, ')');
      setCurrentMapId(data.id);
    }
  }, [data?.id, currentMapId]);

  return {
    currentMapId,
    setCurrentMapId,
    switchToMap,
    removeTemporaryNodes
  };
};