// 新しいDataManagerベースのノード操作フック
import { useState, useCallback, useMemo } from 'react';
import { createNewNode, calculateNodePosition, COLORS } from '../utils/dataTypes.js';
import { mindMapLayoutPreserveRoot } from '../utils/autoLayout.js';

export const useMindMapNodesV2 = (data, dataOperations) => {
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
  const findParentNode = useCallback((nodeId, rootNode = data?.rootNode, parent = null) => {
    if (!rootNode || !nodeId) return null;
    if (rootNode.id === nodeId) return parent;
    
    for (const child of rootNode.children || []) {
      const found = findParentNode(nodeId, child, rootNode);
      if (found) return found;
    }
    return null;
  }, [data?.rootNode]);

  // オートレイアウトを適用
  const applyAutoLayout = useCallback((rootNode) => {
    const svg = document.querySelector('.mindmap-canvas-container svg');
    const centerX = rootNode.x || (svg?.clientWidth / 2) || 400;
    const centerY = rootNode.y || (svg?.clientHeight / 2) || 300;
    
    return mindMapLayoutPreserveRoot(rootNode, {
      centerX, centerY, baseRadius: 180, levelSpacing: 200,
      minVerticalSpacing: 80, maxVerticalSpacing: 130
    });
  }, []);

  // ノードの色を取得する（親から継承または新規割り当て）
  const getNodeColor = useCallback((parentNode, childIndex) => {
    if (parentNode.id === 'root') {
      return COLORS[childIndex % COLORS.length];
    } else {
      return parentNode.color || '#666';
    }
  }, []);

  // ノード更新（DataManager経由）
  const updateNode = useCallback(async (nodeId, updates) => {
    console.log('📝 NodesV2: ノード更新', { nodeId, updates });
    
    if (updates.text !== undefined) {
      // テキスト更新
      return await dataOperations.updateNodeText(nodeId, updates.text);
    } else if (updates.attachments !== undefined) {
      // ファイル添付の場合は直接的な更新が必要
      // 現在のDataManagerは個別プロパティ更新をサポートしていないため、
      // 一時的にレガシー方式を使用
      console.warn('⚠️ NodesV2: attachments更新はレガシー方式を使用');
      
      const currentNode = findNode(nodeId);
      if (currentNode) {
        const updateNodeRecursive = (node) => {
          if (node.id === nodeId) return { ...node, ...updates };
          return { ...node, children: node.children?.map(updateNodeRecursive) || [] };
        };
        
        const newData = { ...data, rootNode: updateNodeRecursive(data.rootNode) };
        // レガシーupdateDataを使用（将来的にDataManagerで対応）
        await dataOperations.updateData?.(newData, { saveImmediately: true });
      }
    } else {
      // 位置更新など
      return await dataOperations.moveNode(nodeId, updates.x, updates.y);
    }
  }, [data, dataOperations, findNode]);

  // 子ノード追加（DataManager経由）
  const addChildNode = useCallback(async (parentId, nodeText = '', startEditing = false) => {
    const parentNode = findNode(parentId);
    if (!parentNode) return null;
    
    console.log('➕ NodesV2: 子ノード追加', { parentId, nodeText });
    
    const newChild = createNewNode(nodeText, parentNode);
    const childrenCount = parentNode.children?.length || 0;
    const position = calculateNodePosition(parentNode, childrenCount, childrenCount + 1);
    newChild.x = position.x;
    newChild.y = position.y;
    
    // 色を設定
    newChild.color = getNodeColor(parentNode, childrenCount);
    
    // DataManager経由で追加
    const result = await dataOperations.addNode(parentId, newChild);
    
    if (result.success) {
      // オートレイアウトの適用（必要に応じて）
      if (data.settings?.autoLayout !== false) {
        const newLayout = applyAutoLayout(result.data.rootNode);
        await dataOperations.updateLayout(newLayout);
      }
      
      // 編集状態を同時に設定
      if (startEditing) {
        setSelectedNodeId(newChild.id);
        setEditingNodeId(newChild.id);
        setEditText('');
      }
      
      return newChild.id;
    }
    
    return null;
  }, [data, dataOperations, findNode, getNodeColor, applyAutoLayout]);

  // 兄弟ノードを追加
  const addSiblingNode = useCallback(async (nodeId, nodeText = '', startEditing = false) => {
    if (nodeId === 'root') return addChildNode('root', nodeText, startEditing);
    
    console.log('👥 NodesV2: 兄弟ノード追加', { nodeId, nodeText });
    
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
    
    // 挿入位置を計算
    const currentIndex = parentNode.children?.findIndex(child => child.id === nodeId) ?? -1;
    const insertPosition = currentIndex + 1;
    
    // DataManager経由で追加
    const result = await dataOperations.addNode(parentNode.id, newSibling, insertPosition);
    
    if (result.success) {
      // オートレイアウトの適用
      if (data.settings?.autoLayout !== false) {
        const newLayout = applyAutoLayout(result.data.rootNode);
        await dataOperations.updateLayout(newLayout);
      }
      
      // 編集状態を同時に設定
      if (startEditing) {
        setSelectedNodeId(newSibling.id);
        setEditingNodeId(newSibling.id);
        setEditText('');
      }
      
      return newSibling.id;
    }
    
    return null;
  }, [data, dataOperations, findNode, findParentNode, getNodeColor, addChildNode, applyAutoLayout]);

  // ノードを削除（DataManager経由）
  const deleteNode = useCallback(async (nodeId) => {
    if (nodeId === 'root') return false;
    
    console.log('🗑️ NodesV2: ノード削除', { nodeId });
    
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
    
    // DataManager経由で削除
    const result = await dataOperations.deleteNode(nodeId);
    
    if (result.success) {
      // オートレイアウトの適用
      if (data.settings?.autoLayout !== false) {
        const newLayout = applyAutoLayout(result.data.rootNode);
        await dataOperations.updateLayout(newLayout);
      }
      
      // 削除されたノードが選択されていた場合、決定されたノードを選択
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(nodeToSelect);
      }
      if (editingNodeId === nodeId) setEditingNodeId(null);
      
      return true;
    }
    
    return false;
  }, [data, dataOperations, findParentNode, selectedNodeId, editingNodeId, applyAutoLayout]);

  // ノードをドラッグで移動
  const dragNode = useCallback(async (nodeId, x, y) => {
    console.log('🖱️ NodesV2: ドラッグ移動', { nodeId, x, y });
    return await dataOperations.moveNode(nodeId, x, y);
  }, [dataOperations]);

  // ノードの親を変更
  const changeParent = useCallback(async (nodeId, newParentId) => {
    if (nodeId === 'root' || nodeId === newParentId) return false;
    
    console.log('🔄 NodesV2: 親ノード変更', { nodeId, newParentId });
    
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
    
    // 色を新しい親に合わせて更新
    const childrenCount = newParent.children?.length || 0;
    const updatedNode = {
      ...nodeToMove,
      color: getNodeColor(newParent, childrenCount)
    };
    
    // DataManagerでは親変更の直接操作が未実装のため、
    // 一時的にレガシー方式を使用
    console.warn('⚠️ NodesV2: 親変更はレガシー方式を使用');
    
    // 1. 元の位置から削除
    const removeResult = await dataOperations.deleteNode(nodeId);
    if (!removeResult.success) return false;
    
    // 2. 新しい親に追加
    const addResult = await dataOperations.addNode(newParentId, updatedNode);
    if (!addResult.success) {
      // 失敗した場合のロールバックは複雑なので、エラーログのみ
      console.error('❌ NodesV2: 親変更時の追加に失敗');
      return false;
    }
    
    // オートレイアウトの適用
    if (data.settings?.autoLayout !== false) {
      const newLayout = applyAutoLayout(addResult.data.rootNode);
      await dataOperations.updateLayout(newLayout);
    }
    
    return true;
  }, [data, dataOperations, findNode, getNodeColor, applyAutoLayout]);

  // 編集開始
  const startEdit = useCallback((nodeId, clearText = false) => {
    const node = findNode(nodeId);
    if (node) {
      setEditingNodeId(nodeId);
      setEditText(clearText ? '' : node.text);
      setSelectedNodeId(nodeId);
      console.log('✏️ NodesV2: 編集開始', { nodeId, text: node.text });
    }
  }, [findNode]);

  // 編集終了
  const finishEdit = useCallback(async (nodeId, newText) => {
    console.log('✅ NodesV2: 編集終了', { nodeId, newText });
    
    if (newText.trim() === '') {
      setEditingNodeId(null);
      setEditText('');
      if (nodeId !== 'root') {
        await deleteNode(nodeId);
      }
      return;
    }
    
    await updateNode(nodeId, { text: newText.trim() });
    setEditingNodeId(null);
    setEditText('');
  }, [updateNode, deleteNode]);

  // 折りたたみ状態をトグル
  const toggleCollapse = useCallback(async (nodeId) => {
    console.log('📁 NodesV2: 折りたたみトグル', { nodeId });
    
    const node = findNode(nodeId);
    if (node) {
      // 現在はDataManagerで折りたたみ状態の専用操作がないため、
      // 一時的にレガシー方式を使用
      console.warn('⚠️ NodesV2: 折りたたみはレガシー方式を使用');
      
      const toggleNodeRecursive = (node) => {
        if (node.id === nodeId) return { ...node, collapsed: !node.collapsed };
        return { ...node, children: node.children?.map(toggleNodeRecursive) || [] };
      };
      
      const newData = { ...data, rootNode: toggleNodeRecursive(data.rootNode) };
      await dataOperations.updateData?.(newData, { immediate: true });
    }
  }, [data, dataOperations, findNode]);

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