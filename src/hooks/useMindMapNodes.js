import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createNewNode, calculateNodePosition, COLORS, deepClone } from '../utils/dataTypes.js';
import { mindMapLayoutPreserveRoot } from '../utils/autoLayout.js';
import { getCurrentAdapter } from '../utils/storageAdapter.js';

// ノード操作専用のカスタムフック
export const useMindMapNodes = (data, updateData) => {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editText, setEditText] = useState('');
  
  // 最新のdataを参照するためのref
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

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

  // ノード更新（DB-First方式）
  const updateNode = async (nodeId, updates, syncToCloud = true, options = {}) => {
    console.log('📝 updateNode開始:', { nodeId, updates, syncToCloud });
    
    // syncToCloudがfalseの場合（ドラッグ操作など）は従来通りローカル先行
    if (!syncToCloud) {
      console.log('📝 ローカルのみ更新:', nodeId);
      const currentData = dataRef.current;
      const clonedData = deepClone(currentData);
      
      const updateNodeRecursive = (node) => {
        if (node.id === nodeId) {
          Object.assign(node, updates);
          return node;
        }
        if (node.children) {
          node.children.forEach(updateNodeRecursive);
        }
        return node;
      };
      
      updateNodeRecursive(clonedData.rootNode);
      
      const updateOptions = {
        skipHistory: false,
        source: options.source || 'updateNode-local',
        allowDuringEdit: options.allowDuringEdit || false,
        immediate: true
      };
      
      await updateData(clonedData, updateOptions);
      return;
    }
    
    // 1. 最初にDB操作を実行（syncToCloudがtrueの場合）
    let dbResult = null;
    
    try {
      console.log('📤 DB更新操作実行中:', nodeId);
      
      const { getCurrentAdapter } = await import('../utils/storageAdapter.js');
      const adapter = getCurrentAdapter();
      dbResult = await adapter.updateNode(dataRef.current.id, nodeId, updates);
      
      if (!dbResult.success) {
        console.error('❌ DB更新操作失敗:', dbResult.error);
        throw new Error(dbResult.error || 'ノード更新に失敗しました');
      }
      
      console.log('✅ DB更新操作成功:', nodeId);
      
    } catch (error) {
      console.error('❌ ノード更新DB操作失敗:', error);
      // DB操作失敗時はローカル状態を変更せずにエラーを返す
      throw error;
    }
    
    // 2. DB操作成功後、ローカル状態を更新
    console.log('📝 ローカル状態更新開始');
    const currentData = dataRef.current;
    const clonedData = deepClone(currentData);
    
    const updateNodeRecursive = (node) => {
      if (node.id === nodeId) {
        Object.assign(node, updates);
        return node;
      }
      if (node.children) {
        node.children.forEach(updateNodeRecursive);
      }
      return node;
    };
    
    updateNodeRecursive(clonedData.rootNode);
    
    const updateOptions = {
      skipHistory: false,
      source: options.source || 'updateNode',
      allowDuringEdit: options.allowDuringEdit || false,
      saveImmediately: false // DB操作済みなので即座保存は不要
    };
    
    await updateData(clonedData, updateOptions);
    
    console.log('✅ ローカル状態更新完了:', nodeId);
  };

  // 子ノード追加（DB-First方式）
  const addChildNode = async (parentId, nodeText = '', startEditing = false) => {
    const parentNode = findNode(parentId);
    if (!parentNode) return null;
    
    console.log('🔄 ノード追加開始:', { parentId, nodeText });
    
    // 1. 最初にDB操作を実行
    let dbResult = null;
    let finalNodeData = null;
    
    try {
      // 仮のノードデータを作成（DB保存用）
      const tempChild = createNewNode(nodeText, parentNode);
      const childrenCount = parentNode.children?.length || 0;
      const position = calculateNodePosition(parentNode, childrenCount, childrenCount + 1);
      tempChild.x = position.x;
      tempChild.y = position.y;
      tempChild.color = getNodeColor(parentNode, childrenCount);
      
      console.log('📤 DB操作実行中:', tempChild.id);
      
      const { getCurrentAdapter } = await import('../utils/storageAdapter.js');
      const adapter = getCurrentAdapter();
      dbResult = await adapter.addNode(dataRef.current.id, tempChild, parentId);
      
      if (!dbResult.success) {
        console.error('❌ DB操作失敗:', dbResult.error);
        throw new Error(dbResult.error || 'ノード追加に失敗しました');
      }
      
      // DB操作成功 - 確定したIDでノードデータを更新
      finalNodeData = {
        ...tempChild,
        id: dbResult.newId || dbResult.result?.id || tempChild.id
      };
      
      console.log('✅ DB操作成功:', {
        originalId: tempChild.id,
        finalId: finalNodeData.id
      });
      
    } catch (error) {
      console.error('❌ ノード追加DB操作失敗:', error);
      // DB操作失敗時はローカル状態を変更せずにエラーを返す
      throw error;
    }
    
    // 2. DB操作成功後、確定したデータでローカル状態を更新
    console.log('📝 ローカル状態更新開始');
    const currentData = dataRef.current;
    const clonedData = deepClone(currentData);
    
    const addChildRecursive = (node) => {
      if (node.id === parentId) {
        if (!node.children) {
          node.children = [];
        }
        node.children.push(finalNodeData);
        return node;
      }
      if (node.children) {
        node.children.forEach(addChildRecursive);
      }
      return node;
    };
    
    addChildRecursive(clonedData.rootNode);
    
    let newRootNode = clonedData.rootNode;
    if (clonedData.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData = { ...clonedData, rootNode: newRootNode };
    await updateData(newData, { skipHistory: false, saveImmediately: false }); // DB操作済みなので即座保存は不要
    
    console.log('✅ ローカル状態更新完了:', finalNodeData.id);
    
    // 編集状態を設定
    if (startEditing) {
      setSelectedNodeId(finalNodeData.id);
      setEditingNodeId(finalNodeData.id);
      setEditText(finalNodeData.text || '');
    }
    
    return finalNodeData.id;
  };

  // 兄弟ノードを追加（DB-First方式）
  const addSiblingNode = async (nodeId, nodeText = '', startEditing = false) => {
    if (nodeId === 'root') return addChildNode('root', nodeText, startEditing);
    
    const parentNode = findParentNode(nodeId);
    if (!parentNode) return null;
    
    console.log('🔄 兄弟ノード追加開始:', { nodeId, parentNode: parentNode.id, nodeText });
    
    // 1. 最初にDB操作を実行
    let dbResult = null;
    let finalNodeData = null;
    
    try {
      // 仮のノードデータを作成（DB保存用）
      const tempSibling = createNewNode(nodeText, parentNode);
      
      // 色の設定
      if (parentNode.id === 'root') {
        const siblingIndex = parentNode.children?.length || 0;
        tempSibling.color = getNodeColor(parentNode, siblingIndex);
      } else {
        const existingSibling = findNode(nodeId);
        if (existingSibling) {
          tempSibling.color = existingSibling.color;
        } else {
          tempSibling.color = parentNode.color || '#666';
        }
      }
      
      console.log('📤 DB操作実行中:', tempSibling.id);
      
      const { getCurrentAdapter } = await import('../utils/storageAdapter.js');
      const adapter = getCurrentAdapter();
      dbResult = await adapter.addNode(dataRef.current.id, tempSibling, parentNode.id);
      
      if (!dbResult.success) {
        console.error('❌ DB操作失敗:', dbResult.error);
        throw new Error(dbResult.error || '兄弟ノード追加に失敗しました');
      }
      
      // DB操作成功 - 確定したIDでノードデータを更新
      finalNodeData = {
        ...tempSibling,
        id: dbResult.newId || dbResult.result?.id || tempSibling.id
      };
      
      console.log('✅ DB操作成功:', {
        originalId: tempSibling.id,
        finalId: finalNodeData.id
      });
      
    } catch (error) {
      console.error('❌ 兄弟ノード追加DB操作失敗:', error);
      // DB操作失敗時はローカル状態を変更せずにエラーを返す
      throw error;
    }
    
    // 2. DB操作成功後、確定したデータでローカル状態を更新
    console.log('📝 ローカル状態更新開始');
    const currentData = dataRef.current;
    const clonedData = deepClone(currentData);
    
    const addSiblingRecursive = (node) => {
      if (node.id === parentNode.id) {
        const currentIndex = node.children?.findIndex(child => child.id === nodeId) ?? -1;
        if (currentIndex === -1) return node;
        
        const newChildren = [...(node.children || [])];
        newChildren.splice(currentIndex + 1, 0, finalNodeData);
        return { ...node, children: newChildren };
      }
      return { ...node, children: node.children?.map(addSiblingRecursive) || [] };
    };
    
    let newRootNode = addSiblingRecursive(clonedData.rootNode);
    if (clonedData.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData = { ...clonedData, rootNode: newRootNode };
    await updateData(newData, { skipHistory: false, saveImmediately: false }); // DB操作済みなので即座保存は不要
    
    console.log('✅ ローカル状態更新完了:', finalNodeData.id);
    
    // 編集状態を設定
    if (startEditing) {
      setSelectedNodeId(finalNodeData.id);
      setEditingNodeId(finalNodeData.id);
      setEditText(finalNodeData.text || '');
    }
    
    return finalNodeData.id;
  };

  // ノードを削除（DB-First方式）
  const deleteNode = async (nodeId) => {
    if (nodeId === 'root') return false;
    
    console.log('🗑️ deleteNode実行開始:', { 
      nodeId, 
      timestamp: Date.now()
    });
    
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
    
    // 1. 最初にDB操作を実行
    let dbResult = null;
    
    try {
      console.log('📤 DB削除操作実行中:', nodeId);
      
      const { getCurrentAdapter } = await import('../utils/storageAdapter.js');
      const adapter = getCurrentAdapter();
      dbResult = await adapter.deleteNode(dataRef.current.id, nodeId);
      
      if (!dbResult.success) {
        console.error('❌ DB削除操作失敗:', dbResult.error);
        throw new Error(dbResult.error || 'ノード削除に失敗しました');
      }
      
      console.log('✅ DB削除操作成功:', nodeId);
      
    } catch (error) {
      console.error('❌ ノード削除DB操作失敗:', error);
      // DB操作失敗時はローカル状態を変更せずにエラーを返す
      throw error;
    }
    
    // 2. DB操作成功後、ローカル状態を更新
    console.log('📝 ローカル状態更新開始');
    const currentData = dataRef.current;
    const clonedData = deepClone(currentData);
    
    const deleteNodeRecursive = (node) => {
      if (node.children) {
        node.children = node.children.filter(child => child.id !== nodeId);
        node.children.forEach(deleteNodeRecursive);
      }
      return node;
    };
    
    deleteNodeRecursive(clonedData.rootNode);
    
    let newRootNode = clonedData.rootNode;
    if (clonedData.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData = { ...clonedData, rootNode: newRootNode };
    await updateData(newData, { skipHistory: false, saveImmediately: false }); // DB操作済みなので即座保存は不要
    
    console.log('✅ ローカル状態更新完了:', nodeId);
    
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

  // ノードの親を変更（DB-First方式）
  const changeParent = async (nodeId, newParentId) => {
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
    
    console.log('🔄 ノード親変更開始:', { nodeId, newParentId });
    
    // 1. 最初にDB操作を実行
    let dbResult = null;
    
    try {
      console.log('📤 DB親変更操作実行中:', nodeId);
      
      const { getCurrentAdapter } = await import('../utils/storageAdapter.js');
      const adapter = getCurrentAdapter();
      dbResult = await adapter.moveNode(dataRef.current.id, nodeId, newParentId);
      
      if (!dbResult.success) {
        console.error('❌ DB親変更操作失敗:', dbResult.error);
        throw new Error(dbResult.error || 'ノード親変更に失敗しました');
      }
      
      console.log('✅ DB親変更操作成功:', nodeId);
      
    } catch (error) {
      console.error('❌ ノード親変更DB操作失敗:', error);
      // DB操作失敗時はローカル状態を変更せずにエラーを返す
      throw error;
    }
    
    // 2. DB操作成功後、ローカル状態を更新
    console.log('📝 ローカル状態更新開始');
    const currentData = dataRef.current;
    const clonedData = deepClone(currentData);
    
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
    
    let newRootNode = removeFromParent(clonedData.rootNode);
    newRootNode = addToNewParent(newRootNode);
    
    if (clonedData.settings?.autoLayout !== false) {
      newRootNode = applyAutoLayout(newRootNode);
    }
    
    const newData = { ...clonedData, rootNode: newRootNode };
    await updateData(newData, {
      skipHistory: false,
      saveImmediately: false, // DB操作済みなので即座保存は不要
      operationType: 'node_move',
      operationData: {
        nodeId,
        newPosition: { x: nodeToMove.x, y: nodeToMove.y },
        newParentId
      }
    });
    
    console.log('✅ ローカル状態更新完了:', nodeId);
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
  const finishEdit = async (nodeId, newText, options = {}) => {
    // newTextがundefinedの場合は現在のeditTextを使用
    const textToSave = newText !== undefined ? newText : editText;
    const currentNode = findNode(nodeId);
    
    console.log('📝 finishEdit - 詳細入力:', { 
      nodeId, 
      newText, 
      editText, 
      textToSave,
      isEmpty: !textToSave || textToSave.trim() === '',
      currentNodeText: currentNode?.text,
      isRoot: nodeId === 'root',
      textToSaveLength: textToSave?.length,
      newTextLength: newText?.length,
      options
    });
    
    const isEmpty = !textToSave || textToSave.trim() === '';
    const isRoot = nodeId === 'root';
    
    // 削除判定：明確な条件でのみ削除（マップ切り替え時は削除を無効化）
    const shouldDelete = isEmpty && !isRoot && currentNode && !options.skipMapSwitchDelete && (
      // 新規作成されたノード（元々空だった）で、テキストが空の場合のみ削除
      (!currentNode.text || currentNode.text.trim() === '') ||
      // または、明示的に削除を要求された場合
      options.forceDelete === true
    );
    
    if (shouldDelete) {
      console.log('🗑️ ノード削除実行:', { 
        nodeId, 
        reason: '空の新規ノードまたは内容を削除したノード',
        originalText: currentNode?.text,
        skipMapSwitchDelete: options.skipMapSwitchDelete
      });
      setEditingNodeId(null);
      setEditText('');
      await deleteNode(nodeId);
      return;
    }
    
    // マップ切り替え時の削除保護をログ出力
    if (isEmpty && !isRoot && options.skipMapSwitchDelete) {
      console.log('🛡️ マップ切り替え時削除保護:', { 
        nodeId, 
        text: textToSave,
        reason: 'マップ切り替え時は空ノードでも削除しない'
      });
    }
    
    if (isEmpty && !isRoot) {
      console.log('⚠️ 空のテキストだが削除しない:', { 
        nodeId, 
        reason: '既存の内容があったノード',
        originalText: currentNode?.text
      });
      // 空でも既存の内容があった場合は削除せず、元の内容を復元
      if (currentNode?.text) {
        await updateNode(nodeId, { text: currentNode.text }, true, { allowDuringEdit: true, source: 'finishEdit-restore' });
      }
    } else if (!isEmpty) {
      console.log('📝 finishEdit - 保存するテキスト:', textToSave.trim());
      await updateNode(nodeId, { text: textToSave.trim() }, true, { allowDuringEdit: true, source: 'finishEdit-save' });
    }
    
    // 編集状態をリセット（対象ノードが現在編集中の場合のみ）
    console.log('🔄 finishEdit編集状態チェック:', { 
      finishEditNodeId: nodeId, 
      currentEditingNodeId: editingNodeId, 
      shouldReset: editingNodeId === nodeId,
      preserveCurrentEdit: options.preserveCurrentEdit
    });
    
    // 編集状態のリセット制御
    const { onlyResetIfCurrent = true, preserveCurrentEdit, onlyUpdateText = false, skipEditStateReset = false } = options;
    
    // テキストのみ更新モード（編集状態は変更しない）
    if (onlyUpdateText) {
      console.log('📝 finishEdit - テキストのみ更新モード:', { 
        nodeId, 
        textToSave: textToSave.trim(),
        isEmpty
      });
      
      if (!isEmpty) {
        console.log('📝 finishEdit - テキストのみ保存:', textToSave.trim());
        await updateNode(nodeId, { text: textToSave.trim() }, true, { allowDuringEdit: true, source: 'finishEdit-textOnly' });
      }
      // 編集状態は変更せずにreturn
      return;
    }
    
    // 新しいノードが編集中の場合は編集状態を保護
    if (preserveCurrentEdit) {
      // setTimeoutの実行タイミングで、新しいノードがまだ編集状態になっていない場合があるため
      // preserveCurrentEditが指定されている場合は、finishEditの編集状態変更部分を無視する
      console.log('✅ 編集状態保護: 新しいノード作成のため編集状態変更をスキップ', { 
        preserveCurrentEdit, 
        currentEditingNodeId: editingNodeId,
        isNewNodeEditing: editingNodeId === preserveCurrentEdit,
        nodeIdBeingFinished: nodeId
      });
      
      // テキスト保存は実行するが、編集状態の変更はスキップ
      if (!isEmpty) {
        console.log('📝 finishEdit - 保護モード: テキストのみ保存:', textToSave.trim());
        updateNode(nodeId, { text: textToSave.trim() }, true, { allowDuringEdit: true, source: 'finishEdit-protected' });
      }
      return;
    }
    
    // 編集状態リセットをスキップ
    if (skipEditStateReset) {
      console.log('✅ 編集状態リセットをスキップ: 新しいノード作成のため');
      return;
    }
    
    if (onlyResetIfCurrent) {
      // 対象ノードが現在編集中の場合のみリセット
      if (editingNodeId === nodeId) {
        console.log('⚠️ 編集状態リセット: 対象ノードが編集中のため');
        setEditingNodeId(null);
        setEditText('');
      } else {
        console.log('✅ 編集状態保持: 対象ノードが編集中ではないため');
      }
    } else {
      // 強制的にリセット
      console.log('⚠️ 編集状態強制リセット');
      setEditingNodeId(null);
      setEditText('');
    }
  };

  // 折りたたみ状態をトグル
  const toggleCollapse = (nodeId) => {
    const toggleNodeRecursive = (node) => {
      if (node.id === nodeId) return { ...node, collapsed: !node.collapsed };
      return { ...node, children: node.children?.map(toggleNodeRecursive) || [] };
    };
    
    updateData({ ...data, rootNode: toggleNodeRecursive(data.rootNode) });
  };

  // ノードIDを更新（UNIQUE制約違反対応）
  const updateNodeId = async (oldId, newId) => {
    try {
      console.log('🔄 ノードID更新開始:', { oldId, newId });
      
      const updateNodeIdRecursive = (node) => {
        if (node.id === oldId) {
          return { ...node, id: newId };
        }
        if (node.children) {
          return { 
            ...node, 
            children: node.children.map(updateNodeIdRecursive) 
          };
        }
        return node;
      };
      
      const newRootNode = updateNodeIdRecursive(data.rootNode);
      const newData = { ...data, rootNode: newRootNode };
      
      await updateData(newData, { skipHistory: true, saveImmediately: false });
      
      // 選択・編集状態も更新
      if (selectedNodeId === oldId) {
        setSelectedNodeId(newId);
      }
      if (editingNodeId === oldId) {
        setEditingNodeId(newId);
      }
      
      console.log('✅ ノードID更新完了:', { oldId, newId });
    } catch (error) {
      console.error('❌ ノードID更新失敗:', error);
    }
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
    findNode,
    findParentNode,
    flattenNodes,
    applyAutoLayout,
    startEdit,
    finishEdit,
    toggleCollapse,
    updateNodeId
  };
};