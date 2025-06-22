import { useState, useMemo, useCallback } from 'react';
import { createNewNode, calculateNodePosition, COLORS } from '../utils/dataTypes.js';
import { mindMapLayoutPreserveRoot } from '../utils/autoLayout.js';
import { getCurrentAdapter } from '../utils/storageAdapter.js';

// ノード操作専用のカスタムフック
export const useMindMapNodes = (data, updateData) => {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editText, setEditText] = useState('');

  // 全ノードを平坦化（メモ化）
  const flattenNodes = useCallback((rootNode = data?.rootNode) => {
    if (!rootNode) return [];
    
    const flatten = (node, result = []) => {
      result.push(node);
      node.children?.forEach(child => flatten(child, result));
      return result;
    };
    
    return flatten(rootNode);
  }, [data?.rootNode]);

  // ノードを検索（メモ化）
  const findNode = useCallback((nodeId, rootNode = data?.rootNode) => {
    if (!rootNode || !nodeId) return null;
    if (rootNode.id === nodeId) return rootNode;
    
    for (const child of rootNode.children || []) {
      const found = findNode(nodeId, child);
      if (found) return found;
    }
    return null;
  }, [data?.rootNode]);

  // ノードの親を検索（メモ化）
  const findParentNode = useCallback((nodeId, rootNode = data.rootNode, parent = null) => {
    if (!rootNode || !nodeId) return null;
    if (rootNode.id === nodeId) return parent;
    
    for (const child of rootNode.children || []) {
      const found = findParentNode(nodeId, child, rootNode);
      if (found) return found;
    }
    return null;
  }, [data?.rootNode]);

  // オートレイアウトを適用
  const applyAutoLayout = (rootNode) => {
    const svg = document.querySelector('.mindmap-canvas-container svg');
    const centerX = rootNode.x || (svg?.clientWidth / 2) || 400;
    const centerY = rootNode.y || (svg?.clientHeight / 2) || 300;
    
    return mindMapLayoutPreserveRoot(rootNode, {
      centerX, centerY, baseRadius: 180, levelSpacing: 200,
      minVerticalSpacing: 80, maxVerticalSpacing: 130
    });
  };

  // ノードの色を取得する（親から継承または新規割り当て）
  const getNodeColor = (parentNode, childIndex) => {
    if (parentNode.id === 'root') {
      return COLORS[childIndex % COLORS.length];
    } else {
      return parentNode.color || '#666';
    }
  };

  // ノード更新（完全分離版）
  const updateNode = async (nodeId, updates, syncToCloud = true) => {
    // 1. ローカル状態を即座に更新
    const updateNodeRecursive = (node) => {
      if (node.id === nodeId) return { ...node, ...updates };
      return { ...node, children: node.children?.map(updateNodeRecursive) || [] };
    };
    
    const newData = { ...data, rootNode: updateNodeRecursive(data.rootNode) };
    // ファイル添付などの重要な操作では即座保存
    if (updates.attachments) {
      await updateData(newData, { skipHistory: false, saveImmediately: true });
    } else {
      await updateData(newData, { skipHistory: false, immediate: true });
    }
    
    // 2. ストレージアダプターを通じて反映（現在は無効化）
    if (syncToCloud) {
      console.log('⚠️ ノード個別同期は一時的に無効化されています:', nodeId);
      // APIサーバーのノードエンドポイント修正後に有効化
      /*
      try {
        const adapter = getCurrentAdapter();
        await adapter.updateNode(data.id, nodeId, updates);
        console.log('✅ ノード更新完了:', nodeId);
      } catch (error) {
        console.warn('⚠️ ノード更新失敗:', error.message);
      }
      */
    } else {
      console.log('📝 ローカルのみ更新:', nodeId);
    }
  };

  // 子ノード追加（完全分離版）
  const addChildNode = async (parentId, nodeText = '', startEditing = false) => {
    const parentNode = findNode(parentId);
    if (!parentNode) return null;
    
    const newChild = createNewNode(nodeText, parentNode);
    const childrenCount = parentNode.children?.length || 0;
    const position = calculateNodePosition(parentNode, childrenCount, childrenCount + 1);
    newChild.x = position.x;
    newChild.y = position.y;
    
    // 色を設定
    newChild.color = getNodeColor(parentNode, childrenCount);
    
    // 1. ローカル状態を即座に更新
    const addChildRecursive = (node) => {
      if (node.id === parentId) {
        return { ...node, children: [...(node.children || []), newChild] };
      }
      return { ...node, children: node.children?.map(addChildRecursive) || [] };
    };
    
    let newRootNode = addChildRecursive(data.rootNode);
    if (data.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData = { ...data, rootNode: newRootNode };
    await updateData(newData, { skipHistory: false, saveImmediately: true });
    
    // 2. ストレージアダプターを通じて反映（現在は無効化）
    console.log('⚠️ ノード追加のクラウド同期は一時的に無効化されています:', newChild.id);
    /*
    try {
      const adapter = getCurrentAdapter();
      await adapter.addNode(data.id, newChild, parentId);
      console.log('✅ ノード追加完了:', newChild.id);
    } catch (error) {
      console.warn('⚠️ ノード追加失敗:', error.message);
    }
    */
    
    // 編集状態を同時に設定
    if (startEditing) {
      setSelectedNodeId(newChild.id);
      // 遅延なしで即座に編集モード開始（blur競合を防止）
      setEditingNodeId(newChild.id);
      setEditText(newChild.text || ''); // ノードのテキストを使用
    }
    
    return newChild.id;
  };

  // 兄弟ノードを追加
  const addSiblingNode = (nodeId, nodeText = '', startEditing = false) => {
    if (nodeId === 'root') return addChildNode('root', nodeText, startEditing);
    
    const parentNode = findParentNode(nodeId);
    if (!parentNode) return null;
    
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
    
    const addSiblingRecursive = (node) => {
      if (node.id === parentNode.id) {
        const currentIndex = node.children?.findIndex(child => child.id === nodeId) ?? -1;
        if (currentIndex === -1) return node;
        
        const newChildren = [...(node.children || [])];
        newChildren.splice(currentIndex + 1, 0, newSibling);
        return { ...node, children: newChildren };
      }
      return { ...node, children: node.children?.map(addSiblingRecursive) || [] };
    };
    
    let newRootNode = addSiblingRecursive(data.rootNode);
    if (data.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    updateData({ ...data, rootNode: newRootNode });
    
    // 編集状態を同時に設定
    if (startEditing) {
      setSelectedNodeId(newSibling.id);
      // 遅延なしで即座に編集モード開始（blur競合を防止）
      setEditingNodeId(newSibling.id);
      setEditText(newSibling.text || ''); // ノードのテキストを使用
    }
    
    return newSibling.id;
  };

  // ノードを削除（即座DB反映）
  const deleteNode = async (nodeId) => {
    if (nodeId === 'root') return false;
    
    // 削除後に選択するノードを決定
    let nodeToSelect = null;
    const parentNode = findParentNode(nodeId);
    
    if (parentNode && parentNode.children) {
      const currentIndex = parentNode.children.findIndex(child => child.id === nodeId);
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
    
    // 1. ローカル状態を即座に更新
    const deleteNodeRecursive = (node) => {
      return {
        ...node,
        children: (node.children || [])
          .filter(child => child.id !== nodeId)
          .map(deleteNodeRecursive)
      };
    };
    
    let newRootNode = deleteNodeRecursive(data.rootNode);
    if (data.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData = { ...data, rootNode: newRootNode };
    await updateData(newData, { skipHistory: false, saveImmediately: true });
    
    // 2. ストレージアダプターを通じて反映（現在は無効化）
    console.log('⚠️ ノード削除のクラウド同期は一時的に無効化されています:', nodeId);
    /*
    try {
      const adapter = getCurrentAdapter();
      await adapter.deleteNode(data.id, nodeId);
      console.log('✅ ノード削除完了:', nodeId);
    } catch (error) {
      console.warn('⚠️ ノード削除失敗:', error.message);
    }
    */
    
    // 削除されたノードが選択されていた場合、決定されたノードを選択
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(nodeToSelect);
    }
    if (editingNodeId === nodeId) setEditingNodeId(null);
    
    return true;
  };

  // ノードをドラッグで移動（ローカルのみ、クラウド同期なし）
  const dragNode = (nodeId, x, y) => {
    updateNode(nodeId, { x, y }, false);
  };

  // ノードの親を変更
  const changeParent = (nodeId, newParentId) => {
    if (nodeId === 'root' || nodeId === newParentId) return false;
    
    // 循環参照防止
    const isDescendant = (parentId, childId) => {
      const parent = findNode(parentId);
      if (!parent || !parent.children) return false;
      
      return parent.children.some(child => 
        child.id === childId || isDescendant(child.id, childId)
      );
    };
    
    if (isDescendant(nodeId, newParentId)) {
      console.warn('循環参照が発生するため、親要素を変更できません');
      return false;
    }
    
    const nodeToMove = findNode(nodeId);
    const newParent = findNode(newParentId);
    
    if (!nodeToMove || !newParent) return false;
    
    // 現在の親から削除
    const removeFromParent = (node) => {
      return {
        ...node,
        children: (node.children || [])
          .filter(child => child.id !== nodeId)
          .map(removeFromParent)
      };
    };
    
    // 新しい親に追加
    const addToNewParent = (node) => {
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
        children: node.children?.map(addToNewParent) || []
      };
    };
    
    let newRootNode = removeFromParent(data.rootNode);
    newRootNode = addToNewParent(newRootNode);
    
    if (data.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    updateData(
      { ...data, rootNode: newRootNode },
      {
        operationType: 'node_move',
        operationData: {
          nodeId,
          newPosition: { x: nodeToMove.x, y: nodeToMove.y },
          newParentId
        }
      }
    );
    return true;
  };

  // 編集開始
  const startEdit = (nodeId, clearText = false) => {
    const node = findNode(nodeId);
    if (node) {
      setEditingNodeId(nodeId);
      setEditText(clearText ? '' : node.text);
      setSelectedNodeId(nodeId);
    }
  };

  // 編集終了
  const finishEdit = (nodeId, newText, options = {}) => {
    // newTextがundefinedの場合は現在のeditTextを使用
    const textToSave = newText !== undefined ? newText : editText;
    const currentNode = findNode(nodeId);
    const { allowDelete = true } = options;
    
    console.log('📝 finishEdit - 詳細入力:', { 
      nodeId, 
      newText, 
      editText, 
      textToSave,
      isEmpty: !textToSave || textToSave.trim() === '',
      currentNodeText: currentNode?.text,
      isRoot: nodeId === 'root',
      allowDelete
    });
    
    const isEmpty = !textToSave || textToSave.trim() === '';
    const isRoot = nodeId === 'root';
    
    // 削除判定：明確な条件でのみ削除
    const shouldDelete = isEmpty && !isRoot && allowDelete && currentNode && (
      // 既存ノードが元々空だった場合（新規作成後に内容を入力せずにblur）
      !currentNode.text || currentNode.text.trim() === ''
    );
    
    if (shouldDelete) {
      console.log('🗑️ ノード削除実行:', { 
        nodeId, 
        reason: '空の新規ノードまたは内容を削除したノード',
        originalText: currentNode?.text
      });
      setEditingNodeId(null);
      setEditText('');
      deleteNode(nodeId);
      return;
    }
    
    if (isEmpty && !isRoot) {
      console.log('⚠️ 空のテキストだが削除しない:', { 
        nodeId, 
        reason: allowDelete ? '既存の内容があったノード' : '削除が無効化されている',
        originalText: currentNode?.text
      });
      // 空でも既存の内容があった場合は削除せず、元の内容を復元
      if (currentNode?.text) {
        updateNode(nodeId, { text: currentNode.text });
      }
    } else if (!isEmpty) {
      console.log('📝 finishEdit - 保存するテキスト:', textToSave.trim());
      updateNode(nodeId, { text: textToSave.trim() });
    }
    
    setEditingNodeId(null);
    setEditText('');
  };

  // 折りたたみ状態をトグル
  const toggleCollapse = (nodeId) => {
    const toggleNodeRecursive = (node) => {
      if (node.id === nodeId) return { ...node, collapsed: !node.collapsed };
      return { ...node, children: node.children?.map(toggleNodeRecursive) || [] };
    };
    
    updateData({ ...data, rootNode: toggleNodeRecursive(data.rootNode) });
  };

  return {
    selectedNodeId,
    editingNodeId,
    editText,
    setSelectedNodeId,
    setEditText,
    updateNode,
    addChildNode,
    addSiblingNode,
    deleteNode,
    dragNode,
    changeParent,
    findNode,
    findParentNode,
    flattenNodes,
    applyAutoLayout,
    startEdit,
    finishEdit,
    toggleCollapse
  };
};