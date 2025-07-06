import { useState, useCallback, useRef, useEffect } from 'react';
import { createNewNode, calculateNodePosition, COLORS, deepClone, MindMapData } from '../../shared/types/dataTypes';
import type { MindMapNode } from '../../../shared/types';
import { mindMapLayoutPreserveRoot } from '../../shared/utils/autoLayout';

// ノード操作専用のカスタムフック（Local版）
export const useMindMapNodes = (data: MindMapData | null, updateData: (data: MindMapData, options?: { [key: string]: unknown }) => void, refreshAllMindMaps: (() => void) | null = null) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  
  // 最新のdataを参照するためのref
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // 全ノードを平坦化（メモ化）
  const flattenNodes = useCallback((rootNode = data?.rootNode): MindMapNode[] => {
    if (!rootNode) return [];
    
    const flatten = (node: MindMapNode, result: MindMapNode[] = []): MindMapNode[] => {
      result.push(node);
      node.children?.forEach((child: MindMapNode) => flatten(child, result));
      return result;
    };
    
    return flatten(rootNode);
  }, [data?.rootNode]);

  // ノードを検索（メモ化）
  const findNode = useCallback((nodeId: string, rootNode = data?.rootNode): MindMapNode | null => {
    if (!rootNode || !nodeId) return null;
    if (rootNode.id === nodeId) return rootNode;
    
    for (const child of rootNode.children || []) {
      const found: MindMapNode | null = findNode(nodeId, child);
      if (found) return found;
    }
    return null;
  }, [data?.rootNode]);

  // ノードの親を検索（メモ化）
  const findParentNode = useCallback((nodeId: string, rootNode = data?.rootNode, parent: MindMapNode | null = null): MindMapNode | null => {
    if (!rootNode || !nodeId) return null;
    if (rootNode.id === nodeId) return parent;
    
    for (const child of rootNode.children || []) {
      const found: MindMapNode | null = findParentNode(nodeId, child, rootNode);
      if (found) return found;
    }
    return null;
  }, [data?.rootNode]);

  // 元の自動レイアウトロジックを保持（後方互換性のため）
  const applyAutoLayout = (rootNode: MindMapNode): MindMapNode => {
    const svg = document.querySelector('.mindmap-canvas-container svg') as SVGSVGElement | null;
    const centerX = rootNode.x || (svg?.clientWidth ? svg.clientWidth / 2 : 400);
    const centerY = rootNode.y || (svg?.clientHeight ? svg.clientHeight / 2 : 300);
    
    return mindMapLayoutPreserveRoot(rootNode, {
      centerX, centerY, baseRadius: 180, levelSpacing: 200,
      minVerticalSpacing: 40, maxVerticalSpacing: 65
    });
  };


  // ノードの色を取得する（親から継承または新規割り当て）
  const getNodeColor = (parentNode: MindMapNode, childIndex: number): string => {
    if (parentNode.id === 'root') {
      return COLORS[childIndex % COLORS.length];
    } else {
      return parentNode.color || '#666';
    }
  };

  // ノード更新（Local版）
  const updateNode = async (nodeId: string, updates: Partial<MindMapNode>, options: { source?: string; allowDuringEdit?: boolean } = {}) => {
    console.log('📝 updateNode開始:', { nodeId, updates });
    
    const currentData = dataRef.current;
    if (!currentData) return;
    
    const clonedData = deepClone(currentData);
    
    const updateNodeRecursive = (node: MindMapNode): MindMapNode => {
      if (node.id === nodeId) {
        Object.assign(node, updates);
        return node;
      }
      if (node.children) {
        node.children.forEach((child: MindMapNode) => updateNodeRecursive(child));
      }
      return node;
    };
    
    updateNodeRecursive(clonedData.rootNode);
    
    const updateOptions = {
      skipHistory: false,
      source: options.source || 'updateNode',
      allowDuringEdit: options.allowDuringEdit || false,
      immediate: true
    };
    
    await updateData(clonedData, { ...updateOptions, saveImmediately: true });
    
    console.log('✅ ローカル状態更新完了:', nodeId);
  };

  // 子ノード追加（Local版）
  const addChildNode = async (parentId: string, nodeText = '', startEditing = false): Promise<string | null> => {
    const parentNode = findNode(parentId);
    if (!parentNode) return null;
    
    console.log('🔄 子ノード追加開始:', { parentId, nodeText, startEditing });
    
    // 新しい子ノードを作成
    const newChild = createNewNode(nodeText, parentNode);
    const childrenCount = parentNode.children?.length || 0;
    const position = calculateNodePosition(parentNode, childrenCount, childrenCount + 1);
    newChild.x = position.x;
    newChild.y = position.y;
    newChild.color = getNodeColor(parentNode, childrenCount);
    
    console.log('📝 子ノード作成:', newChild.id);
    
    // ローカル状態を更新
    const currentData = dataRef.current;
    if (!currentData) return null;
    
    const clonedData = deepClone(currentData);
    
    const addChildRecursive = (node: MindMapNode): MindMapNode => {
      if (node.id === parentId) {
        if (!node.children) {
          node.children = [];
        }
        node.children.push(newChild);
        return node;
      }
      if (node.children) {
        node.children.forEach((child: MindMapNode) => addChildRecursive(child));
      }
      return node;
    };
    
    addChildRecursive(clonedData.rootNode);
    
    let newRootNode = clonedData.rootNode;
    if (clonedData.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData: MindMapData = { 
      ...clonedData, 
      rootNode: newRootNode,
      updatedAt: new Date().toISOString()
    };
    await updateData(newData, { skipHistory: false, immediate: true, saveImmediately: true });
    
    console.log('✅ 子ノード作成完了:', newChild.id);
    
    // マップ一覧のノード数を更新
    if (refreshAllMindMaps) {
      await refreshAllMindMaps();
    }
    
    // 編集状態を設定
    if (startEditing) {
      setSelectedNodeId(newChild.id);
      setEditingNodeId(newChild.id);
      setEditText(newChild.text || '');
    }
    
    return newChild.id;
  };

  // 兄弟ノードを追加（Local版）
  const addSiblingNode = async (nodeId: string, nodeText = '', startEditing = false): Promise<string | null> => {
    if (nodeId === 'root') return addChildNode('root', nodeText, startEditing);
    
    const parentNode = findParentNode(nodeId);
    if (!parentNode) return null;
    
    console.log('🔄 兄弟ノード追加開始:', { nodeId, parentNode: parentNode.id, nodeText, startEditing });
    
    // 新しい兄弟ノードを作成
    const newSibling = createNewNode(nodeText, parentNode);
    
    // 色の設定
    if (parentNode.id === 'root') {
      const siblingIndex = parentNode.children?.length || 0;
      newSibling.color = getNodeColor(parentNode, siblingIndex);
    } else {
      const existingSibling = findNode(nodeId);
      if (existingSibling) {
        newSibling.color = existingSibling.color;
      } else {
        newSibling.color = parentNode.color || '#666';
      }
    }
    
    console.log('📝 兄弟ノード作成:', newSibling.id);
    
    // ローカル状態を更新
    const currentData = dataRef.current;
    if (!currentData) return null;
    
    const clonedData = deepClone(currentData);
    
    const addSiblingRecursive = (node: MindMapNode): MindMapNode => {
      if (node.id === parentNode.id) {
        const currentIndex = node.children?.findIndex((child: MindMapNode) => child.id === nodeId) ?? -1;
        if (currentIndex === -1) return node;
        
        const newChildren = [...(node.children || [])];
        newChildren.splice(currentIndex + 1, 0, newSibling);
        return { ...node, children: newChildren };
      }
      return { ...node, children: node.children?.map((child: MindMapNode) => addSiblingRecursive(child)) || [] };
    };
    
    let newRootNode = addSiblingRecursive(clonedData.rootNode);
    if (clonedData.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData: MindMapData = { 
      ...clonedData, 
      rootNode: newRootNode,
      updatedAt: new Date().toISOString()
    };
    await updateData(newData, { skipHistory: false, immediate: true, saveImmediately: true });
    
    console.log('✅ 兄弟ノード作成完了:', newSibling.id);
    
    // マップ一覧のノード数を更新
    if (refreshAllMindMaps) {
      await refreshAllMindMaps();
    }
    
    // 編集状態を設定
    if (startEditing) {
      setSelectedNodeId(newSibling.id);
      setEditingNodeId(newSibling.id);
      setEditText(newSibling.text || '');
    }
    
    return newSibling.id;
  };

  // ノードを削除（Local版）
  const deleteNode = async (nodeId: string): Promise<boolean> => {
    if (nodeId === 'root') return false;
    
    console.log('🗑️ deleteNode実行開始:', { nodeId, timestamp: Date.now() });
    
    // 削除後に選択するノードを決定
    let nodeToSelect = null;
    const parentNode = findParentNode(nodeId);
    
    if (parentNode && parentNode.children) {
      const currentIndex = parentNode.children.findIndex((child: MindMapNode) => child.id === nodeId);
      if (currentIndex !== -1) {
        const siblings = parentNode.children;
        
        if (currentIndex < siblings.length - 1) {
          nodeToSelect = siblings[currentIndex + 1].id;
        } else if (currentIndex > 0) {
          nodeToSelect = siblings[currentIndex - 1].id;
        } else {
          nodeToSelect = parentNode.id;
        }
      }
    }
    
    if (!nodeToSelect) {
      nodeToSelect = 'root';
    }
    
    // ローカル状態を更新
    console.log('📝 ローカル状態更新開始');
    const currentData = dataRef.current;
    if (!currentData) return false;
    
    const clonedData = deepClone(currentData);
    
    const deleteNodeRecursive = (node: MindMapNode): MindMapNode => {
      if (node.children) {
        node.children = node.children.filter((child: MindMapNode) => child.id !== nodeId);
        node.children.forEach((child: MindMapNode) => deleteNodeRecursive(child));
      }
      return node;
    };
    
    deleteNodeRecursive(clonedData.rootNode);
    
    let newRootNode = clonedData.rootNode;
    if (clonedData.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData: MindMapData = { 
      ...clonedData, 
      rootNode: newRootNode,
      updatedAt: new Date().toISOString()
    };
    await updateData(newData, { skipHistory: false, immediate: true, saveImmediately: true });
    
    console.log('✅ ローカル状態更新完了:', nodeId);
    
    // マップ一覧のノード数を更新
    if (refreshAllMindMaps) {
      await refreshAllMindMaps();
    }
    
    // 削除されたノードが選択されていた場合、決定されたノードを選択
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(nodeToSelect);
    }
    if (editingNodeId === nodeId) setEditingNodeId(null);
    
    return true;
  };

  // ノードをドラッグで移動（Local版）
  const dragNode = (nodeId: string, x: number, y: number): void => {
    updateNode(nodeId, { x, y });
  };

  // 兄弟ノードの順序を変更（Local版）
  const changeSiblingOrder = async (draggedNodeId: string, targetNodeId: string, insertBefore: boolean = true): Promise<boolean> => {
    console.log('🔄 兄弟順序変更開始:', { draggedNodeId, targetNodeId, insertBefore });
    
    if (draggedNodeId === 'root' || targetNodeId === 'root' || draggedNodeId === targetNodeId) {
      console.log('🚫 ルートノードまたは同一ノードの順序変更をスキップ');
      return false;
    }
    
    // 両方のノードの親を確認
    const draggedParent = findParentNode(draggedNodeId);
    const targetParent = findParentNode(targetNodeId);
    
    if (!draggedParent || !targetParent || draggedParent.id !== targetParent.id) {
      console.log('🚫 異なる親を持つノード同士の順序変更はできません');
      return false;
    }
    
    const currentData = dataRef.current;
    if (!currentData || !draggedParent.children) return false;
    
    const clonedData = deepClone(currentData);
    
    // 親ノード内での順序変更処理
    const reorderSiblings = (node: MindMapNode): MindMapNode => {
      if (node.id === draggedParent.id && node.children) {
        const children = [...node.children];
        
        // ドラッグされたノードとターゲットノードのインデックスを取得
        const draggedIndex = children.findIndex(child => child.id === draggedNodeId);
        const targetIndex = children.findIndex(child => child.id === targetNodeId);
        
        if (draggedIndex === -1 || targetIndex === -1) {
          console.error('❌ ノードのインデックスが見つかりません');
          return node;
        }
        
        // ドラッグされたノードを削除
        const draggedNode = children.splice(draggedIndex, 1)[0];
        
        // 新しい挿入位置を計算（削除後のインデックスを考慮）
        let newTargetIndex = targetIndex;
        if (draggedIndex < targetIndex) {
          newTargetIndex--; // ドラッグノードが前にあった場合、削除でインデックスが1つ減る
        }
        
        // 挿入位置を決定
        const insertIndex = insertBefore ? newTargetIndex : newTargetIndex + 1;
        
        // 新しい位置に挿入
        children.splice(insertIndex, 0, draggedNode);
        
        console.log('🔄 順序変更完了:', { 
          draggedIndex, 
          targetIndex: newTargetIndex, 
          insertIndex,
          newOrder: children.map(c => c.id)
        });
        
        return { ...node, children };
      }
      
      return {
        ...node,
        children: node.children?.map(child => reorderSiblings(child)) || []
      };
    };
    
    let newRootNode = reorderSiblings(clonedData.rootNode);
    
    if (clonedData.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData = { ...clonedData, rootNode: newRootNode, updatedAt: new Date().toISOString() };
    
    try {
      await updateData(newData, {
        skipHistory: false,
        immediate: true,
        operationType: 'sibling_reorder',
        operationData: {
          draggedNodeId,
          targetNodeId,
          insertBefore,
          parentId: draggedParent.id
        }
      });
      console.log('✅ 兄弟順序変更完了:', { draggedNodeId, targetNodeId });
      return true;
    } catch (error) {
      console.error('❌ 兄弟順序変更エラー:', error);
      return false;
    }
  };

  // ノードの親を変更（Local版）
  const changeParent = async (nodeId: string, newParentId: string): Promise<boolean> => {
    console.log('🔄 changeParent関数開始:', { nodeId, newParentId });
    
    if (nodeId === 'root' || nodeId === newParentId) {
      console.log('🚫 ルートノードまたは自分自身への変更をスキップ');
      return false;
    }
    
    // 循環参照防止
    const isDescendant = (parentId: string, childId: string): boolean => {
      const parent = findNode(parentId);
      if (!parent || !parent.children) return false;
      
      return parent.children.some((child: MindMapNode) => 
        child.id === childId || isDescendant(child.id, childId)
      );
    };
    
    if (isDescendant(nodeId, newParentId)) {
      console.warn('🚫 循環参照が発生するため、親要素を変更できません');
      return false;
    }
    
    const nodeToMove = findNode(nodeId);
    const newParent = findNode(newParentId);
    
    console.log('🔍 ノード検索結果:', { 
      nodeToMove: !!nodeToMove, 
      newParent: !!newParent,
      nodeToMoveTitle: nodeToMove?.text,
      newParentTitle: newParent?.text 
    });
    
    if (!nodeToMove || !newParent) {
      console.error('❌ ノードまたは新しい親が見つからない');
      return false;
    }
    
    console.log('🔄 ノード親変更開始:', { nodeId, newParentId });
    
    // ローカル状態を更新
    console.log('📝 ローカル状態更新開始');
    const currentData = dataRef.current;
    if (!currentData) return false;
    const clonedData = deepClone(currentData);
    
    // 現在の親から削除
    const removeFromParent = (node: MindMapNode): MindMapNode => {
      return {
        ...node,
        children: (node.children || [])
          .filter((child: MindMapNode) => child.id !== nodeId)
          .map((child: MindMapNode) => removeFromParent(child))
      };
    };
    
    // 新しい親に追加
    const addToNewParent = (node: MindMapNode): MindMapNode => {
      if (node.id === newParentId) {
        const childrenCount = node.children?.length || 0;
        const updatedNode = {
          ...nodeToMove,
          color: getNodeColor(newParent, childrenCount)
        };
        
        return {
          ...node,
          children: [...(node.children || []), updatedNode]
        };
      }
      return {
        ...node,
        children: node.children?.map((child: MindMapNode) => addToNewParent(child)) || []
      };
    };
    
    let newRootNode = removeFromParent(clonedData.rootNode);
    newRootNode = addToNewParent(newRootNode);
    
    if (clonedData.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData = { ...clonedData, rootNode: newRootNode };
    console.log('📝 updateData実行前の状態:', { 
      hasNewData: !!newData, 
      hasRootNode: !!newData.rootNode 
    });
    
    try {
      await updateData(newData, {
        skipHistory: false,
        immediate: true,
        operationType: 'node_move',
        operationData: {
          nodeId,
          newPosition: { x: nodeToMove.x, y: nodeToMove.y },
          newParentId
        }
      });
      console.log('✅ ローカル状態更新完了:', nodeId);
      return true;
    } catch (error) {
      console.error('❌ updateData実行エラー:', error);
      return false;
    }
  };

  // 編集開始
  const startEdit = (nodeId: string, clearText = false): void => {
    const node = findNode(nodeId);
    if (node) {
      setEditingNodeId(nodeId);
      setEditText(clearText ? '' : node.text);
      setSelectedNodeId(nodeId);
    }
  };

  // 編集終了（Local版）
  const finishEdit = async (nodeId: string, newText?: string, options: { skipMapSwitchDelete?: boolean; skipEditStateReset?: boolean } = {}): Promise<void> => {
    // newTextがundefinedの場合は現在のeditTextを使用
    const textToSave = newText !== undefined ? newText : editText;
    const currentNode = findNode(nodeId);
    
    const isEmpty = !textToSave || textToSave.trim() === '';
    const isRoot = nodeId === 'root';
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📝 finishEdit (Local):', { 
        nodeId, 
        isEmpty,
        isRoot,
        hasCurrentNode: !!currentNode,
        skipMapSwitchDelete: options.skipMapSwitchDelete
      });
    }
    
    // 空文字で確定した場合はノードを削除（ルート以外、マップ切り替え時除く）
    if (isEmpty && !isRoot && currentNode && !options.skipMapSwitchDelete) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🗑️ 空文字確定でノード削除 (Local):', nodeId);
      }
      setEditingNodeId(null);
      setEditText('');
      await deleteNode(nodeId);
      return;
    }
    
    // テキストを保存
    if (!isEmpty) {
      if (process.env.NODE_ENV === 'development') {
        console.log('💾 テキスト保存 (Local):', { nodeId, text: textToSave.trim() });
      }
      await updateNode(nodeId, { text: textToSave.trim() }, { 
        allowDuringEdit: true, 
        source: 'finishEdit-local' 
      });
    }
    
    // 編集状態のリセット（簡素化）
    if (!options.skipEditStateReset) {
      setEditingNodeId(null);
      setEditText('');
    }
  };

  // 折りたたみ状態をトグル（スムーズなアニメーション付き）
  const toggleCollapse = async (nodeId: string): Promise<void> => {
    const currentData = dataRef.current;
    if (!currentData) return;
    
    const clonedData = deepClone(currentData);
    
    const toggleNodeRecursive = (node: MindMapNode): MindMapNode => {
      if (node.id === nodeId) return { ...node, collapsed: !node.collapsed };
      return { ...node, children: node.children?.map((child: MindMapNode) => toggleNodeRecursive(child)) || [] };
    };
    
    const updatedRootNode = toggleNodeRecursive(clonedData.rootNode);
    
    // まず折りたたみ状態のみを更新（レイアウトは後で適用）
    const intermediateData: MindMapData = { 
      ...clonedData, 
      rootNode: updatedRootNode,
      updatedAt: new Date().toISOString()
    };
    
    await updateData(intermediateData, { skipHistory: false, immediate: true, saveImmediately: false });
    
    // 少し遅延を入れてからレイアウトを適用（自然なアニメーション）
    if (clonedData.settings?.autoLayout !== false) {
      setTimeout(async () => {
        const currentDataForLayout = dataRef.current;
        if (!currentDataForLayout) return;
        
        const layoutData = deepClone(currentDataForLayout);
        const finalRootNode = applyAutoLayout(layoutData.rootNode);
        
        const finalData: MindMapData = { 
          ...layoutData, 
          rootNode: finalRootNode,
          updatedAt: new Date().toISOString()
        };
        
        await updateData(finalData, { skipHistory: false, immediate: true, saveImmediately: true });
      }, 30); // 30ms の遅延
    }
  };


  // 全体レイアウトを適用する関数
  const applyFullLayout = async (): Promise<void> => {
    const currentData = dataRef.current;
    if (!currentData) return;
    
    const clonedData = deepClone(currentData);
    const newRootNode = applyAutoLayout(clonedData.rootNode);
    
    const newData: MindMapData = { 
      ...clonedData, 
      rootNode: newRootNode,
      updatedAt: new Date().toISOString()
    };
    
    await updateData(newData, { skipHistory: false, immediate: true, saveImmediately: true });
  };

  return {
    selectedNodeId,
    editingNodeId,
    editText,
    setSelectedNodeId,
    setEditingNodeId,
    setEditText,
    updateNode,
    addChildNode,
    addSiblingNode,
    deleteNode,
    dragNode,
    changeParent,
    changeSiblingOrder,
    findNode,
    findParentNode,
    flattenNodes,
    applyAutoLayout,
    applyFullLayout,
    startEdit,
    finishEdit,
    toggleCollapse
  };
};